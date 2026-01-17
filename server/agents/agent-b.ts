/**
 * 服务端Agent B - 决策中心
 *
 * 核心设计（4种场景）：
 * 1. 24h黑板缓存命中 → 直接回复
 * 2. 缓存未命中+非闲聊 → 问C查知识库
 * 3. PRICE_QUERY → 专门处理价格（保证准确）
 * 4. CHITCHAT → AI温柔回复（引导业务）
 *
 * 按照原始设计：
 * - B是决策中心，根据intent走不同流程
 * - B负责最终回复并写入池子
 * - C只查不写，B最后写
 */

import { anpBus } from "../bus";
import { contextPool } from "../context-pool";
import { configManager } from "../config-manager";
import type { Message } from "../types";

interface AgentBMessageData {
  content?: string;
  refinedQuestion?: string;
  input?: string;
  intentCategory?: string;
  response?: string;
  source?: string;
  costMs?: number;
  query?: string;
}

// 配置相关的接口定义
interface HotQuestionsDataSourceConfig {
  hotQuestions?: string;
}

interface CacheConfig {
  enabled?: boolean;
  ttl?: number;
}

// 等待C回复的请求
interface PendingRequest {
  resolve: (value: string | null) => void;
  timer: NodeJS.Timeout;
  startTime: number;
}

class AgentB {
  private name = "B";
  private C_TIMEOUT = 3000; // C查询超时时间
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;

  // 热门问题缓存（内存缓存，避免每次读文件）
  private hotQuestionsCache = new Map<
    string,
    {
      data: Array<{
        id: string;
        question: string;
        keywords: string[];
        answer: string;
        enabled: boolean;
      }>;
      timestamp: number;
    }
  >();
  private CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  constructor() {
    this.setupListeners();
    this.startPollingPool();
    console.log(`[${this.name}] 决策中心已就位`);
  }

  /**
   * 启动轮询池子
   */
  private startPollingPool() {
    this.processingInterval = setInterval(() => {
      this.checkPoolForTasks();
    }, 100);
  }

  /**
   * 检查池子中的任务
   */
  private async checkPoolForTasks() {
    const tasks = anpBus.peekTasksForAgent("B", 10);

    for (const task of tasks) {
      if (task.status === "pending" && task.task.to === "B") {
        if (task.task.action === "A_NOTIFY_B" || task.task.action === "A_PARSED") {
          anpBus.claimTask(task.id, "B");
          await this.handleInput(task.task);
          anpBus.completeTask(task.id);
        }
      }
    }
  }

  /**
   * 设置监听器（监听C的回复）
   */
  private setupListeners() {
    anpBus.on("C→B", async (msg: Message) => {
      const pending = this.pendingRequests.get(msg.traceId);
      if (!pending) return;

      clearTimeout(pending.timer);
      this.pendingRequests.delete(msg.traceId);

      const data = msg.data as AgentBMessageData;
      if (msg.action === "C_FOUND") {
        pending.resolve(String(data.content || ""));
      } else {
        pending.resolve(null);
      }
    });
  }

