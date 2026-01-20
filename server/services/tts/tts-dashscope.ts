/**
 * 🎙️ 阿里云 DashScope TTS 服务
 * 
 * ============================================
 * 📋 基本信息
 * ============================================
 * 提供商：阿里云百炼 DashScope
 * 模型：cosyvoice-v3-flash
 * 协议：HTTP 同步请求
 * 端点：/compatible-mode/v1/audio/speech
 * 
 * ============================================
 * ⭐ 特性评级
 * ============================================
 * 稳定性：⭐⭐⭐⭐⭐ (高)
 * 复杂度：⭐⭐⭐⭐⭐ (简单)
 * 功能性：⭐⭐⭐⭐⭐ (丰富)
 * 推荐度：✅ 优先使用
 * 
 * ============================================
 * 📊 核心参数（基于官方文档 2026-01-16）
 * ============================================
 * 音色：
 *   - 女声：longxiaoxia_v3 (龙小夏 - 沉稳权威女，语音助手场景)
 *   - 男声：longanyang (龙安洋 - 阳光大男孩，社交陪伴标杆音色)
 * 
 * 语速参数：⚠️ rate (不是 speed！)
 *   - 范围：0.5 ~ 2.0
 *   - 默认：1.3
 * 
 * 音量参数：volume
 *   - 范围：0 ~ 100
 *   - 默认：50
 * 
 * 音调参数：pitch
 *   - 范围：0.5 ~ 2.0
 *   - 默认：1.0
 * 
 * 采样率：sample_rate
 *   - 默认：22050 Hz (官方推荐)
 *   - 可选：8000, 16000, 22050, 24000, 48000
 * 
 * 输出格式：mp3
 *   - MIME: audio/mpeg
 *   - 优势：文件小、传输快
 * 
 * ============================================
 * ⚠️ 关键注意事项
 * ============================================
 * 1. 参数名差异：
 *    - ✅ 使用 `rate` 控制语速（阿里云特有）
 *    - ❌ 不要用 `speed`（那是智谱的参数）
 * 
 * 2. 音色命名：
 *    - ✅ v3 版本音色带 `_v3` 后缀
 *    - ❌ 不要用旧版音色名（如 longxiaoxia）
 * 
 * 3. 采样率：
 *    - ✅ 默认 22050 Hz（官方推荐）
 *    - ❌ 不要用 24000 Hz（那是智谱的）
 * 
 * 4. 返回格式：
 *    - ✅ 返回 MP3 格式
 *    - ✅ MIME类型为 audio/mpeg
 *    - ✅ 需要 Base64 编码后返回给前端
 * 
 * ============================================
 * 📦 依赖要求
 * ============================================
 * - ENV.DASHSCOPE_API_KEY 必须配置
 * - 需要 node:buffer 支持
 * 
 * ============================================
 * 🔗 官方文档
 * ============================================
 * API文档：https://help.aliyun.com/zh/dashscope/developer-reference/cosyvoice-tts
 * 示例代码：public/alibabacloud-bailian-speech-demo-master/samples/gallery/cosyvoice-js/
 * 
 * ============================================
 * 💰 计费说明
 * ============================================
 * 价格：1元/万字符
 * 计费单位：字符数（包含标点符号）
 */

import {
  ENV,
  DASHSCOPE_API,
  buildApiUrl,
  isProviderAvailable,
  getTTSConfig,
} from "../../config/api-config";

/**
 * TTS 返回结果类型
 */
export interface TTSResult {
  audioBase64: string;  // Base64 编码的音频数据
  format: string;       // 音频格式 (mp3)
  mimeType: string;     // MIME 类型 (audio/mpeg)
  sampleRate: number;   // 采样率 (22050)
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
 * 阿里云 DashScope TTS 调用
 * 
 * @param text - 待合成的文本（建议 ≤500 字以获得最佳性能）
 * @param voice - 音色选择 ("male" | "female")
 * @returns Promise<ApiCallResult<TTSResult>>
 * 
 * @example
 * ```typescript
 * const result = await callDashScopeTTS("你好世界", "female");
 * if (result.success) {
 *   console.log("音频Base64:", result.data.audioBase64);
 *   console.log("格式:", result.data.format); // "mp3"
 *   console.log("MIME:", result.data.mimeType); // "audio/mpeg"
 * }
 * ```
 */
export async function callDashScopeTTS(
  text: string,
  voice: "male" | "female" = "female"
): Promise<ApiCallResult<TTSResult>> {
  const startTime = Date.now();
  const logPrefix = "[DashScope TTS]";

  // 1. 检查 API Key
  if (!isProviderAvailable("dashscope")) {
    console.error(`${logPrefix} ❌ API Key 未配置`);
    return { 
      success: false, 
      error: "DashScope API key not configured",
      provider: "dashscope"
    };
  }

  try {
    // 2. 获取配置
    const url = buildApiUrl("dashscope", DASHSCOPE_API.endpoints.audioSpeech);
    const ttsConfig = getTTSConfig("dashscope");

    console.log(`${logPrefix} 🚀 开始合成 (${text.length}字, ${voice})`);

    // 3. 构造请求参数
    const requestBody = {
      model: DASHSCOPE_API.models.tts,           // cosyvoice-v3-flash
      input: text,
      voice: DASHSCOPE_API.voices[voice],        // longxiaoxia_v3 或 longanyang
      response_format: ttsConfig.format,         // mp3
      rate: ttsConfig.defaultRate,               // ⚠️ 注意：使用 rate，不是 speed
      volume: ttsConfig.defaultVolume,           // 50
      sample_rate: ttsConfig.sampleRate,         // 22050
    };

    console.log(`${logPrefix} 📋 请求参数:`, {
      model: requestBody.model,
      voice: requestBody.voice,
      rate: requestBody.rate,
      volume: requestBody.volume,
      sample_rate: requestBody.sample_rate,
      text_length: text.length,
    });

    // 4. 发送请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DASHSCOPE_API.timeout);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ENV.DASHSCOPE_API_KEY}`,
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
        provider: "dashscope",
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
        format: ttsConfig.format,           // "mp3"
        mimeType: ttsConfig.mimeType,       // "audio/mpeg"
        sampleRate: ttsConfig.sampleRate,   // 22050
      },
      provider: "dashscope",
      duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} ❌ 调用失败: ${errorMsg}`);
    
    return {
      success: false,
      error: errorMsg,
      provider: "dashscope",
      duration,
    };
  }
}

/**
 * 检查 DashScope TTS 是否可用
 */
export function isDashScopeTTSAvailable(): boolean {
  return isProviderAvailable("dashscope");
}
