/**
 * 🔧 统一API调用服务
 *
 * 所有外部API调用的统一入口
 * - 统一错误处理
 * - 统一日志记录
 * - 自动重试
 * - 自动降级
 */

import {
  ENV,
  DASHSCOPE_API,
  ZHIPU_API,
  SILICONFLOW_API,
  ApiProvider,
  buildApiUrl,
  isProviderAvailable,
  getTTSConfig,
} from "../config/api-config";

interface ApiCallResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  provider?: ApiProvider;
  duration?: number;
}

/**
 * 基础API调用函数
 */
async function callApi<T>(
  url: string,
  options: RequestInit,
  logPrefix: string,
  timeout = 30000
): Promise<ApiCallResult<T>> {
  const startTime = Date.now();
  console.log(`${logPrefix} 🚀 ${options.method || "GET"} ${url}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${logPrefix} ❌ 错误 (${response.status}): ${errorText}`);
      return { success: false, error: `${response.status}: ${errorText}`, duration };
    }

    const contentType = response.headers.get("content-type");
    let data: T;

    if (contentType?.includes("application/json")) {
      data = (await response.json()) as T;
    } else if (contentType?.includes("audio/")) {
      data = (await response.arrayBuffer()) as unknown as T;
    } else {
      data = (await response.text()) as unknown as T;
    }

    console.log(`${logPrefix} ✅ 成功 (${duration}ms)`);
    return { success: true, data, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} ❌ 失败: ${errorMsg}`);
    return { success: false, error: errorMsg, duration };
  }
}

// ============ ASR 语音识别 ============

interface ASRResult {
  text: string;
}

/**
 * 阿里云DashScope ASR
 * 使用兼容模式的OpenAI格式接口
 */
async function asrDashScope(audioBuffer: Buffer): Promise<ApiCallResult<ASRResult>> {
  if (!isProviderAvailable("dashscope")) {
    return { success: false, error: "DashScope API key not configured" };
  }

  const { Blob } = await import("node:buffer");
  const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });

  const formData = new FormData();
  formData.append("model", DASHSCOPE_API.models.asr);
  formData.append("file", audioBlob as unknown as File, "audio.wav");

  const url = buildApiUrl("dashscope", DASHSCOPE_API.endpoints.audioTranscription);

  const result = await callApi<{ text?: string }>(
    url,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.DASHSCOPE_API_KEY}` },
      body: formData,
    },
    "[DashScope ASR]",
    DASHSCOPE_API.timeout
  );

  if (!result.success) {
    return { success: false, error: result.error, provider: "dashscope", duration: result.duration };
  }

  const text = result.data?.text || "";
  return { success: true, data: { text }, provider: "dashscope", duration: result.duration };
}

/**
 * 智谱GLM ASR
 */
