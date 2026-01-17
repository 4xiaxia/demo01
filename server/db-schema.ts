/**
 * 数据表Schema定义
 *
 * 按照我们的设计：
 * - user_logs: 用户明细表（log队列/流水线记录）
 * - sessions: 24小时会话上下文
 * - knowledge: 知识库
 * - hot_qas: 热门问答缓存
 * - configs: 商户配置
 */

// ========== 用户日志表 (user_logs) ==========
// 等于log队列/日志队列/流水线记录

export interface UserLog {
  // 主键
  id: string; // 自动生成

  // 业务标识
  ticketId: string; // 流水线ID (traceId)
  merchantId: string; // 商户ID (第一层级)
  userId: string; // 用户ID
  sessionId: string; // 会话ID

  // 对话内容
  role: "user" | "assistant" | "system";
  content: string; // 对话内容
  refinedQuestion?: string; // 精简问题 (A精简后)
  intent?: "PRICE_QUERY" | "INFO_QUERY" | "CHITCHAT"; // 意图分类

  // 元数据
  inputType?: "voice" | "text" | "image"; // 输入类型
  source?: UserLogSource; // 回复来源
  costMs?: number; // 耗时 (毫秒)

  // 时间
  createdAt: Date; // 创建时间

  // 扩展字段
  extra?: Record<string, unknown>;
}

export type UserLogSource =
  | "hot_cache" // 热门缓存命中
  | "context_cache" // 24小时上下文缓存命中
  | "database" // 知识库检索
  | "ai_qwen_tools" // 千问工具调用
  | "ai_fallback" // AI兜底
  | "chitchat_response" // 闲聊回复
  | "timeout_fallback"; // 超时兜底

// MongoDB索引建议:
// db.user_logs.createIndex({ merchantId: 1, userId: 1 })
// db.user_logs.createIndex({ ticketId: 1 })
// db.user_logs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 }) // 24小时TTL

// ========== 会话表 (sessions) ==========

export interface Session {
  id: string; // 会话ID
  merchantId: string; // 商户ID
  userId: string; // 用户ID
  mode: "voice" | "text"; // 对话模式

  startTime: number; // 开始时间
  lastActive: number; // 最后活跃时间

  turns: DialogTurn[]; // 对话轮次列表
}

export interface DialogTurn {
  role: "user" | "assistant";
  content: string;
  refined?: string;
  intent?: string;
  inputType?: "voice" | "text";
  timestamp: number;
  source?: string;
  found?: boolean;
  ticketId?: string;
}

// MongoDB索引建议:
// db.sessions.createIndex({ id: 1 }, { unique: true })
// db.sessions.createIndex({ merchantId: 1, userId: 1 })
// db.sessions.createIndex({ lastActive: 1 }, { expireAfterSeconds: 86400 })

// ========== 知识库表 (knowledge) ==========

export interface KnowledgeItem {
  id: string; // 知识ID (如 k_001)
  merchantId: string; // 商户ID
  name: string; // 问题标题
  content: string; // 答案内容
  keywords: string[]; // 关键词数组
  category: KnowledgeCategory;

  enabled: boolean; // 是否启用
  isHot?: boolean; // 是否热门
  weight?: number; // 搜索权重 (0.1-2.0)
  priority?: number; // 优先级 (越小越优先)

  createdAt: number;
  updatedAt: number;
}

export type KnowledgeCategory =
  | "price" // 价格
  | "info" // 信息
  | "service" // 服务
  | "route" // 路线
  | "facility" // 设施
  | "figure" // 人物
  | "custom"; // 自定义

// MongoDB索引建议:
// db.knowledge.createIndex({ merchantId: 1 })
// db.knowledge.createIndex({ merchantId: 1, keywords: 1 })
// db.knowledge.createIndex({ merchantId: 1, isHot: 1 })

// ========== 热门问答表 (hot_qas) ==========

export interface HotQA {
  id?: string;
  merchantId: string;
  keywords: string[]; // 关键词列表
  question?: string; // 问题 (可选，用于展示)
  answer: string; // 答案
  hitCount?: number; // 命中次数统计
  updatedAt?: number;
}

// MongoDB索引建议:
// db.hot_qas.createIndex({ merchantId: 1, keywords: 1 })

// ========== 商户配置表 (configs) ==========

export interface MerchantConfig {
  merchantId: string;
  name: string;
  avatar: string;

  prompts: {
    system: string;
    welcome: string;
    chitchat?: string;
  };

  apiConfig?: {
    asr?: {
      primary: string;
      backup?: string[];
      maxDuration?: number;
    };
    tts?: {
      primary: string;
      backup?: string[];
    };
    llm?: {
      primary: string;
      model: string;
      backup?: {
        provider: string;
        model: string;
      };
    };
  };

  // 兼容旧格式
  api?: {
    provider: string;
    apiKey: string;
    model: string;
  };

  dataSource?: "local" | "remote";

  cache?: {
    ttl: number; // 秒, 默认86400
  };

  hotQAs?: HotQA[];

  theme: {
    primaryColor: string;
    title: string;
  };

  createdAt?: number;
  updatedAt?: number;
}

// ========== 报缺记录表 (missing_reports) ==========

export interface MissingReport {
  id: string;
  merchantId: string;
  userId: string;
  ticketId: string;

  question: string; // 未找到答案的问题
  intent: string; // 意图分类
  hitCount: number; // 被问次数

  resolved: boolean; // 是否已解决
  resolvedBy?: string; // 解决方式 (如添加了知识)

  createdAt: Date;
  updatedAt: Date;
}

// MongoDB索引建议:
// db.missing_reports.createIndex({ merchantId: 1, resolved: 1 })
// db.missing_reports.createIndex({ merchantId: 1, hitCount: -1 })

// ========== Agent健康状态表 (agent_health) ==========

export interface AgentHealth {
  merchantId: string;
  agentName: "A" | "B" | "C" | "D";

  status: "healthy" | "degraded" | "offline";
  processCount: number; // 处理次数
  avgCostMs: number; // 平均耗时
  errorCount: number; // 错误次数
  lastError?: string; // 最后错误信息

  updatedAt: Date;
}

// ========== 统计表 (statistics) ==========

export interface DailyStatistics {
  merchantId: string;
  date: string; // YYYY-MM-DD

  totalDialogs: number; // 总对话数
  voiceDialogs: number; // 语音对话数
  textDialogs: number; // 文本对话数

  cacheHitRate: number; // 缓存命中率 (0-1)
  avgResponseMs: number; // 平均响应时间

  hotCacheHits: number; // 热门缓存命中
  databaseHits: number; // 知识库命中
  aiFallbacks: number; // AI兜底次数

  missingCount: number; // 报缺次数

  // 成本统计 (单位：元)
  asrCost: number;
  ttsCost: number;
  llmCost: number;
  totalCost: number;
}

// MongoDB索引建议:
// db.daily_statistics.createIndex({ merchantId: 1, date: -1 }, { unique: true })
