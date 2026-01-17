/**
 * Agent 3.0 Refactored Types
 * 
 * 核心设计原则：
 * 1. 商家标识为第一层级（一个萝卜一个坑）
 * 2. 所有动作完成后必须通知D
 * 3. 消息格式统一，便于追踪
 * 
 * 来源: 3.0 Core Types + 2.0 Message Spec
 */

// ============ 基础类型 ============

/** Agent角色 */
export type AgentRole = 'A' | 'B' | 'C' | 'D' | 'USER' | 'SYSTEM';

/** 输入类型 */
export type InputType = 'voice' | 'text' | 'image';

/**
 * 意图分类（简化版）
 * 
 * A哥只判断：与钱有没有关系
 * - PRICE_QUERY → 价格相关问题
 * - INFO_QUERY  → 信息类问题
 * - CHITCHAT    → 闲聊/废话
 */
export type IntentCategory =
    | 'PRICE_QUERY'        // 价格相关（多少钱、收费、费用等）
    | 'INFO_QUERY'         // 信息类（其他所有问题）
    | 'CHITCHAT';          // 闲聊/废话

/**
 * 意图分类到数据库分类的映射
 */
export const INTENT_TO_CATEGORY: Record<IntentCategory, 'price' | 'info' | 'chitchat'> = {
    PRICE_QUERY: 'price',
    INFO_QUERY: 'info',
    CHITCHAT: 'info'
};

/** 消息来源 */
export type DataSource = 'hot_cache' | 'database' | 'ai_fallback' | 'timeout_fallback' | 'cache' | 'ai' | 'chitchat_response' | 'ai_qwen_tools';

/** Agent状态 */
export type AgentStatus = 'idle' | 'processing' | 'error' | 'offline';

// ============ 动作类型 ============

/** A哥动作 */
export type ActionA =
    | 'A_RECEIVED'          // A收到用户输入
    | 'A_PARSED'            // A完成解析，发给B
    | 'A_NOTIFY_B'          // A通知B
    | 'A_COMPLETED';        // A处理完成

/** B哥动作 */
export type ActionB =
    | 'B_RECEIVED'          // B收到A的消息
    | 'B_HOT_HIT'           // B命中热门缓存，直接回复
    | 'B_QUERY_C'           // B向C查询
    | 'B_RESPONSE'          // B回复用户
    | 'B_FALLBACK'          // B兜底回复
    | 'B_NOTIFY_C';         // B通知C

/** C哥动作 */
export type ActionC =
    | 'C_RECEIVED'          // C收到查询请求
    | 'C_FOUND'             // C查到结果
    | 'C_NOT_FOUND'         // C未查到
    | 'C_COMPLETED'         // C处理完成
    | 'C_NOT_FOUND_LOG';    // C未找到结果日志

/** D哥动作 */
export type ActionD =
    | 'D_LOG'               // D记录日志
    | 'D_ALERT'             // D发出告警
    | 'D_REPORT_MISSING';   // D报告缺失

/** 所有动作类型 */
export type ActionType = ActionA | ActionB | ActionC | ActionD;

// ========== 知识库标准定义 (KNOWLEDGE_STANDARD.md) ==========

export type KnowledgeCategory =
    | 'price'      // 价格
    | 'info'       // 信息
    | 'service'    // 服务
    | 'route'      // 路线
    | 'facility'   // 设施
    | 'figure'     // 人物
    | 'custom';    // 自定义

export interface KnowledgeItem {
    id: string;
    name: string;
    content: string;
    keywords: string[];
    category: KnowledgeCategory | string; // 允许字符串以兼容旧数据

    // 扩展字段
    extra?: Record<string, unknown>;

    // 元数据
    enabled: boolean;
    isHot?: boolean;
    priority?: number; // 越小越优先
    weight?: number;   // 搜索权重 0.1-2.0
}

export interface SearchRequest {
    query: string;
    category?: KnowledgeCategory;
    limit?: number;
    minScore?: number;
}

export interface SearchResult {
    item: KnowledgeItem;
    score: number;
    matchedKeyword?: string;
}

// ========== 消息协议 ==========

export interface MessageData {
    // ============ A→B: 意图解析结果 ============
    /** 输入类型：语音/文本/图片 */
    inputType?: InputType;
    /** 原始输入内容（文本或转写后的文字） */
    originalInput?: string;
    /** 基础输入字段 */
    input?: string;
    /** 原始语音数据（Base64，仅语音输入时存在） */
    audioData?: string;
    /** 意图分类 */
    intentCategory?: IntentCategory;
    /** 意图字符串（兼容旧格式） */
    intent?: string;
    /** 凝练后的核心问题（≤20字） */
    refinedQuestion?: string;
    /** 意图置信度 0-1 */
    confidence?: number;

