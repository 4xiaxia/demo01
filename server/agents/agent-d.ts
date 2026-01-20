/**
 * 服务端Agent D - 监控录像机
 *
 * 核心设计：
 * 1. 监听bus.on('*')记录所有消息
 * 2. 独立初始化，不依赖ABC
 * 3. 健康检测 - 检查ABC是否正常
 * 4. 报缺收集 - 记录未找到答案的问题
 *
 * 按照原始设计：
 * - D是监工摄像机，全程录像
 * - 不干预业务逻辑
 * - 只记录、统计、告警
 *
 * 商家隔离设计（2026-01-20更新）：
 * - 统计数据按商家编码分别存储
 * - 报缺问题按商家隔离
 * - Agent健康状态保持全局（因为Agent是共享的临时工）
 */

import { anpBus } from "../bus";
import type { Message } from "../types";

interface AgentHealthStatus {
  lastSeen: number;
  messageCount: number;
  avgCostMs: number;
}

interface MissingQuestionDetail {
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  intentCategory?: string;
}

interface DailyStats {
  date: string;
  totalDialogs: number;
  voiceDialogs: number;
  textDialogs: number;
  cacheHits: number;
  aiCalls: number;
  avgResponseMs: number;
}

class AgentD {
  private name = "D";

  // Agent健康状态（全局，因为Agent是共享的）
  private agentHealth: Map<string, AgentHealthStatus> = new Map();

