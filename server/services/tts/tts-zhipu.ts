/**
 * 🎙️ 智谱 GLM TTS 服务
 * 
 * ============================================
 * 📋 基本信息
 * ============================================
 * 提供商：智谱 AI (GLM)
 * 模型：glm-tts
 * 协议：HTTP 同步请求
 * 端点：/api/paas/v4/audio/speech
 * 
 * ============================================
 * ⭐ 特性评级
 * ============================================
 * 稳定性：⭐⭐⭐⭐⭐ (高)
 * 复杂度：⭐⭐⭐⭐⭐ (简单)
 * 功能性：⭐⭐⭐ (基础)
 * 推荐度：✅ 备用方案
 * 
 * ============================================
 * 📊 核心参数
 * ============================================
 * 音色：
 *   - 女声：female (简单标识符)
 *   - 男声：male (简单标识符)
 * 
 * 语速参数：⚠️ speed (不是 rate！)
 *   - 范围：0.5 ~ 2.0
 *   - 默认：1.3
 * 
 * 音量参数：❌ 不支持
 * 音调参数：❌ 不支持
 * 
 * 采样率：固定 24000 Hz
 *   - 不可配置
 * 
 * 输出格式：wav
 *   - MIME: audio/wav
 *   - 特点：音质好但文件大
 * 
 * ============================================
 * ⚠️ 关键注意事项
 * ============================================
 * 1. 参数名差异：
 *    - ✅ 使用 `speed` 控制语速（智谱特有）
 *    - ❌ 不要用 `rate`（那是阿里云的参数）
 * 
 * 2. 音色命名：
 *    - ✅ 使用简单标识符 "female" / "male"
 *    - ❌ 不要用阿里云的音色名（如 longxiaoxia_v3）
 * 
 * 3. 采样率：
 *    - ✅ 固定 24000 Hz
 *    - ❌ 无法自定义
 * 
 * 4. 功能限制：
 *    - ❌ 不支持音量调节
 *    - ❌ 不支持音调调节
 *    - ❌ 不支持 Instruct 功能
 * 
 * 5. 返回格式：
 *    - ✅ 返回 WAV 格式
 *    - ✅ MIME类型为 audio/wav
 *    - ⚠️ 文件较大（相比 MP3）
 * 
 * ============================================
 * 📦 依赖要求
 * ============================================
 * - ENV.ZHIPU_API_KEY 必须配置
 * - 需要 node:buffer 支持
 * 
 * ============================================
 * 🔗 官方文档
 * ============================================
 * API文档：https://open.bigmodel.cn/dev/api/audio/tts
 * 
 * ============================================
 * 💰 计费说明
 * ============================================
 * 价格：未明确公开
 * 计费单位：未明确
 * 
 * ============================================
 * 🆚 与阿里云对比
 * ============================================
 * 优势：
 *   - 参数更简单
 *   - 配置更少
 *   - 易于使用
 * 
 * 劣势：
 *   - 功能较少（无音量/音调控制）
 *   - 文件较大（WAV vs MP3）
 *   - 音色选择少
 */

import {
  ENV,
  ZHIPU_API,
  buildApiUrl,
  isProviderAvailable,
  getTTSConfig,
} from "../../config/api-config";

/**
 * TTS 返回结果类型
 */
export interface TTSResult {
  audioBase64: string;  // Base64 编码的音频数据
  format: string;       // 音频格式 (wav)
  mimeType: string;     // MIME 类型 (audio/wav)
  sampleRate: number;   // 采样率 (24000)
}

/**
 * API 调用结果类型
 */
export interface ApiCallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  provider?: string;
  duration?: number;
}

/**
 * 智谱 GLM TTS 调用
 * 
 * @param text - 待合成的文本（建议 ≤500 字以获得最佳性能）
 * @param voice - 音色选择 ("male" | "female")
 * @returns Promise<ApiCallResult<TTSResult>>
 * 
 * @example
 * ```typescript
 * const result = await callZhipuTTS("你好世界", "female");
 * if (result.success) {
 *   console.log("音频Base64:", result.data.audioBase64);
 *   console.log("格式:", result.data.format); // "wav"
 *   console.log("MIME:", result.data.mimeType); // "audio/wav"
 * }
 * ```
 */
export async function callZhipuTTS(
  text: string,
  voice: "male" | "female" = "female"
): Promise<ApiCallResult<TTSResult>> {
  const startTime = Date.now();
  const logPrefix = "[智谱 TTS]";

  // 1. 检查 API Key
  if (!isProviderAvailable("zhipu")) {
    console.error(`${logPrefix} ❌ API Key 未配置`);
    return { 
      success: false, 
      error: "Zhipu API key not configured",
      provider: "zhipu"
    };
  }

  try {
    // 2. 获取配置
    const url = buildApiUrl("zhipu", ZHIPU_API.endpoints.audioSpeech);
    const ttsConfig = getTTSConfig("zhipu");

    console.log(`${logPrefix} 🚀 开始合成 (${text.length}字, ${voice})`);

    // 3. 构造请求参数
    const requestBody = {
      model: ZHIPU_API.models.tts,              // glm-tts
      input: text,
      voice: ZHIPU_API.voices[voice],           // "female" 或 "male"
      speed: ttsConfig.defaultRate,             // ⚠️ 注意：使用 speed，不是 rate
      response_format: ttsConfig.format,        // wav
    };

    console.log(`${logPrefix} 📋 请求参数:`, {
      model: requestBody.model,
      voice: requestBody.voice,
      speed: requestBody.speed,
      format: requestBody.response_format,
      text_length: text.length,
    });

    // 4. 发送请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ZHIPU_API.timeout);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ENV.ZHIPU_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    // 5. 检查响应
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${logPrefix} ❌ API 错误 (${response.status}): ${errorText}`);
      return {
        success: false,
        error: `${response.status}: ${errorText}`,
        provider: "zhipu",
        duration,
      };
    }

    // 6. 读取音频数据
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    console.log(`${logPrefix} ✅ 合成成功 (${duration}ms, ${(audioBuffer.byteLength / 1024).toFixed(1)}KB)`);

    // 7. 返回结果
    return {
      success: true,
      data: {
        audioBase64,
        format: ttsConfig.format,           // "wav"
        mimeType: ttsConfig.mimeType,       // "audio/wav"
        sampleRate: ttsConfig.sampleRate,   // 24000
      },
      provider: "zhipu",
      duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} ❌ 调用失败: ${errorMsg}`);
    
    return {
      success: false,
      error: errorMsg,
      provider: "zhipu",
      duration,
    };
  }
}

/**
 * 检查智谱 TTS 是否可用
 */
export function isZhipuTTSAvailable(): boolean {
  return isProviderAvailable("zhipu");
}
