/**
 * 数据库持久化服务
 *
 * 按照我们的设计：
 * - 用户日志表 (user_logs) - log队列/流水线记录
 * - 会话表 (sessions) - 24小时上下文
 * - 知识库表 (knowledge)
 * - 报缺记录表 (missing_reports)
 * - 统计表 (daily_statistics)
 */

import fs from "fs/promises";
import path from "path";
import { MongoClient, Db, Collection } from "mongodb";
import type {
  UserLog,
  Session,
  KnowledgeItem,
  MerchantConfig,
  MissingReport,
  DailyStatistics,
  AgentHealth,
} from "./db-schema";

class DatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  // Collections
  private userLogs: Collection<UserLog> | null = null;
  private sessions: Collection<Session> | null = null;
  private knowledge: Collection<KnowledgeItem> | null = null;
  private configs: Collection<MerchantConfig> | null = null;
  private missingReports: Collection<MissingReport> | null = null;
  private dailyStats: Collection<DailyStatistics> | null = null;
  private agentHealth: Collection<AgentHealth> | null = null;

  private readonly LOCAL_DATA_PATH = path.join(process.cwd(), "public", "data");
  private readonly TTL_24HOURS = 24 * 60 * 60 * 1000; // 24小时

  /**
   * 初始化数据库连接
   */
  async init(): Promise<void> {
    try {
      console.log("[Database] 初始化数据库服务...");

      // 尝试连接MongoDB
      await this.connectMongoDB();

      // 创建索引
      await this.createIndexes();

      console.log("[Database] 数据库服务初始化完成");
    } catch (error) {
      console.error("[Database] 初始化失败:", error);
    }
  }

  /**
   * 连接MongoDB
   */
  private async connectMongoDB(): Promise<void> {
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB || "smart-guide";

    if (!mongoUri) {
      console.log("[Database] 未配置MONGODB_URI，将使用本地文件系统");
      return;
    }

    try {
      this.client = new MongoClient(mongoUri);
      await this.client.connect();
      this.db = this.client.db(dbName);

      // 初始化所有集合
      this.userLogs = this.db.collection<UserLog>("user_logs");
      this.sessions = this.db.collection<Session>("sessions");
      this.knowledge = this.db.collection<KnowledgeItem>("knowledge");
      this.configs = this.db.collection<MerchantConfig>("configs");
      this.missingReports = this.db.collection<MissingReport>("missing_reports");
      this.dailyStats = this.db.collection<DailyStatistics>("daily_statistics");
      this.agentHealth = this.db.collection<AgentHealth>("agent_health");

      console.log("[Database] MongoDB连接成功");
    } catch (error) {
      console.warn("[Database] MongoDB连接失败，将使用本地文件系统:", error);
      this.client = null;
      this.db = null;
    }
  }

  /**
   * 创建索引
   */
  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      // user_logs 索引
      if (this.userLogs) {
        await this.userLogs.createIndex({ merchantId: 1, userId: 1 });
        await this.userLogs.createIndex({ ticketId: 1 });
        await this.userLogs.createIndex(
          { createdAt: 1 },
          { expireAfterSeconds: 86400 } // 24小时TTL自动删除
        );
      }

      // sessions 索引
      if (this.sessions) {
        await this.sessions.createIndex({ id: 1 }, { unique: true });
        await this.sessions.createIndex({ merchantId: 1, userId: 1 });
        await this.sessions.createIndex({ lastActive: 1 }, { expireAfterSeconds: 86400 });
      }

      // knowledge 索引
      if (this.knowledge) {
        await this.knowledge.createIndex({ merchantId: 1 });
        await this.knowledge.createIndex({ merchantId: 1, keywords: 1 });
      }

      // missing_reports 索引
      if (this.missingReports) {
        await this.missingReports.createIndex({ merchantId: 1, resolved: 1 });
        await this.missingReports.createIndex({ merchantId: 1, hitCount: -1 });
      }

      console.log("[Database] 索引创建完成");
    } catch (error) {
      console.error("[Database] 创建索引失败:", error);
    }
  }

  // ========== 用户日志操作 (user_logs) ==========

  /**
   * 保存用户日志 (LPUSH到日志队列)
   */
  async saveUserLog(log: Omit<UserLog, "id" | "createdAt">): Promise<void> {
    const fullLog: UserLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date(),
    };

    try {
      if (this.userLogs) {
        await this.userLogs.insertOne(fullLog);
        console.log(`[Database] 用户日志已保存: ${log.ticketId}`);
      } else {
        // 本地文件模式：暂存内存
        console.log(`[Database] 用户日志(本地模式): ${log.ticketId}`);
      }
    } catch (error) {
      console.error("[Database] 保存用户日志失败:", error);
    }
  }

  /**
   * 获取用户最近日志
   */
  async getUserLogs(merchantId: string, userId: string, limit: number = 20): Promise<UserLog[]> {
    try {
      if (this.userLogs) {
        return await this.userLogs
          .find({ merchantId, userId })
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray();
      }
      return [];
    } catch (error) {
      console.error("[Database] 获取用户日志失败:", error);
      return [];
    }
  }

  /**
   * 根据ticketId获取完整流水线记录
   */
  async getLogsByTicket(ticketId: string): Promise<UserLog[]> {
    try {
      if (this.userLogs) {
        return await this.userLogs.find({ ticketId }).sort({ createdAt: 1 }).toArray();
      }
      return [];
    } catch (error) {
      console.error("[Database] 获取流水线日志失败:", error);
      return [];
    }
  }

  // ========== 报缺记录操作 (missing_reports) ==========

  /**
   * 记录报缺
   */
  async reportMissing(
    merchantId: string,
    userId: string,
    ticketId: string,
    question: string,
    intent: string
  ): Promise<void> {
    try {
      if (this.missingReports) {
        // 查找是否已存在相同问题
        const existing = await this.missingReports.findOne({ merchantId, question });

        if (existing) {
          // 增加计数
          await this.missingReports.updateOne(
            { _id: existing._id },
            {
              $inc: { hitCount: 1 },
              $set: { updatedAt: new Date() },
            }
          );
        } else {
          // 新增记录
          await this.missingReports.insertOne({
            id: `miss_${Date.now()}`,
            merchantId,
            userId,
            ticketId,
            question,
            intent,
            hitCount: 1,
            resolved: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        console.log(`[Database] 报缺记录: ${question}`);
      }
    } catch (error) {
      console.error("[Database] 记录报缺失败:", error);
    }
  }

  /**
   * 获取报缺列表
   */
  async getMissingReports(merchantId: string, resolved: boolean = false): Promise<MissingReport[]> {
    try {
      if (this.missingReports) {
        return await this.missingReports
          .find({ merchantId, resolved })
          .sort({ hitCount: -1 })
          .toArray();
      }
      return [];
    } catch (error) {
      console.error("[Database] 获取报缺列表失败:", error);
      return [];
    }
  }

  // ========== 知识库操作 ==========

  /**
   * 加载商户知识库
   */
  async loadKnowledge(merchantId: string): Promise<KnowledgeItem[]> {
    try {
      // 优先从MongoDB加载
      if (this.knowledge) {
        const items = await this.knowledge.find({ merchantId }).toArray();
        if (items.length > 0) {
          console.log(`[Database] 从MongoDB加载知识库: ${merchantId} (${items.length}条)`);
          return items;
        }
      }

      // 从本地文件加载
      const knowledgePath = path.join(this.LOCAL_DATA_PATH, merchantId, "knowledge.json");
      const knowledgeData = await fs.readFile(knowledgePath, "utf-8");
      const parsed = JSON.parse(knowledgeData);

      console.log(`[Database] 从本地文件加载知识库: ${merchantId}`);
      return parsed.items || [];
    } catch (error) {
      console.error(`[Database] 加载知识库失败: ${merchantId}`, error);
      return [];
    }
  }

  /**
   * 搜索知识库
   */
  async searchKnowledge(merchantId: string, query: string): Promise<KnowledgeItem[]> {
    try {
      const items = await this.loadKnowledge(merchantId);

      // 关键词匹配搜索
      return items.filter(
        item =>
          item.enabled &&
          (item.keywords.some(kw => kw.toLowerCase().includes(query.toLowerCase())) ||
            item.name.toLowerCase().includes(query.toLowerCase()) ||
            item.content.toLowerCase().includes(query.toLowerCase()))
      );
    } catch (error) {
      console.error("[Database] 搜索知识库失败:", error);
      return [];
    }
  }

  // ========== 商户配置操作 ==========

  /**
   * 加载商户配置
   */
  async loadConfig(merchantId: string): Promise<MerchantConfig | null> {
    try {
      // 优先从MongoDB加载
      if (this.configs) {
        const config = await this.configs.findOne({ merchantId });
        if (config) {
          console.log(`[Database] 从MongoDB加载配置: ${merchantId}`);
          return config;
        }
      }

      // 从本地文件加载
      const configPath = path.join(this.LOCAL_DATA_PATH, merchantId, "config.json");
      const configData = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configData);

      console.log(`[Database] 从本地文件加载配置: ${merchantId}`);
      return config;
    } catch (error) {
      console.error(`[Database] 加载配置失败: ${merchantId}`, error);
      return null;
    }
  }

  // ========== 会话操作 ==========

  /**
   * 保存会话上下文
   */
  async saveSession(session: Session): Promise<void> {
    try {
      if (this.sessions) {
        await this.sessions.updateOne(
          { id: session.id },
          { $set: { ...session, lastActive: Date.now() } },
          { upsert: true }
        );
        console.log(`[Database] 会话已保存: ${session.id}`);
      }
    } catch (error) {
      console.error("[Database] 保存会话失败:", error);
    }
  }

  /**
   * 获取会话上下文
   */
  async getSession(sessionId: string): Promise<Session | null> {
    try {
      if (this.sessions) {
        return await this.sessions.findOne({ id: sessionId });
      }
      return null;
    } catch (error) {
      console.error("[Database] 获取会话失败:", error);
      return null;
    }
  }

  // ========== Agent健康状态 ==========

  /**
   * 更新Agent健康状态
   */
  async updateAgentHealth(
    merchantId: string,
    agentName: "A" | "B" | "C" | "D",
    data: Partial<AgentHealth>
  ): Promise<void> {
    try {
      if (this.agentHealth) {
        await this.agentHealth.updateOne(
          { merchantId, agentName },
          {
            $set: { ...data, updatedAt: new Date() },
            $setOnInsert: { merchantId, agentName },
          },
          { upsert: true }
        );
      }
    } catch (error) {
      console.error("[Database] 更新Agent健康状态失败:", error);
    }
  }

  // ========== 统计操作 ==========

  /**
   * 更新今日统计
   */
  async incrementStats(
    merchantId: string,
    field: keyof DailyStatistics,
    value: number = 1
  ): Promise<void> {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    try {
      if (this.dailyStats) {
        await this.dailyStats.updateOne(
          { merchantId, date: today },
          {
            $inc: { [field]: value },
            $setOnInsert: { merchantId, date: today },
          },
          { upsert: true }
        );
      }
    } catch (error) {
      console.error("[Database] 更新统计失败:", error);
    }
  }

  /**
   * 获取今日统计
   */
  async getTodayStats(merchantId: string): Promise<DailyStatistics | null> {
    const today = new Date().toISOString().split("T")[0];

    try {
      if (this.dailyStats) {
        return await this.dailyStats.findOne({ merchantId, date: today });
      }
      return null;
    } catch (error) {
      console.error("[Database] 获取统计失败:", error);
      return null;
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        console.log("[Database] MongoDB连接已关闭");
      }
    } catch (error) {
      console.error("[Database] 关闭连接失败:", error);
    }
  }
}

