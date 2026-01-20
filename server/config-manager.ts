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
  dataSource: {
    knowledge: "local" | "mongodb";
    hotQuestions: "local" | "mongodb";
    config: "local" | "mongodb";
  };
  api?: {
    apiKey: string;
    endpoint?: string;
  };
  cache: {
    enabled: boolean;
    ttl: number;
    provider?: "dragonfly" | "memory";
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
    this.merchantId = merchantId;

    // 从文件读取配置
    const { getPublicConfigPath, getServerConfigPath } = await import("./config/paths");
    const fs = await import("fs/promises");

    // 优先读取server/merchant目录，其次读取public/data目录
    const serverPath = getServerConfigPath(merchantId);
    const publicPath = getPublicConfigPath(merchantId);

    let rawConfig: Record<string, unknown> | null = null;

    try {
      // 1. 尝试读取server/merchant/config.json
      const data = await fs.readFile(serverPath, "utf-8");
      rawConfig = JSON.parse(data);
      console.log(`[ConfigManager] 从服务端配置读取: ${serverPath}`);
    } catch {
      // 2. 降级到public/data/config.json
      try {
        const data = await fs.readFile(publicPath, "utf-8");
        rawConfig = JSON.parse(data);
        console.log(`[ConfigManager] 从公共目录读取: ${publicPath}`);
      } catch {
        console.warn(`[ConfigManager] 配置文件不存在，使用默认配置`);
      }
    }

    // 合并默认配置
    this.config = {
      merchantId,
      name: String(rawConfig?.name || "东里村智能导游"),
      prompts: {
        system: String(
          (rawConfig?.prompts as Record<string, unknown>)?.system ||
            "你是东里村的智能导游助手，请友好、专业地回答游客的问题。"
        ),
        welcome: String(
          (rawConfig?.prompts as Record<string, unknown>)?.welcome ||
            "您好！欢迎来到东里村，我是智能导游小助手，有什么可以帮您的？"
        ),
        chitchat: String(
          (rawConfig?.prompts as Record<string, unknown>)?.chitchat ||
            "我是导游助手，专门回答景区相关问题哦~"
        ),
        fallback: {
          timeout: "抱歉让您久等了，我需要稍微整理一下思路。",
          error: "系统有点小状况，正在调整中。如需紧急帮助，请联系景区工作人员。",
          notFound: "这个问题有点超出我的知识范围了，建议您咨询景区工作人员。",
          offline: "我有点不舒服，正在休息调整。您的问题我已经记下来啦！",
        },
      },
      dataSource: {
        knowledge: "local",
        hotQuestions: "local",
        config: "local",
      },
      api: {
        apiKey: process.env.ZHIPU_API_KEY || process.env.SILICONFLOW_API_KEY || "test_key",
      },
      cache: {
        enabled: true,
        ttl: 300,
        provider: "dragonfly",
      },
    };

    console.log(
      `[ConfigManager] ✅ 配置加载完成，System Prompt: "${this.config.prompts.system.slice(0, 50)}..."`
    );
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(merchantId?: string): Promise<void> {
    await this.loadConfig(merchantId || this.merchantId);
  }
}

export const configManager = new ConfigManager();