async function asrZhipu(audioBuffer: Buffer): Promise<ApiCallResult<ASRResult>> {
  if (!isProviderAvailable("zhipu")) {
    return { success: false, error: "Zhipu API key not configured" };
  }

  const { Blob } = await import("node:buffer");
  const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });

  const formData = new FormData();
  formData.append("model", ZHIPU_API.models.asr);
  formData.append("file", audioBlob as unknown as File, "recording.wav");

  const url = buildApiUrl("zhipu", ZHIPU_API.endpoints.audioTranscription);

  const result = await callApi<{ text?: string }>(
    url,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.ZHIPU_API_KEY}` },
      body: formData,
    },
    "[智谱 ASR]",
    ZHIPU_API.timeout
  );

  if (!result.success) {
    return { success: false, error: result.error, provider: "zhipu", duration: result.duration };
  }

  const text = result.data?.text || "";
  return { success: true, data: { text }, provider: "zhipu", duration: result.duration };
}

/**
 * 统一ASR调用 (自动选择最佳提供商)
 */
export async function speechToText(audioBuffer: Buffer): Promise<ApiCallResult<ASRResult>> {
  console.log(`[ASR] 🎤 开始语音识别 (${(audioBuffer.length / 1024).toFixed(1)}KB)`);

  // 尝试DashScope
  const dashResult = await asrDashScope(audioBuffer);
  if (dashResult.success) return dashResult;

  // 降级到智谱
  console.log("[ASR] ⚠️ DashScope失败，尝试智谱...");
  const zhipuResult = await asrZhipu(audioBuffer);
  if (zhipuResult.success) return zhipuResult;

  return { success: false, error: "所有ASR服务均不可用" };
}

// ============ TTS 语音合成 ============

interface TTSResult {
  audioBase64: string;
  format: string;
  mimeType: string;
  sampleRate: number;
}

/**
 * 阿里云DashScope TTS
 */
async function ttsDashScope(
  text: string,
  voice: "male" | "female" = "female"
): Promise<ApiCallResult<TTSResult>> {
  if (!isProviderAvailable("dashscope")) {
    return { success: false, error: "DashScope API key not configured" };
  }

  const url = buildApiUrl("dashscope", DASHSCOPE_API.endpoints.audioSpeech);
  const ttsConfig = getTTSConfig("dashscope");

  const result = await callApi<ArrayBuffer>(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DASHSCOPE_API.models.tts,
        input: text,
        voice: DASHSCOPE_API.voices[voice],
        response_format: ttsConfig.format,
        rate: ttsConfig.defaultRate, // 语速参数
        volume: ttsConfig.defaultVolume, // 音量参数
        sample_rate: ttsConfig.sampleRate, // 采样率
      }),
    },
    "[DashScope TTS]",
    DASHSCOPE_API.timeout
  );

  if (!result.success || !result.data) {
    return { success: false, error: result.error || "No audio data", provider: "dashscope", duration: result.duration };
  }

  const audioBase64 = Buffer.from(result.data).toString("base64");
  return {
    success: true,
    data: { 
      audioBase64, 
      format: ttsConfig.format,
      mimeType: ttsConfig.mimeType,
      sampleRate: ttsConfig.sampleRate,
    },
    provider: "dashscope",
    duration: result.duration,
  };
}

/**
 * 智谱GLM TTS
 */
async function ttsZhipu(
  text: string,
  voice: "male" | "female" = "female"
): Promise<ApiCallResult<TTSResult>> {
  if (!isProviderAvailable("zhipu")) {
    return { success: false, error: "Zhipu API key not configured" };
  }

  const url = buildApiUrl("zhipu", ZHIPU_API.endpoints.audioSpeech);
  const ttsConfig = getTTSConfig("zhipu");

  const result = await callApi<ArrayBuffer>(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.ZHIPU_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ZHIPU_API.models.tts,
        input: text,
        voice: ZHIPU_API.voices[voice],
        speed: ttsConfig.defaultRate, // 智谱使用speed参数
        response_format: ttsConfig.format,
      }),
    },
    "[智谱 TTS]",
    ZHIPU_API.timeout
  );

  if (!result.success || !result.data) {
    return { success: false, error: result.error || "No audio data", provider: "zhipu", duration: result.duration };
  }

  const audioBase64 = Buffer.from(result.data).toString("base64");
  return {
    success: true,
    data: { 
      audioBase64, 
      format: ttsConfig.format,
      mimeType: ttsConfig.mimeType,
      sampleRate: ttsConfig.sampleRate,
    },
    provider: "zhipu",
    duration: result.duration,
  };
}

/**
 * 统一TTS调用 (自动选择最佳提供商)
 */
export async function textToSpeech(
  text: string,
  voice: "male" | "female" = "female"
): Promise<ApiCallResult<TTSResult>> {
  console.log(`[TTS] 🔊 开始语音合成 (${text.length}字)`);

  // 尝试DashScope
  const dashResult = await ttsDashScope(text, voice);
  if (dashResult.success) return dashResult;

  // 降级到智谱
  console.log("[TTS] ⚠️ DashScope失败，尝试智谱...");
  const zhipuResult = await ttsZhipu(text, voice);
  if (zhipuResult.success) return zhipuResult;

  return { success: false, error: "所有TTS服务均不可用" };
}

// ============ Chat AI对话 ============

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResult {
  content: string;
  model: string;
}

/**
 * 硅基流动 Chat
 */
async function chatSiliconFlow(messages: ChatMessage[]): Promise<ApiCallResult<ChatResult>> {
  if (!isProviderAvailable("siliconflow")) {
    return { success: false, error: "SiliconFlow API key not configured" };
  }

  const url = buildApiUrl("siliconflow", SILICONFLOW_API.endpoints.chatCompletion);

  const result = await callApi<{ choices?: { message?: { content?: string } }[] }>(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.SILICONFLOW_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SILICONFLOW_API.models.chat,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    },
    "[SiliconFlow Chat]",
    SILICONFLOW_API.timeout
  );

  if (!result.success) {
    return { success: false, error: result.error, provider: "siliconflow", duration: result.duration };
  }

  const content = result.data?.choices?.[0]?.message?.content || "";
  return {
    success: true,
    data: { content, model: SILICONFLOW_API.models.chat },
    provider: "siliconflow",
    duration: result.duration,
  };
}

/**
 * 智谱GLM Chat
 */
async function chatZhipu(messages: ChatMessage[]): Promise<ApiCallResult<ChatResult>> {
  if (!isProviderAvailable("zhipu")) {
    return { success: false, error: "Zhipu API key not configured" };
  }

  const url = buildApiUrl("zhipu", ZHIPU_API.endpoints.chatCompletion);

  const result = await callApi<{ choices?: { message?: { content?: string } }[] }>(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.ZHIPU_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ZHIPU_API.models.chat,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    },
    "[智谱 Chat]",
    ZHIPU_API.timeout
  );

  if (!result.success) {
    return { success: false, error: result.error, provider: "zhipu", duration: result.duration };
  }

  const content = result.data?.choices?.[0]?.message?.content || "";
  return {
    success: true,
    data: { content, model: ZHIPU_API.models.chat },
    provider: "zhipu",
    duration: result.duration,
  };
}

/**
 * 统一Chat调用 (自动选择最佳提供商)
 */
export async function chatCompletion(messages: ChatMessage[]): Promise<ApiCallResult<ChatResult>> {
  console.log(`[Chat] 💬 发送对话请求 (${messages.length}条消息)`);

  // 尝试SiliconFlow
  const sfResult = await chatSiliconFlow(messages);
  if (sfResult.success) return sfResult;

  // 降级到智谱
  console.log("[Chat] ⚠️ SiliconFlow失败，尝试智谱...");
  const zhipuResult = await chatZhipu(messages);
  if (zhipuResult.success) return zhipuResult;

  return { success: false, error: "所有Chat服务均不可用" };
}

// ============ API状态检查 ============

export function checkApiStatus(): Record<string, boolean> {
  return {
    dashscope: isProviderAvailable("dashscope"),
    zhipu: isProviderAvailable("zhipu"),
    siliconflow: isProviderAvailable("siliconflow"),
  };
}
