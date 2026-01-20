/**
 * 🔧 API配置中心
 *
 * 所有API端点、密钥、配置的唯一真相来源
 * Single Source of Truth for all API configurations
 */

// ============ 环境变量 ============
export const ENV = {
  // AI服务商密钥
  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || "",
  ZHIPU_API_KEY: process.env.ZHIPU_API_KEY || "",
  SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY || "",

  // 服务配置
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3000", 10),
} as const;

// ============ API端点配置 ============

/**
 * 阿里云DashScope API配置
 */
export const DASHSCOPE_API = {
  baseUrl: "https://dashscope.aliyuncs.com",
  endpoints: {
    // 兼容模式（OpenAI格式）
    chatCompletion: "/compatible-mode/v1/chat/completions",
    audioTranscription: "/compatible-mode/v1/audio/transcriptions",
    audioSpeech: "/compatible-mode/v1/audio/speech",

    // 原生模式
    nativeASR: "/api/v1/services/audio/asr/transcription",
    nativeTTS: "/api/v1/services/audio/tts/synthesis",
  },
  models: {
    chat: "qwen-turbo",
    asr: "paraformer-realtime-v2",
    tts: "cosyvoice-v3-flash",
  },
  voices: {
    female: "longxiaoxia_v3", // 龙小夏 - 沉稳权威女（语音助手场景）
    male: "longanyang", // 龙安洋 - 阳光大男孩（社交陪伴标杆音色）
  },
  // TTS特性参数（基于官方文档 2026-01-16）
  tts: {
    format: "mp3" as const, // 输出格式
    mimeType: "audio/mpeg" as const, // MIME类型
    sampleRate: 22050, // 采样率 (Hz) - 官方默认值
    defaultRate: 1.3, // 默认语速 (参数名为rate)
    rateRange: [0.5, 2.0] as const, // 语速范围
    defaultVolume: 50, // 默认音量
    volumeRange: [0, 100] as const, // 音量范围
    defaultPitch: 1.0, // 默认音调
    pitchRange: [0.5, 2.0] as const, // 音调范围
  },
  timeout: 30000,
} as const;

/**
 * 智谱GLM API配置
 */
export const ZHIPU_API = {
  baseUrl: "https://open.bigmodel.cn",
  endpoints: {
    chatCompletion: "/api/paas/v4/chat/completions",
    audioTranscription: "/api/paas/v4/audio/transcriptions",
    audioSpeech: "/api/paas/v4/audio/speech",
  },
  models: {
    chat: "glm-4-flash",
    asr: "glm-asr-2512",
    tts: "glm-tts",
  },
  voices: {
    female: "female",
    male: "male",
  },
  // TTS特性参数
  tts: {
    format: "wav" as const, // 输出格式
    mimeType: "audio/wav" as const, // MIME类型
    sampleRate: 24000, // 采样率 (Hz)
    defaultRate: 1.3, // 默认语速
    rateRange: [0.5, 2.0] as const, // 语速范围
    defaultVolume: 50, // 默认音量
    volumeRange: [0, 100] as const, // 音量范围
    defaultPitch: 1.0, // 默认音调
    pitchRange: [0.5, 2.0] as const, // 音调范围
  },
  timeout: 30000,
} as const;

/**
 * 硅基流动 SiliconFlow API配置
 */
export const SILICONFLOW_API = {
  baseUrl: "https://api.siliconflow.cn",
  endpoints: {
    chatCompletion: "/v1/chat/completions",
    audioSpeech: "/v1/audio/speech",
  },
  models: {
    chat: "Qwen/Qwen2.5-7B-Instruct",
  },
  timeout: 30000,
} as const;

/**
 * 内部API路由配置
 */
export const INTERNAL_API = {
  // 聊天相关
  chat: "/api/chat",
  processInput: "/api/process-input",
  pollResponse: "/api/poll-response",

  // 语音相关
  tts: "/api/tts",

  // 统计相关
  statsInput: "/api/stats/input",

  // 用户相关
  userEnter: "/api/user-enter",

  // 商户相关
  merchantConfig: (merchantId: string) => `/api/merchant/${merchantId}/config`,
  merchantKnowledge: (merchantId: string) => `/api/merchant/${merchantId}/knowledge`,
  merchantKnowledgeAI: (merchantId: string) => `/api/merchant/${merchantId}/knowledge/ai-organize`,
  merchantHotQuestions: (merchantId: string) => `/api/merchant/${merchantId}/hot-questions`,
  merchantMissingQuestions: (merchantId: string) => `/api/merchant/${merchantId}/missing-questions`,

  // 监控相关
  monitorSystem: "/api/monitor/system",
  monitorStats: "/api/monitor/stats",
  monitorLogs: "/api/monitor/logs",
  monitorTrace: (traceId: string) => `/api/monitor/trace/${traceId}`,
} as const;

/**
 * API提供商类型
 */
export type ApiProvider = "dashscope" | "zhipu" | "siliconflow";

/**
 * API优先级配置
 * 根据可用性和性能自动选择
 */
export const API_PRIORITY = {
  chat: ["siliconflow", "zhipu", "dashscope"] as ApiProvider[],
  asr: ["dashscope", "zhipu"] as ApiProvider[],
  tts: ["dashscope", "zhipu"] as ApiProvider[],
} as const;

/**
 * 获取可用的API密钥
 */
export function getAvailableApiKeys(): Record<ApiProvider, string> {
  return {
    dashscope: ENV.DASHSCOPE_API_KEY,
    zhipu: ENV.ZHIPU_API_KEY,
    siliconflow: ENV.SILICONFLOW_API_KEY,
  };
}

/**
 * 检查API提供商是否可用
 */
export function isProviderAvailable(provider: ApiProvider): boolean {
  const keys = getAvailableApiKeys();
  return !!keys[provider];
}

/**
 * 获取首选的可用提供商
 */
export function getPreferredProvider(service: keyof typeof API_PRIORITY): ApiProvider | null {
  const priorities = API_PRIORITY[service];
  for (const provider of priorities) {
    if (isProviderAvailable(provider)) {
      return provider;
    }
  }
  return null;
}

/**
 * 构建完整的API URL
 */
export function buildApiUrl(provider: ApiProvider, endpoint: string): string {
  const configs = {
    dashscope: DASHSCOPE_API,
    zhipu: ZHIPU_API,
    siliconflow: SILICONFLOW_API,
  };

  const config = configs[provider];
  return `${config.baseUrl}${endpoint}`;
}

/**
 * 获取TTS配置（根据提供商）
 */
export function getTTSConfig(provider: ApiProvider): {
  format: string;
  mimeType: string;
  sampleRate: number;
  defaultRate: number;
  rateRange: readonly [number, number];
  defaultVolume: number;
  volumeRange: readonly [number, number];
  defaultPitch: number;
  pitchRange: readonly [number, number];
} {
  const configs = {
    dashscope: DASHSCOPE_API.tts,
    zhipu: ZHIPU_API.tts,
    siliconflow: DASHSCOPE_API.tts, // 降级到阿里云
  };
  return configs[provider] || ZHIPU_API.tts;
}
export function getApiHeaders(
  provider: ApiProvider,
  contentType = "application/json"
): Record<string, string> {
  const keys = getAvailableApiKeys();
  const apiKey = keys[provider];

  if (!apiKey) {
    throw new Error(`API key not configured for provider: ${provider}`);
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": contentType,
  };
}
