/**
 * 服务端配置管理器
 */

interface MerchantConfig {
  merchantId: string;
  name: string;
  prompts: {
    system: string;
    welcome: string;
    chitchat?: string;
    fallback?: {
      timeout?: string;
      error?: string;
      notFound?: string;
      offline?: string;
    };
  };
  dataSource?: "local" | "remote";
  api?: {
    apiKey: string;
    endpoint?: string;
  };
  cache?: {
    ttl: number;
  };
}

class ConfigManager {
  private config: MerchantConfig | null = null;
  private merchantId = "dongli";

  /**
   * 初始化配置管理器
   */
  async init(): Promise<void> {
    console.log("[ConfigManager] 初始化配置管理器...");
    // 预加载默认商户配置
    try {
      await this.loadConfig("dongli");
      console.log("[ConfigManager] ✅ 默认配置加载完成");
    } catch {
      console.warn("[ConfigManager] ⚠️ 默认配置加载失败，将在首次使用时加载");
    }
  }

  getMerchantId(): string {
    return this.merchantId;
  }

  getConfig(): MerchantConfig | null {
    return this.config;
  }

  async loadConfig(merchantId: string = "dongli"): Promise<void> {
    // 简化实现：返回默认配置
    this.config = {
      merchantId,
      name: "东里村智能导游",
      prompts: {
        system: "你是东里村的智能导游助手，请友好、专业地回答游客的问题。",
        welcome: "您好！欢迎来到东里村，我是智能导游小助手，有什么可以帮您的？",
        chitchat: "我是导游助手，专门回答景区相关问题哦~",
        fallback: {
          timeout: "抱歉让您久等了，我需要稍微整理一下思路。",
          error: "系统有点小状况，正在调整中。如需紧急帮助，请联系景区工作人员。",
          notFound: "这个问题有点超出我的知识范围了，建议您咨询景区工作人员。",
          offline: "我有点不舒服，正在休息调整。您的问题我已经记下来啦！",
        },
      },
      dataSource: "local",
      api: {
        apiKey: process.env.SILICONFLOW_API_KEY || "test_key",
      },
      cache: {
        ttl: 86400, // 24小时
      },
    };
  }
}

export const configManager = new ConfigManager();