export const databaseService = new DatabaseService();

// ========== 兼容旧接口的导出 ==========

/**
 * 连接数据库
 */
export async function connectDB(): Promise<void> {
  await databaseService.init();
}

/**
 * 配置服务
 */
export const ConfigService = {
  async list(): Promise<MerchantConfig[]> {
    // 获取所有配置（需要实现）
    return [];
  },

  async get(merchantId: string): Promise<MerchantConfig | null> {
    return databaseService.loadConfig(merchantId);
  },

  async save(config: MerchantConfig): Promise<void> {
    // 保存配置（需要实现完整逻辑）
    console.log(`[ConfigService] 保存配置: ${config.merchantId}`);
  },

  async delete(merchantId: string): Promise<void> {
    console.log(`[ConfigService] 删除配置: ${merchantId}`);
  },
};

/**
 * 知识库服务
 */
export const KnowledgeService = {
  async getAll(merchantId: string): Promise<KnowledgeItem[]> {
    return databaseService.loadKnowledge(merchantId);
  },

  async saveAll(merchantId: string, items: KnowledgeItem[]): Promise<void> {
    console.log(`[KnowledgeService] 保存知识库: ${merchantId} (${items.length}条)`);
  },

  async deleteAll(merchantId: string): Promise<void> {
    console.log(`[KnowledgeService] 删除知识库: ${merchantId}`);
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async search(merchantId: string, query: string, _category?: string): Promise<KnowledgeItem[]> {
    return databaseService.searchKnowledge(merchantId, query);
  },

  async getHot(merchantId: string): Promise<KnowledgeItem[]> {
    const items = await databaseService.loadKnowledge(merchantId);
    return items.slice(0, 10); // 返回前10条作为热门
  },
};

/**
 * 日志服务
 */
export const LogService = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getByDate(merchantId: string, _date?: string): Promise<UserLog[]> {
    return databaseService.getUserLogs(merchantId, "", 100);
  },

  async addBatch(logs: Omit<UserLog, "id" | "createdAt">[]): Promise<void> {
    for (const log of logs) {
      await databaseService.saveUserLog(log);
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getStats(merchantId: string, _date?: string): Promise<{ total: number; hit: number }> {
    const logs = await databaseService.getUserLogs(merchantId, "", 1000);
    return {
      total: logs.length,
      hit: logs.filter(l => l.source && !l.source.includes("fallback")).length,
    };
  },

  async getMissing(
    merchantId: string,
    limit: number
  ): Promise<{ query: string; timestamp: number }[]> {
    const reports = await databaseService.getMissingReports(merchantId, false);
    return reports.slice(0, limit).map(r => ({
      query: r.question,
      timestamp: r.createdAt.getTime(),
    }));
  },
};
