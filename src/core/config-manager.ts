/**
 * 配置管理器
 *
 * 职责：管理商户配置、主题、API设置
 *
 * 按照我们的设计：
 * - 临时工进房间后穿上配置（apikey/prompt/各就各位）
 * - 支持主备API配置
 * - 支持本地/云数据源切换
 * - 24小时缓存TTL配置
 */

// ========== API配置类型 ==========

/** ASR语音识别配置 */
export interface ASRConfig {
  primary: "zhipu" | "dashscope" | "custom";
  backup?: string[];
  maxDuration?: number; // 语音最长秒数，默认60
}

/** TTS语音合成配置 */
export interface TTSConfig {
  primary: "zhipu" | "dashscope" | "custom";
  backup?: string[];
}

/** LLM大模型配置 */
export interface LLMConfig {
  primary: "siliconflow" | "zhipu" | "dashscope" | "custom";
  model: string;
  backup?: {
    provider: string;
    model: string;
  };
}

/** API配置集合 */
export interface APIConfig {
  asr?: ASRConfig;
  tts?: TTSConfig;
  llm?: LLMConfig;
}

/** 热门问答 */
export interface HotQA {
  keywords: string[];
  question?: string;
  answer: string;
}

/** 缓存配置 */
export interface CacheConfig {
  ttl: number; // 秒，默认86400（24小时）
}

// ========== 商户配置主类型 ==========

export interface MerchantConfig {
  /** 商户ID（第一层级标识） */
  merchantId: string;
  /** 商户名称 */
  name: string;
  /** 头像/图标 */
  avatar: string;

  /** 提示词配置 */
  prompts: {
    system: string;
    welcome: string;
    chitchat?: string;
    fallback?: {
      timeout?: string; // 超时兜底
      error?: string; // 错误兜底
      notFound?: string; // 未找到兜底
      offline?: string; // 离线兜底
    };
  };

  /** API配置（主备模式） */
  apiConfig?: APIConfig;

  /** 兼容旧格式的api字段 */
  api?: {
    provider: string;
    apiKey: string;
    model: string;
  };

  /** 数据源：local=本地文件, remote=云数据库 */
  dataSource?: "local" | "remote";

  /** 缓存配置 */
  cache?: CacheConfig;

  /** 热门问答（缓存命中优先） */
  hotQAs?: HotQA[];

  /** 主题配置 */
  theme: {
    primaryColor: string;
    title: string;
  };
}

class ConfigManager {
  private config: MerchantConfig | null = null;
  private defaultMerchantId = import.meta.env.VITE_MERCHANT_ID || "dongli";

  /**
   * 获取当前房间号（MerchantId）
   */
  getMerchantId(): string {
    // 1. URL 参数优先 ?merchant=xxx
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get("merchant");
    if (urlId) return urlId;

    // 2. 已加载的配置
    if (this.config?.merchantId) return this.config.merchantId;

    // 3. 环境变量兜底
    return this.defaultMerchantId;
  }

  /**
   * 获取数据基础路径
   * 支持BASE_URL配置，适配不同部署环境
   */
  getDataPath(): string {
    const baseUrl = import.meta.env.BASE_URL || "/";
    return `${baseUrl}data`.replace(/\/+/g, "/");
  }

  /**
   * 进房间，拿装备 (加载配置)
   */
  async loadConfig(): Promise<MerchantConfig> {
    const merchantId = this.getMerchantId();
    const dataPath = this.getDataPath();
    const configUrl = `${dataPath}/${merchantId}/config.json`;

    console.log(`[ConfigManager] 正在进入房间: ${merchantId}...`);
    console.log(`[ConfigManager] 配置路径: ${configUrl}`);

    try {
      const res = await fetch(configUrl);
      if (!res.ok) {
        throw new Error(`找不到房间配置文件 (${res.status})`);
      }

      const rawConfig = await res.json();

      this.config = this.validateConfig(rawConfig, merchantId);

      console.log(`[ConfigManager] 成功穿上 ${this.config.name} 的马甲`);

      return this.config;
    } catch (e) {
      console.error("[ConfigManager] 进错房间了？无法加载配置", e);
      this.config = this.getDefaultConfig(merchantId);
      return this.config;
    }
  }