  /**
   * 处理A的通知
   */
  private async handleInput(msg: Message) {
    const { merchantId, userId, sessionId } = msg;
    const data = msg.data as AgentBMessageData;
    const query = String(data.refinedQuestion || data.input || "");
    const intent = String(data.intentCategory || "OTHER_QUERY");

    console.log(`[${this.name}] 📥 收到任务: "${query}" (意图: ${intent})`);

    const startTime = Date.now();

    // ===== 第一层: 用户历史缓存（24h黑板）=====
    const userCached = await contextPool.findSimilarAnswer(merchantId, userId, sessionId, query);

    if (userCached) {
      console.log(`[${this.name}] ⚡ 用户历史缓存命中`);
      await this.replyUser(msg, userCached, "user_cache", Date.now() - startTime);
      return;
    }

    // ===== 第二层: 商户热门问题 =====
    const hotAnswer = await this.checkMerchantHotQuestions(merchantId, query);

    if (hotAnswer) {
      console.log(`[${this.name}] 🔥 商户热门问题命中: ${hotAnswer.id}`);
      await this.replyUser(msg, hotAnswer.answer, "hot_question", Date.now() - startTime);

      // 异步更新命中次数（不阻塞回复）
      this.incrementHotQuestionHit(merchantId, hotAnswer.id).catch(err => {
        console.error(`[${this.name}] 更新热门问题命中次数失败:`, err);
      });

      return;
    }

    // ===== 第三层: CHITCHAT 闲聊（B自己处理）=====
    if (intent === "CHITCHAT") {
      console.log(`[${this.name}] 💬 闲聊模式 - B自己处理`);
      const chitchatReply = await this.handleChitchat();
      await this.replyUser(msg, chitchatReply, "chitchat", Date.now() - startTime);
      return;
    }

    // ===== 第四层: 查询知识库（问C）=====
    console.log(`[${this.name}] 📚 查询知识库 - 问C`);
    const answer = await this.queryC(msg);

    if (answer) {
      await this.replyUser(msg, answer, "knowledge_base", Date.now() - startTime);
    } else {
      // ===== 第五层: AI兜底 =====
      console.log(`[${this.name}] 🤖 AI兜底`);
      const aiAnswer = await this.askAI(String(query));
      await this.replyUser(msg, aiAnswer, "ai_fallback", Date.now() - startTime);
    }
  }