  // 按商家隔离的统计数据
  private dailyStatsByMerchant: Map<string, DailyStats> = new Map();
  private missingQuestionsByMerchant: Map<string, Map<string, MissingQuestionDetail>> = new Map();

  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupListeners();
    this.startHealthCheck();
    console.log(`[${this.name}] 监控录像系统已启动（商家隔离模式）`);
  }

  /**
   * 初始化每日统计
   */
  private initDailyStats(): DailyStats {
    return {
      date: new Date().toISOString().split("T")[0],
      totalDialogs: 0,
      voiceDialogs: 0,
      textDialogs: 0,
      cacheHits: 0,
      aiCalls: 0,
      avgResponseMs: 0,
    };
  }

  /**
   * 获取商家的每日统计（自动初始化）
   */
  private getMerchantDailyStats(merchantId: string): DailyStats {
    const today = new Date().toISOString().split("T")[0];
    let stats = this.dailyStatsByMerchant.get(merchantId);

    // 如果不存在或日期变化，重新初始化
    if (!stats || stats.date !== today) {
      if (stats && stats.date !== today) {
        console.log(`[${this.name}] 📊 商户 ${merchantId} 昨日统计:`, stats);
      }
      stats = this.initDailyStats();
      this.dailyStatsByMerchant.set(merchantId, stats);
    }

    return stats;
  }

  /**
   * 获取商家的报缺问题Map（自动初始化）
   */
  private getMerchantMissingQuestions(merchantId: string): Map<string, MissingQuestionDetail> {
    let questions = this.missingQuestionsByMerchant.get(merchantId);
    if (!questions) {
      questions = new Map();
      this.missingQuestionsByMerchant.set(merchantId, questions);
    }
    return questions;
  }

  /**
   * 设置监听器
   */
  private setupListeners() {
    // 监听所有消息
    anpBus.on("*", (msg: Message) => {
      this.recordLog(msg);
    });

    // 监听用户进入（系统直接通知）
    anpBus.on("SYSTEM→D", (msg: Message) => {
      if (msg.action === "USER_ENTER") {
        this.logUserEnter(
          msg.data as unknown as {
            merchantId: string;
            userId: string;
            mode: "voice" | "text";
            timestamp: number;
          }
        );
      }
    });
  }

  /**
   * 记录日志
   */
  private recordLog(msg: Message) {
    const { from, to, action, merchantId, userId } = msg;

    // 更新Agent健康状态
    if (from !== "USER" && from !== "SYSTEM") {
      this.updateAgentHealth(from);
    }

    // 记录到控制台（生产环境应该写数据库）
    console.log(
      `[${this.name}] 📹 ${from}→${to}: ${action}`,
      merchantId ? `[商户:${merchantId}]` : "",
      userId ? `[用户:${userId}]` : ""
    );

    // 统计分析（需要merchantId）
    if (merchantId) {
      this.analyzeMessage(msg, merchantId);
    }
  }

  /**
   * 分析消息并更新统计（按商家隔离）
   */
  private analyzeMessage(msg: Message, merchantId: string) {
    // 核心逻辑：只分析发给监控中心(D)的消息，避免重复统计
    if (msg.to !== "D") return;

    const { action } = msg;
    const data = msg.data as {
      inputType?: "voice" | "text";
      source?: string;
      costMs?: number;
      query?: string;
      question?: string;
      intentCategory?: string;
    };

    // 获取该商家的统计数据
    const dailyStats = this.getMerchantDailyStats(merchantId);

    switch (action) {
      case "A_COMPLETED":
      case "A_PARSED":
        dailyStats.totalDialogs++;
        if (data.inputType === "voice") {
          dailyStats.voiceDialogs++;
        } else {
          dailyStats.textDialogs++;
        }
        break;

      case "B_OK":
      case "B_RESPONSE":
        if (
          data.source === "hot_cache" ||
          data.source === "cache" ||
          data.source === "hot_question"
        ) {
          dailyStats.cacheHits++;
        }
        if (data.source?.includes("ai")) {
          dailyStats.aiCalls++;
        }
        if (data.costMs) {
          // 更新平均响应时间
          const totalCount = dailyStats.totalDialogs || 1;
          const totalTime = dailyStats.avgResponseMs * (totalCount - 1) + data.costMs;
          dailyStats.avgResponseMs = Math.round(totalTime / totalCount);
        }
        break;

      case "C_OK":
        // 记录知识库检索成功（可选）
        break;

      case "C_NOT_FOUND": {
        // 报缺 - 按商家隔离存储
        const question = data.query || data.question || "";
        const intent = data.intentCategory;

        if (question) {
          const missingQuestions = this.getMerchantMissingQuestions(merchantId);
          const detail = missingQuestions.get(question) || {
            count: 0,
            firstSeenAt: Date.now(),
            lastSeenAt: Date.now(),
          };

          detail.count++;
          detail.lastSeenAt = Date.now();
          if (intent) detail.intentCategory = intent;

          missingQuestions.set(question, detail);
          console.log(
            `[${this.name}] ⚠️ 报缺[${merchantId}]: "${question}" (累计${detail.count}次)`
          );
        }
        break;
      }
    }
  }

  /**
   * 更新Agent健康状态（全局）
   */
  private updateAgentHealth(agentName: string) {
    const status = this.agentHealth.get(agentName) || {
      lastSeen: 0,
      messageCount: 0,
      avgCostMs: 0,
    };

    status.lastSeen = Date.now();
    status.messageCount++;
    this.agentHealth.set(agentName, status);
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck() {
    this.healthCheckInterval = setInterval(() => {
      this.checkAgentHealth();
    }, 30000); // 30秒检查一次
  }

  /**
   * 检查Agent健康状态
   */
  private checkAgentHealth() {
    const now = Date.now();
    const TIMEOUT = 60000; // 60秒无消息视为离线

    for (const [agent, status] of this.agentHealth) {
      const timeSinceLastSeen = now - status.lastSeen;

      if (timeSinceLastSeen > TIMEOUT) {
        console.warn(
          `[${this.name}] 🚨 Agent ${agent} 可能离线 (${Math.round(
            timeSinceLastSeen / 1000
          )}秒无消息)`
        );
      }
    }
  }

  /**
   * 用户进入记录（系统直接调用）
   */
  logUserEnter(params: {
    merchantId: string;
    userId: string;
    mode: "voice" | "text";
    timestamp: number;
  }) {
    console.log(
      `[${this.name}] 👋 用户进入: 商户=${params.merchantId}, `,
      `用户=${params.userId}, 模式=${params.mode}`
    );
  }

  /**
   * 忽略或删除报缺问题（按商家）
   */
  ignoreMissingQuestion(merchantId: string, question: string) {
    const missingQuestions = this.getMerchantMissingQuestions(merchantId);
    missingQuestions.delete(question);
    console.log(`[${this.name}] 🗑️ 已忽略报缺问题[${merchantId}]: "${question}"`);
  }

  /**
   * 获取统计数据（按商家隔离）
   *
   * @param merchantId 商家编码，如果不传则返回所有商家汇总
   */
  getStats(merchantId?: string) {
    if (merchantId) {
      // 返回指定商家的统计
      const dailyStats = this.getMerchantDailyStats(merchantId);
      const missingQuestions = this.getMerchantMissingQuestions(merchantId);

      return {
        merchantId,
        daily: dailyStats,
        agentHealth: Object.fromEntries(this.agentHealth),
        missingQuestions: Object.fromEntries(missingQuestions),
      };
    }

    // 返回所有商家汇总（向后兼容）
    const allDailyStats: DailyStats = this.initDailyStats();
    const allMissingQuestions: Map<string, MissingQuestionDetail> = new Map();

    // 汇总所有商家的统计
    for (const [, stats] of this.dailyStatsByMerchant) {
      if (stats.date === allDailyStats.date) {
        allDailyStats.totalDialogs += stats.totalDialogs;
        allDailyStats.voiceDialogs += stats.voiceDialogs;
        allDailyStats.textDialogs += stats.textDialogs;
        allDailyStats.cacheHits += stats.cacheHits;
        allDailyStats.aiCalls += stats.aiCalls;
      }
    }

    // 汇总所有商家的报缺
    for (const [, questions] of this.missingQuestionsByMerchant) {
      for (const [q, detail] of questions) {
        const existing = allMissingQuestions.get(q);
        if (existing) {
          existing.count += detail.count;
          existing.lastSeenAt = Math.max(existing.lastSeenAt, detail.lastSeenAt);
        } else {
          allMissingQuestions.set(q, { ...detail });
        }
      }
    }

    return {
      merchantId: "all",
      daily: allDailyStats,
      agentHealth: Object.fromEntries(this.agentHealth),
      missingQuestions: Object.fromEntries(allMissingQuestions),
    };
  }

  /**
   * 获取所有商家列表
   */
  getMerchantList(): string[] {
    return Array.from(this.dailyStatsByMerchant.keys());
  }

  /**
   * 销毁
   */
  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

export const agentD = new AgentD();
