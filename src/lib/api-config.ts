/// <reference types="vite/client" />

/**
 * AI API 配置 (Secure Client Version)
 *
 * 修改说明：
 * 1. 移除了前端直接的 API Key 引用 (安全！)
 * 2. 所有请求转发给本地 Server (/api/...)
 * 3. 保持了函数签名一致，兼容原有代码
 * 4. 增强了主备API切换逻辑，提高可靠性
 */

// ============ API 配置 ============

export type ApiProvider = "siliconflow" | "dashscope" | "zhipu";

export interface ApiConfig {
  provider: ApiProvider;
  // baseUrl 此时指向本地代理或者留空
  description?: string;
  model: string;
}

// 默认配置（只保留必要的前端展示信息，敏感信息在 Server）
export const SILICONFLOW_CONFIG: ApiConfig = {
  provider: "siliconflow",
  model: "Qwen/Qwen2.5-7B-Instruct",
  description: "硅基流动",
};
export const DASHSCOPE_CONFIG: ApiConfig = {
  provider: "dashscope",
  model: "qwen-turbo",
  description: "阿里云通义",
};
export const ZHIPU_CONFIG: ApiConfig = {
  provider: "zhipu",
  model: "glm-4-flash",
  description: "智谱清言",
};

// 主备API配置
export const PRIMARY_CONFIG = SILICONFLOW_CONFIG; // 主API（免费）
export const SECONDARY_CONFIG = ZHIPU_CONFIG; // 备用API（付费）

export const CURRENT_CONFIG: ApiConfig = PRIMARY_CONFIG;

// ============ API 调用工具函数 ============

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  success: boolean;
  content?: string;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 调用AI聊天接口 -> 转发给 Server
 */
export async function chatCompletion(
  messages: ChatMessage[],
  config: ApiConfig = CURRENT_CONFIG
): Promise<ChatResponse> {
  try {
    console.log(`🤖 调用AI (Via Server)...`);

    // 请求本地 Server，不带 Key
    const response = await fetch(`/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: config.provider, // 告诉 Server 用哪家
        model: config.model,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return {
      success: true,
      content: data.choices?.[0]?.message?.content || "",
      usage: data.usage,
    };
  } catch (error) {
    console.error(`❌ API调用异常:`, error);

    // 如果使用的是主API且失败，尝试备用API
    if (config.provider === PRIMARY_CONFIG.provider) {
      console.log("🔄 尝试使用备用API");
      return chatCompletion(messages, SECONDARY_CONFIG);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 简单问答（单轮对话）
 */
export async function askAI(
  question: string,
  systemPrompt: string = "你是一个智能助手，请简洁准确地回答用户问题。",
  config: ApiConfig = CURRENT_CONFIG
): Promise<string> {
  const result = await chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
    config
  );

  if (result.success && result.content) {
    return result.content;
  }

  throw new Error(result.error || "AI服务不可用");
}

// ============ TTS 配置 (Via Server) ============

export const TTS_CONFIG = {
  defaultVoice: "female",
  defaultSpeed: 1.2,
  defaultVolume: 1.0,
};

export interface TTSResponse {
  success: boolean;
  audioBase64?: string;
  error?: string;
}

/**
 * 文字转语音（TTS）-> 转发给 Server
 */
export async function textToSpeech(
  text: string,
  options?: { voice?: string; speed?: number }
): Promise<TTSResponse> {
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: text,
        voice: options?.voice || TTS_CONFIG.defaultVoice,
        speed: options?.speed || TTS_CONFIG.defaultSpeed,
      }),
    });

    if (!response.ok) throw new Error(`TTS Server Error: ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    return { success: true, audioBase64: base64 };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown" };
  }
}

// ============ ASR (暂时保留前端调用，Server待实现) ============
// 注意：为了完整安全性，后续应将此也移至 Server
export interface ASRResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export const ASR_CONFIG = {
  url: "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions",
  model: "glm-asr-2512",
  // ⚠️ 临时妥协：这里还得用 Key，否则语音无法识别。
  // 建议后续在 Server 实现 /api/asr
  get apiKey() {
    return (import.meta.env.VITE_ZHIPU_API_KEY as string) || "";
  },
};

export async function speechToText(audioFile: File | Blob): Promise<ASRResponse> {
  try {
    if (!ASR_CONFIG.apiKey) {
      return { success: false, error: "ASR需要配置VITE_ZHIPU_API_KEY (目前暂未走Server代理)" };
    }

    const mimeType = audioFile.type || "audio/webm";
    let extension = "webm";
    if (mimeType.includes("wav")) extension = "wav";

    const fileName = `recording.${extension}`;
    const formData = new FormData();
    formData.append("model", ASR_CONFIG.model);
    formData.append("file", audioFile, fileName);

    const response = await fetch(ASR_CONFIG.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ASR_CONFIG.apiKey}` },
      body: formData,
    });

    if (!response.ok) throw new Error(await response.text());
    const data = (await response.json()) as { text?: string };

    return { success: true, text: data.text || "" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown" };
  }
}