  /**
   * 查询C的知识库
   */
  private async queryC(msg: Message): Promise<string | null> {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        console.warn(`[${this.name}] ⏰ C查询超时`);
        this.pendingRequests.delete(msg.traceId);
        resolve(null);
      }, this.C_TIMEOUT);

      this.pendingRequests.set(msg.traceId, {
        resolve,
        timer,
        startTime: Date.now(),
      });

      const data = msg.data as AgentBMessageData;
      // 发送查询请求给C
      anpBus.publish({
        traceId: msg.traceId,
        from: "B",
        to: "C",
        action: "B_QUERY_C",
        merchantId: msg.merchantId,
        userId: msg.userId,
        sessionId: msg.sessionId,
        timestamp: Date.now(),
        data: {
          query: data.refinedQuestion || data.input,
        },
      });
    });
  }

  /**
   * 处理闲聊
   */
  private async handleChitchat(): Promise<string> {
    const config = configManager.getConfig();
    const chitchatPrompt = config?.prompts?.chitchat || "我是导游助手，专门回答景区相关问题哦~";

    // 简单回复或调用AI生成温柔回复
    return chitchatPrompt;
  }

  /**
   * 处理价格查询
   */
  private async handlePriceQuery(msg: Message): Promise<string | null> {
    // 专门查询价格，确保准确
    return await this.queryC(msg);
  }

  /**
   * AI兜底
   */
  private async askAI(query: string): Promise<string> {
    try {
      // 调用服务端/api/chat
      const config = configManager.getConfig();
      const systemPrompt = config?.prompts?.system || "你是智能导游助手";

      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error("AI API failed");
      }

      interface AIResponse {
        choices?: {
          message?: {
            content?: string;
          };
        }[];
      }

      const data = (await response.json()) as AIResponse;
      return data.choices?.[0]?.message?.content || "抱歉，我暂时无法回答这个问题。";
    } catch (error) {
      console.error(`[${this.name}] AI调用失败`, error);
      const fallback =
        configManager.getConfig()?.prompts?.fallback?.error || "抱歉，系统出了点问题，请稍后再试。";
      return fallback;
    }
  }

  /**
   * 检查商户热门问题（Dragonfly缓存 + MongoDB/Local持久化）
   *
   * 架构：Dragonfly缓存(5分钟) → MongoDB/Local持久化
   * 用途：商户自己标记的高频问题，优先级高于知识库检索
   * 来源：后台"热门问题管理"页面
   */
  private async checkMerchantHotQuestions(
    merchantId: string,
    query: string
  ): Promise<{ id: string; answer: string } | null> {
    try {
      const config = configManager.getConfig();
      
      const configDataSource = config?.dataSource as HotQuestionsDataSourceConfig | undefined;
      const configCache = config?.cache as CacheConfig | undefined;

      const dataSource = configDataSource?.hotQuestions || "local";
      const cacheEnabled = configCache?.enabled !== false;
      const cacheTTL = configCache?.ttl || 300; // 默认5分钟

      // 1. 检查Dragonfly缓存 (如果启用)
      if (cacheEnabled) {
        const redis = contextPool.getRedisClient();
        if (redis) {
          try {
            const cacheKey = `hot:${merchantId}`;
            const cached = await redis.get(cacheKey);

            if (cached) {
              console.log(`[${this.name}] ⚡ Dragonfly缓存命中: ${merchantId}`);
              const hotQuestions = JSON.parse(cached);
              return this.matchHotQuestion(hotQuestions, query);
            }
          } catch (error) {
            console.warn(`[${this.name}] Dragonfly缓存读取失败，继续从数据源加载:`, error);
          }
        }
      }

      // 2. 从数据源加载
      let hotQuestions: Array<{
        id: string;
        question: string;
        keywords: string[];
        answer: string;
        enabled: boolean;
      }> = [];

      if (dataSource === "mongodb") {
        // 从MongoDB加载
        hotQuestions = await this.loadHotQuestionsFromMongoDB(merchantId);
      } else {
        // 从本地文件加载
        hotQuestions = await this.loadHotQuestionsFromLocal(merchantId);
      }

      // 3. 写入Dragonfly缓存 (如果启用)
      if (cacheEnabled && hotQuestions.length > 0) {
        const redis = contextPool.getRedisClient();
        if (redis) {
          try {
            const cacheKey = `hot:${merchantId}`;
            await redis.setex(cacheKey, cacheTTL, JSON.stringify(hotQuestions));
            console.log(
              `[${this.name}] 📦 Dragonfly缓存已更新: ${merchantId} (${hotQuestions.length}条, TTL=${cacheTTL}s)`
            );
          } catch (error) {
            console.warn(`[${this.name}] Dragonfly缓存写入失败:`, error);
          }
        }
      }

      // 4. 匹配并返回
      return this.matchHotQuestion(hotQuestions, query);
    } catch (error) {
      console.error(`[${this.name}] ❌ 热门问题查询失败:`, error);
      return null;
    }
  }

  /**
   * 从MongoDB加载热门问题
   */
  private async loadHotQuestionsFromMongoDB(merchantId: string): Promise<
    Array<{
      id: string;
      question: string;
      keywords: string[];
      answer: string;
      enabled: boolean;
    }>
  > {
    try {
      console.log(`[${this.name}] 🌐 从MongoDB加载热门问题: ${merchantId}`);

      // TODO: 实现MongoDB加载
      // const { databaseService } = await import("../database");
      // const items = await databaseService.loadHotQuestions(merchantId);

      // 暂时降级到本地文件
      console.warn(`[${this.name}] ⚠️ MongoDB热门问题加载暂未实现，降级到本地`);
      return await this.loadHotQuestionsFromLocal(merchantId);
    } catch (error) {
      console.error(`[${this.name}] MongoDB加载失败，降级到本地:`, error);
      return await this.loadHotQuestionsFromLocal(merchantId);
    }
  }

  /**
   * 从本地文件加载热门问题
   */
  private async loadHotQuestionsFromLocal(merchantId: string): Promise<
    Array<{
      id: string;
      question: string;
      keywords: string[];
      answer: string;
      enabled: boolean;
    }>
  > {
    try {
      console.log(`[${this.name}] 📂 从本地文件加载热门问题: ${merchantId}`);

      const fs = await import("fs/promises");
      const path = await import("path");

      const hotQuestionsPath = path.join(
        process.cwd(),
        "server",
        "merchant",
        merchantId,
        "hot-questions.json"
      );

      const content = await fs.readFile(hotQuestionsPath, "utf-8");
      const data = JSON.parse(content) as {
        merchantId: string;
        hotQuestions: Array<{
          id: string;
          question: string;
          keywords: string[];
          answer: string;
          enabled: boolean;
        }>;
      };

      console.log(`[${this.name}] ✅ 本地热门问题加载完成: ${data.hotQuestions.length}条`);
      return data.hotQuestions;
    } catch (error) {
      console.error(`[${this.name}] 本地文件加载失败:`, error);
      return [];
    }
  }

  /**
   * 匹配热门问题（提取为独立方法）
   */
  private matchHotQuestion(
    hotQuestions: Array<{
      id: string;
      question: string;
      keywords: string[];
      answer: string;
      enabled: boolean;
    }>,
    query: string
  ): { id: string; answer: string } | null {
    const queryLower = query.toLowerCase();

    // 遍历热门问题，匹配关键词
    for (const hot of hotQuestions) {
      if (!hot.enabled) continue;

      // 检查关键词匹配
      for (const keyword of hot.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          return {
            id: hot.id,
            answer: hot.answer,
          };
        }
      }
    }

    return null;
  }

  /**
   * 手动刷新热门问题缓存（供API调用）
   */
  public refreshHotQuestionsCache(merchantId: string) {
    this.hotQuestionsCache.delete(merchantId);
    console.log(`[${this.name}] 🔄 已清除 ${merchantId} 的热门问题缓存`);
  }

  /**
   * 增加热门问题命中次数
   *
   * 异步执行，不阻塞主流程
   */
  private async incrementHotQuestionHit(merchantId: string, hotId: string): Promise<void> {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      const hotQuestionsPath = path.join(
        process.cwd(),
        "server",
        "merchant",
        merchantId,
        "hot-questions.json"
      );

      const content = await fs.readFile(hotQuestionsPath, "utf-8");
      const data = JSON.parse(content) as {
        merchantId: string;
        hotQuestions: Array<{
          id: string;
          hitCount: number;
          [key: string]: unknown;
        }>;
        updatedAt: number;
        version: number;
      };

      // 找到对应的热门问题并增加命中次数
      const hot = data.hotQuestions.find(h => h.id === hotId);
      if (hot) {
        hot.hitCount = (hot.hitCount || 0) + 1;
        data.updatedAt = Date.now();

        // 写回文件
        await fs.writeFile(hotQuestionsPath, JSON.stringify(data, null, 2), "utf-8");

        console.log(`[${this.name}] 📊 热门问题命中次数 +1: ${hotId} (总计: ${hot.hitCount})`);
      }
    } catch (error) {
      // 静默失败，不影响主流程
      console.error(`[${this.name}] 更新命中次数失败:`, error);
    }
  }

  /**
   * 回复用户（最终出口）
   */
  private async replyUser(originalMsg: Message, content: string, source: string, costMs: number) {
    const { merchantId, userId, sessionId, traceId } = originalMsg;

    console.log(
      `[${this.name}] ✅ 回复用户: ${content.slice(0, 30)}... (来源: ${source}, 耗时: ${costMs}ms)`
    );

    // 写入24h黑板
    await contextPool.addTurn(
      merchantId,
      userId,
      sessionId,
      {
        role: "assistant",
        content,
        source,
        timestamp: Date.now(),
      },
      traceId
    );

    // 发送给用户
    await anpBus.publish({
      traceId,
      from: "B",
      to: "USER",
      action: "B_RESPONSE",
      merchantId,
      userId,
      sessionId,
      timestamp: Date.now(),
      data: {
        response: content,
        source,
        costMs,
      },
    });

    // 通知D
    await anpBus.publish({
      traceId,
      from: "B",
      to: "D",
      action: "B_OK",
      merchantId,
      userId,
      sessionId,
      timestamp: Date.now(),
      data: {
        source,
        costMs,
      },
    });
  }

  /**
   * 销毁
   */
  destroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }
}

export const agentB = new AgentB();