  /**
   * 验证配置结构
   */
  private validateConfig(raw: unknown, merchantId: string): MerchantConfig {
    if (!raw || typeof raw !== "object") {
      return this.getDefaultConfig(merchantId);
    }

    const obj = raw as Record<string, unknown>;
    const apiConfigRaw = obj.apiConfig as Record<string, unknown> | undefined;

    return {
      merchantId: String(obj.merchantId || merchantId),
      name: String(obj.name || "智能导游"),
      avatar: String(obj.avatar || "🤖"),

      // 新格式：apiConfig
      apiConfig: apiConfigRaw
        ? {
            asr: apiConfigRaw.asr as ASRConfig | undefined,
            tts: apiConfigRaw.tts as TTSConfig | undefined,
            llm: apiConfigRaw.llm as LLMConfig | undefined,
          }
        : undefined,

      // 兼容旧格式：api
      api: obj.api
        ? {
            provider: String((obj.api as Record<string, unknown>)?.provider || "zhipu"),
            apiKey: String((obj.api as Record<string, unknown>)?.apiKey || ""),
            model: String((obj.api as Record<string, unknown>)?.model || "glm-4-flash"),
          }
        : undefined,

      prompts: {
        system: String((obj.prompts as Record<string, unknown>)?.system || "你是一个智能助手"),
        welcome: String((obj.prompts as Record<string, unknown>)?.welcome || "你好"),
        chitchat: (obj.prompts as Record<string, unknown>)?.chitchat
          ? String((obj.prompts as Record<string, unknown>)?.chitchat)
          : undefined,
      },

      // 数据源配置
      dataSource: obj.dataSource === "remote" ? "remote" : "local",

      // 缓存配置
      cache: obj.cache
        ? {
            ttl: Number((obj.cache as Record<string, unknown>)?.ttl) || 86400,
          }
        : { ttl: 86400 },

      // 热门问答
      hotQAs: Array.isArray(obj.hotQAs) ? (obj.hotQAs as HotQA[]) : undefined,

      theme: {
        primaryColor: String((obj.theme as Record<string, unknown>)?.primaryColor || "#2563eb"),
        title: String((obj.theme as Record<string, unknown>)?.title || "智能导游"),
      },
    };
  }

  /**
   * 获取当前配置
   */
  getConfig(): MerchantConfig | null {
    return this.config;
  }

  /**
   * 获取热门问答列表
   */
  getHotQAs(): HotQA[] {
    return this.config?.hotQAs || [];
  }

  /**
   * 获取缓存TTL（秒）
   */
  getCacheTTL(): number {
    return this.config?.cache?.ttl || 86400;
  }

  /**
   * 获取数据源类型
   */
  getDataSource(): "local" | "remote" {
    return this.config?.dataSource || "local";
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(id: string): MerchantConfig {
    return {
      merchantId: id,
      name: "智能导游 (默认)",
      avatar: "🤖",
      apiConfig: {
        asr: { primary: "zhipu", backup: ["dashscope"], maxDuration: 60 },
        tts: { primary: "zhipu", backup: ["dashscope"] },
        llm: { primary: "siliconflow", model: "Qwen/Qwen3-0.5B" },
      },
      prompts: {
        system: "你是一个友好的智能导游助手，请简洁准确地回答用户问题。",
        welcome: "你好，有什么可以帮您的？",
        chitchat: "我是导游助手，专门回答景区相关问题哦~",
      },
      dataSource: "local",
      cache: { ttl: 86400 },
      theme: { primaryColor: "#2563eb", title: "智能导游" },
    };
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(): Promise<MerchantConfig> {
    this.config = null;
    return this.loadConfig();
  }
}

export const configManager = new ConfigManager();