    // ============ B→C: 查询请求 ============
    /** 查询内容 */
    query?: string;
    /** 问题分类 */
    queryCategory?: IntentCategory;

    // ============ C→B: 查询结果 ============
    /** 是否找到 */
    found?: boolean;
    /** 查询结果内容 */
    content?: string;
    /** 数据来源文件（如 services.json#id）*/
    sourceFile?: string;
    /** 标准化搜索结果 */
    searchResults?: SearchResult[];

    // ============ B→USER: 回复 ============
    /** 文字回复 */
    response?: string;
    /** 语音URL（TTS生成） */
    audioUrl?: string;
    /** 语音Base64数据（TTS生成） */
    audioBase64?: string;
    /** 回复来源 */
    source?: DataSource;
    /** 用户输入方式（语音输入时返回语音回复） */
    responseInputType?: InputType;

    // ============ D记录用 ============
    /** 耗时(毫秒) */
    costMs?: number;
    /** 是否成功 */
    success?: boolean;
    /** 错误信息 */
    error?: string;
    /** 状态描述 */
    status?: string;
    /** 意图分类（报缺时用于统计） */
    category?: IntentCategory;

    /** 允许扩展字段 */
    [key: string]: unknown;
}

export interface Message {
    /** 消息唯一ID */
    id: string;
    /** 会话ID */
    sessionId: string;
    /** 用户唯一标识 */
    userId: string;
    /** 商家标识（第一层级） */
    merchantId: string;
    /** 追踪ID（同一次请求共享） */
    traceId: string;
    /** 时间戳 */
    timestamp: number;
    /** 发送者 */
    from: AgentRole;
    /** 接收者 */
    to: AgentRole;
    /** 动作类型 */
    action: ActionType;
    /** 消息数据 */
    data: MessageData;
    /** 优先级 */
    priority?: number;
}

export interface Session {
    id: string;
    userId: string;
    merchantId: string;
    startTime: number;
    lastActive: number;
    messages: Message[];
}

// ============ 热门问答格式 ============

/**
 * 商家热门问答
 * 格式：商家标识 + 关键词 + Q&A
 */
export interface HotQA {
    /** 关键词列表（用于快速匹配） */
    keywords: string[];
    /** 问题（可选，用于展示） */
    question?: string;
    /** 答案 */
    answer: string;
}

/**
 * 商家热门问答集合
 */
export interface MerchantHotQAs {
    /** 商家标识 */
    merchantId: string;
    /** 问答列表 */
    qas: HotQA[];
    /** 更新时间 */
    updatedAt: number;
}

// ============ 用户查询记录 ============

/**
 * 用户查询记录（D哥登记用）
 */
export interface UserQueryRecord {
    /** 商家标识 */
    merchantId: string;
    /** 用户ID */
    userId: string;
    /** 追踪ID */
    traceId: string;
    /** 原始问题 */
    question: string;
    /** 意图分类 */
    intentCategory: IntentCategory;
    /** 回复来源 */
    source: DataSource;
    /** 是否成功回复 */
    success: boolean;
    /** 耗时 */
    costMs: number;
    /** 时间戳 */
    timestamp: number;
}

// ============ 工具函数 ============

/**
 * 生成唯一ID
 */
export function generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 生成追踪ID
 */
export function generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 创建消息
 */
export function createMessage(
    from: AgentRole,
    to: AgentRole,
    merchantId: string,
    userId: string,
    sessionId: string,
    action: ActionType,
    data: MessageData,
    traceId?: string
): Message {
    return {
        id: generateId(),
        from,
        to,
        merchantId,
        userId,
        sessionId,
        action,
        data,
        timestamp: Date.now(),
        traceId: traceId || generateTraceId()
    };
}

/**
 * 创建通知D的消息
 * @param from 发送者
 * @param merchantId 商户ID
 * @param userId 用户ID  
 * @param sessionId 会话ID
 * @param action 触发动作（用于标识是哪个步骤的通知）
 * @param status 状态描述
 * @param traceId 追踪ID
 * @param extra 额外数据
 */
export function createNotifyD(
    from: AgentRole,
    merchantId: string,
    userId: string,
    sessionId: string,
    action: ActionType,
    status: string,
    traceId: string,
    extra?: Partial<MessageData>
): Message {
    // 确定D应执行的动作类型
    let dAction: ActionD = 'D_LOG';
    if (action === 'D_ALERT') dAction = 'D_ALERT';
    if (action === 'D_REPORT_MISSING') dAction = 'D_REPORT_MISSING';

    return createMessage(from, 'D', merchantId, userId, sessionId, dAction, {
        status,
        ...extra
    }, traceId);
}
