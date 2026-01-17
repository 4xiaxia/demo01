/**
 * 服务端Agent C - 知识库管理员
 *
 * 核心设计：
 * 1. 只读不写池子 - 只负责检索，找到答案返回给B
 * 2. 支持本地/远程数据源
 * 3. 多结果时结合上下文选最佳
 *
 * 按照原始设计：
 * - C是查书的，专注知识库检索
 * - 找到答案返回给B，由B决定怎么回复
 * - 命中多条时结合上下文优选
 */

import { anpBus } from "../bus";
import { contextPool } from "../context-pool";
import { configManager } from "../config-manager";
import type { Message } from "../types";
import fs from "fs/promises";
import path from "path";

interface KnowledgeItem {
  id: string;
  name: string;
  content: string;
  keywords: string[];
  category?: string;
  enabled?: boolean;
  weight?: number;
}

interface SearchResult {
  item: KnowledgeItem;
  score: number;
}

class AgentC {
  private name = "C";
  private items: KnowledgeItem[] = [];
  private isReady = false;
  private dataSource: "local" | "remote" = "local";
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log(`[${this.name}] 知识库管理员已就位`);
    this.startPollingPool();
  }

  /**
   * 初始化：加载知识库
   */
  async init(merchantId: string = "dongli") {
    const config = configManager.getConfig();
    this.dataSource = config?.dataSource || "local";

    if (this.dataSource === "remote") {
      await this.initFromRemote(merchantId);
    } else {
      await this.initFromLocal(merchantId);
    }
  }

  /**
   * 从本地文件加载
   */
  private async initFromLocal(merchantId: string) {
    try {
      const knowledgePath = path.join(
        process.cwd(),
        "public",
        "data",
        merchantId,
        "knowledge.json"
      );
      console.log(`[${this.name}] 📂 从本地加载: ${knowledgePath}`);

      const content = await fs.readFile(knowledgePath, "utf-8");
      const data = JSON.parse(content);

      this.parseKnowledgeData(data);
      console.log(`[${this.name}] ✅ 本地知识库加载完成，共 ${this.items.length} 条`);
    } catch (e) {
      console.error(`[${this.name}] ❌ 本地加载失败`, e);
      this.isReady = false;
    }
  }

  /**
   * 从远程MongoDB加载
   */
  private async initFromRemote(merchantId: string) {
    try {
      console.log(`[${this.name}] 🌐 从MongoDB加载知识库: ${merchantId}`);

      // 从database.ts导入
      const { databaseService } = await import("../database");

      // 从MongoDB加载知识库 (返回KnowledgeItem[])
      const items = await databaseService.loadKnowledge(merchantId);

      if (!items || items.length === 0) {
        console.warn(`[${this.name}] ⚠️ MongoDB中无数据，降级到本地`);
        await this.initFromLocal(merchantId);
        return;
      }

      // 包装成对象传给parseKnowledgeData
      this.parseKnowledgeData({ items });
      console.log(`[${this.name}] ✅ MongoDB知识库加载完成，共 ${this.items.length} 条`);
    } catch (error) {
      console.error(`[${this.name}] ❌ MongoDB加载失败，降级到本地:`, error);
      await this.initFromLocal(merchantId);
    }
  }

  /**
   * 解析知识库数据
   */
  private parseKnowledgeData(data: unknown) {
    interface RawKnowledgeData {
      items?: Array<{
        id?: unknown;
        name?: unknown;
        content?: unknown;
        keywords?: unknown;
        category?: unknown;
        enabled?: boolean;
        weight?: number;
      }>;
    }
    const items = ((data as RawKnowledgeData).items || []).map(item => ({
      id: String(item.id || ""),
      name: String(item.name || ""),
      content: String(item.content || ""),
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
      category: String(item.category || "info"),
      enabled: item.enabled !== false,
      weight: Number(item.weight) || 1.0,
    }));

    this.items = items.filter((item: KnowledgeItem) => item.enabled);
    this.isReady = true;
  }

  /**
   * 启动轮询池子
   */
  private startPollingPool() {
    this.processingInterval = setInterval(() => {
      this.checkPoolForTasks();
    }, 100); // 每100ms检查一次
  }

  /**
   * 检查池子中的任务
   */
  private async checkPoolForTasks() {
    if (!this.isReady) return;

    const tasks = anpBus.peekTasksForAgent("C", 10);

    for (const task of tasks) {
      if (task.status === "pending" && task.task.to === "C") {
        if (task.task.action === "B_QUERY_C") {
          // 取走任务并处理
          anpBus.claimTask(task.id, "C");
          await this.handleQuery(task.task);
          anpBus.completeTask(task.id);
        }
      }
    }
  }

  /**
   * 处理查询请求
   */
  private async handleQuery(msg: Message) {
    const data = msg.data as { query?: string; refinedQuestion?: string };
    const query = data.query || data.refinedQuestion || "";
    const { merchantId, userId, sessionId } = msg;

    console.log(`[${this.name}] 🔍 收到查询: "${query}"`);

    // 智能检索
    const results = this.smartSearch(query);

    if (results.length === 0) {
      // 未找到
      console.log(`[${this.name}] ❌ 未找到答案`);

      await anpBus.publish({
        traceId: msg.traceId,
        from: "C",
        to: "B",
        action: "C_NOT_FOUND",
        merchantId,
        userId,
        sessionId,
        timestamp: Date.now(),
        data: { query },
      });

      // 通知D报缺
      await anpBus.publish({
        traceId: msg.traceId,
        from: "C",
        to: "D",
        action: "C_NOT_FOUND",
        merchantId,
        userId,
        sessionId,
        timestamp: Date.now(),
        data: { query },
      });

      return;
    }

    // 如果找到多条，结合上下文选最佳
    let bestResult = results[0];

    if (results.length > 1) {
      console.log(`[${this.name}] 📋 命中${results.length}条，结合上下文优选...`);

      const context = await contextPool.getRecentTurns(merchantId, userId, sessionId, 3);
      bestResult = await this.selectBestResult(results, context, merchantId, userId, sessionId);

      // 通知D - 命中多条
      await anpBus.publish({
        traceId: msg.traceId,
        from: "C",
        to: "D",
        action: "C_MULTI_MATCH",
        merchantId,
        userId,
        sessionId,
        timestamp: Date.now(),
        data: { count: results.length },
      });
    }

    // 返回答案给B
    console.log(`[${this.name}] ✅ 找到答案: ${bestResult.item.name}`);

    await anpBus.publish({
      traceId: msg.traceId,
      from: "C",
      to: "B",
      action: "C_FOUND",
      merchantId,
      userId,
      sessionId,
      timestamp: Date.now(),
      data: {
        content: bestResult.item.content,
        source: "knowledge_base",
        itemId: bestResult.item.id,
        score: bestResult.score,
      },
    });

    // 通知D成功
    await anpBus.publish({
      traceId: msg.traceId,
      from: "C",
      to: "D",
      action: "C_OK",
      merchantId,
      userId,
      sessionId,
      timestamp: Date.now(),
      data: { itemId: bestResult.item.id },
    });
  }

  /**
   * 智能检索
   */
  private smartSearch(query: string): SearchResult[] {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const item of this.items) {
      let score = 0;

      // 关键词精确匹配
      for (const keyword of item.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          score += 10;
        }
      }

      // 标题模糊匹配
      if (item.name.toLowerCase().includes(queryLower)) {
        score += 5;
      }

      // 内容模糊匹配
      if (item.content.toLowerCase().includes(queryLower)) {
        score += 2;
      }

      // 权重加成
      score *= item.weight || 1.0;

      if (score > 0) {
        results.push({ item, score });
      }
    }

    // 按分数降序排序
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * 结合上下文选最佳结果 (使用AI)
   *
   * 场景：命中多条知识时，需要理解用户真正想问什么
   * 例如：
   *   用户1: "东里村在哪?"
   *   用户2: "门票多少钱?" → 可能问成人票、学生票、老人票
   *
   * C需要：
   *   1. 查看缓存池 (用户之前问过什么)
   *   2. 用AI理解上下文
   *   3. 选择最相关的答案
   */
  private async selectBestResult(
    results: SearchResult[],
    context: unknown[],
    merchantId: string,
    userId: string,
    sessionId: string
  ): Promise<SearchResult> {
    // 如果只有1条，直接返回
    if (results.length === 1) {
      return results[0];
    }

    console.log(`[${this.name}] 🤖 使用AI优选 (${results.length}条候选)`);

    try {
      // 获取上下文对话
      const recentTurns = await contextPool.getRecentTurns(merchantId, userId, sessionId, 5);

      // 构建上下文文本
      const contextText = recentTurns
        .map(turn => {
          const t = turn as { role?: string; content?: string };
          return `${t.role === "user" ? "用户" : "助手"}: ${t.content || ""}`;
        })
        .join("\n");

      // 构建候选答案列表
      const candidates = results.map((r, idx) => ({
        index: idx,
        title: r.item.name,
        content: r.item.content.slice(0, 100), // 截取前100字
        category: r.item.category,
      }));

      // 调用AI选择最佳答案
      const apiKey = process.env.SILICONFLOW_API_KEY || "";

      if (!apiKey) {
        console.warn(`[${this.name}] ⚠️ AI未配置，使用简单规则`);
        return this.selectBestResultSimple(results, context);
      }

      const systemPrompt = `你是知识库检索助手，帮助选择最符合用户意图的答案。

你会收到：
1. 用户的对话历史（了解上下文）
2. 多个候选答案

你的任务：
- 分析用户真正想问什么
- 选择最相关的答案
- 只返回答案的index（数字）

例如：
用户历史：
  用户: 东里村在哪?
  助手: 福建省莆田市...
  用户: 门票多少钱?

候选答案：
  0. 成人门票60元
  1. 学生门票30元
  2. 老人门票免费

分析：用户没有特别说明，应该返回最常见的成人票
返回：0`;

      const userPrompt = `对话历史：
${contextText || "(无历史)"}

候选答案：
${candidates.map(c => `${c.index}. ${c.title}: ${c.content}`).join("\n")}

请返回最佳答案的index（只返回数字）：`;

      const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "Qwen/Qwen2.5-7B-Instruct",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1, // 低温度，保证稳定
          max_tokens: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API Error: ${response.status}`);
      }

      const data = await response.json();
      
      // 类型检查以避免ts(18046)错误
      if (
        typeof data === 'object' && 
        data !== null && 
        'choices' in data &&
        Array.isArray(data.choices) && 
        data.choices.length > 0 &&
        typeof data.choices[0] === 'object' && 
        data.choices[0] !== null &&
        'message' in data.choices[0] &&
        typeof data.choices[0].message === 'object' &&
        data.choices[0].message !== null &&
        'content' in data.choices[0].message
      ) {
        const aiChoice = (data.choices[0].message as { content: unknown }).content;
        const selectedIndex = parseInt(typeof aiChoice === 'string' ? aiChoice.trim() : '0', 10);

        if (selectedIndex >= 0 && selectedIndex < results.length) {
          console.log(
            `[${this.name}] 🎯 AI选择: ${results[selectedIndex].item.name} (index: ${selectedIndex})`
          );
          return results[selectedIndex];
        }
      }

      // AI返回无效，降级
      return results[0];
    } catch (error) {
      console.error(`[${this.name}] ❌ AI优选失败，使用简单规则:`, error);
      return this.selectBestResultSimple(results, context);
    }
  }

  /**
   * 简单规则优选（降级方案）
   */
  private selectBestResultSimple(results: SearchResult[], context: unknown[]): SearchResult {
    // 简单实现：检查上下文中是否提到某个category
    const contextText = context
      .map(turn => (turn as { content?: string }).content || "")
      .join(" ")
      .toLowerCase();

    for (const result of results) {
      const category = result.item.category || "";
      if (contextText.includes(category)) {
        console.log(`[${this.name}] 🎯 上下文优选: ${result.item.name} (category: ${category})`);
        return result;
      }
    }

    // 默认返回分数最高的
    return results[0];
  }

  /**
   * 刷新知识库（供API调用）
   * 用途：后台更新知识库后，重新加载到内存
   */
  public async refreshKnowledge(merchantId: string = "dongli"): Promise<void> {
    console.log(`[${this.name}] 🔄 开始刷新知识库: ${merchantId}`);

    // 标记为未就绪，暂停处理请求
    this.isReady = false;

    try {
      // 重新加载知识库
      await this.init(merchantId);
      console.log(`[${this.name}] ✅ 知识库刷新完成: ${this.items.length} 条`);
    } catch (error) {
      console.error(`[${this.name}] ❌ 知识库刷新失败:`, error);
      this.isReady = false;
    }
  }

  /**
   * 获取知识库状态（供监控使用）
   */
  public getStatus() {
    return {
      isReady: this.isReady,
      itemCount: this.items.length,
      dataSource: this.dataSource,
    };
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

export const agentC = new AgentC();
