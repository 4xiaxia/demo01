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
 */

import { anpBus } from "../bus";
import type { Message } from "../types";

interface AgentHealthStatus {
  lastSeen: number;
  messageCount: number;
  avgCostMs: number;
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
  private agentHealth: Map<string, AgentHealthStatus> = new Map();
  private missingQuestions: Map<string, number> = new Map();
  private dailyStats: DailyStats = this.initDailyStats();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupListeners();
    this.startHealthCheck();
    console.log(`[${this.name}] 监控录像系统已启动`);
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

    // 统计分析
    this.analyzeMessage(msg);
  }

  /**
   * 分析消息并更新统计
   */
  private analyzeMessage(msg: Message) {
    const { action } = msg;
    const data = msg.data as {
      inputType?: "voice" | "text";
      source?: string;
      costMs?: number;
      query?: string;
      question?: string;
    };

    // 检查日期是否变化
    const today = new Date().toISOString().split("T")[0];
    if (this.dailyStats.date !== today) {
      console.log(`[${this.name}] 📊 昨日统计:`, this.dailyStats);
      this.dailyStats = this.initDailyStats();
    }

    switch (action) {
      case "A_PARSED":
        this.dailyStats.totalDialogs++;
        if (data.inputType === "voice") {
          this.dailyStats.voiceDialogs++;
        } else {
          this.dailyStats.textDialogs++;
        }
        break;

      case "B_RESPONSE":
        if (data.source === "hot_cache" || data.source === "cache") {
          this.dailyStats.cacheHits++;
        }
        if (data.source?.includes("ai")) {
          this.dailyStats.aiCalls++;
        }
        if (data.costMs) {
          // 更新平均响应时间
          const total =
            this.dailyStats.avgResponseMs * (this.dailyStats.totalDialogs - 1) + data.costMs;
          this.dailyStats.avgResponseMs = Math.round(total / this.dailyStats.totalDialogs);
        }
        break;

      case "C_NOT_FOUND": {
        // 报缺 - 只处理发给D的消息，避免重复计数
        if (msg.to !== "D") break;

        const question = data.query || data.question || "";
        if (question) {
          const count = this.missingQuestions.get(question) || 0;
          this.missingQuestions.set(question, count + 1);
          console.log(`[${this.name}] ⚠️ 报缺: "${question}" (累计${count + 1}次)`);
        }
        break;
      }
    }
  }

  /**
   * 更新Agent健康状态
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
   * 获取统计数据
   */
  getStats() {
    return {
      daily: this.dailyStats,
      agentHealth: Object.fromEntries(this.agentHealth),
      missingQuestions: Object.fromEntries(this.missingQuestions),
    };
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
