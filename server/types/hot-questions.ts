/**
 * 热门问题数据结构
 *
 * 用途：商户自定义的高频问题，优先级高于知识库检索
 * 来源：商户从"报缺列表"中选择高频问题添加
 */

export interface HotQuestion {
  /** 唯一ID */
  id: string;

  /** 问题标题（商户填写） */
  question: string;

  /** 关键词列表（用于匹配） */
  keywords: string[];

  /** 标准答案（商户填写） */
  answer: string;

  /** 命中次数（自动统计） */
  hitCount: number;

  /** 最后更新时间 */
  lastUpdated: string;

  /** 是否启用 */
  enabled: boolean;

  /** 创建时间 */
  createdAt: string;

  /** 来源（manual=手动添加, from_missing=从报缺列表添加） */
  source: "manual" | "from_missing";

  /** 原始报缺问题（如果来自报缺列表） */
  originalMissingQuestion?: string;
}

/**
 * 商户热门问题集合
 */
export interface MerchantHotQuestions {
  /** 商户ID */
  merchantId: string;

  /** 热门问题列表 */
  hotQuestions: HotQuestion[];

  /** 最后更新时间 */
  updatedAt: number;

  /** 版本号（用于缓存失效） */
  version: number;
}

/**
 * 知识库条目（扩展字段）
 */
export interface KnowledgeItem {
  id: string;
  name: string;
  content: string;
  keywords: string[];
  category: string;
  enabled: boolean;

  /** 是否为热门问题（商户标记） */
  isHot?: boolean;

  /** 权重（1.0-2.0，热门问题自动+0.5） */
  weight?: number;

  /** 命中次数（自动统计） */
  hitCount?: number;

  /** 最后命中时间 */
  lastHitAt?: string;
}

/**
 * Agent D 报缺记录（扩展字段）
 */
export interface MissingQuestionRecord {
  /** 问题内容 */
  question: string;

  /** 累计次数 */
  count: number;

  /** 首次出现时间 */
  firstSeenAt: string;

  /** 最后出现时间 */
  lastSeenAt: string;

  /** 状态（pending=待处理, added_to_hot=已添加到热门, ignored=已忽略） */
  status: "pending" | "added_to_hot" | "ignored";

  /** 关联的热门问题ID（如果已添加） */
  hotQuestionId?: string;

  /** 商户ID */
  merchantId: string;

  /** 意图分类 */
  intentCategory?: string;
}

/**
 * MongoDB user_logs 表字段（扩展）
 */
export interface UserLogRecord {
  /** TraceId */
  traceId: string;

  /** 商户ID */
  merchantId: string;

  /** 用户ID */
  userId: string;

  /** 会话ID */
  sessionId: string;

  /** 时间戳 */
  timestamp: number;

  /** Agent动作 */
  action: string;

  /** 来源Agent */
  from: string;

  /** 目标Agent */
  to: string;

  /** 数据 */
  data: {
    /** 用户问题 */
    question?: string;

    /** 回复来源 */
    source?: "user_cache" | "hot_question" | "knowledge_base" | "ai_fallback";

    /** 命中的热门问题ID */
    hotQuestionId?: string;

    /** 耗时 */
    costMs?: number;

    /** 其他数据 */
    [key: string]: unknown;
  };

  /** 创建时间（用于24h自动清理） */
  createdAt: Date;

  /** 过期时间（24小时后） */
  expiresAt: Date;
}

/**
 * 后台统计数据
 */
export interface DashboardStats {
  /** 日期 */
  date: string;

  /** 总对话数 */
  totalDialogs: number;

  /** 缓存命中统计 */
  cacheStats: {
    /** 用户历史缓存命中 */
    userCache: number;

    /** 商户热门问题命中 */
    hotQuestion: number;

    /** 知识库命中 */
    knowledgeBase: number;

    /** AI兜底 */
    aiFallback: number;
  };

  /** 平均响应时间 */
  avgResponseMs: number;

  /** 成本估算 */
  estimatedCost: number;
}
