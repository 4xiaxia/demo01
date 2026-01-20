/**
 * 🎤 智谱 GLM ASR 服务
 * 
 * ============================================
 * 📋 基本信息
 * ============================================
 * 提供商：智谱 AI (GLM)
 * 模型：glm-asr-2512
 * 协议：HTTP FormData 同步请求
 * 端点：/api/paas/v4/audio/transcriptions
 * 
 * ============================================
 * ⭐ 特性评级
 * ============================================
 * 稳定性：⭐⭐⭐⭐⭐ (非常高)
 * 复杂度：⭐⭐⭐⭐⭐ (非常简单)
 * 功能性：⭐⭐⭐ (基础但够用)
 * 推荐度：✅✅✅ 优先使用（最稳方案）
 * 
 * ============================================
 * 📊 核心参数
 * ============================================
 * 输入方式：FormData 直接上传文件 ✅
 *   - ⚠️ 不支持 URL
 *   - ⚠️ 不支持 Base64
 *   - ✅ 支持 Blob/File
 * 
 * 支持格式：
 *   - wav, mp3, flac, ogg, m4a, aac, webm
 *   - 推荐：wav (最稳定)
 * 
 * 时长限制：≤60秒 ⚠️
 *   - 超过会报错
 *   - 适合短语音场景
 * 
 * 语言支持：仅中文
 *   - ❌ 不支持多语种
 *   - ❌ 不支持方言
 * 
 * 返回结果：
 *   - 纯文本（text字段）
 *   - 同步返回（无需轮询）
 * 
 * ============================================
 * ⚠️ 关键注意事项
 * ============================================
 * 1. 输入方式：
 *    - ✅ 必须用 FormData.append('file', audioBlob)
 *    - ❌ 不能用 JSON body
 *    - ❌ 不能用 file_urls（那是阿里云的方式）
 * 
 * 2. 时长限制：
 *    - ✅ 仅支持 ≤60秒 音频
 *    - ❌ 超过60秒会失败
 *    - 💡 适合对话、语音输入场景
 * 
 * 3. 调用流程：
 *    - ✅ 一次请求直接返回结果（同步）
 *    - ❌ 无需轮询（不像阿里云批量转写）
 *    - ⚡ 响应快速
 * 
 * 4. 语言限制：
 *    - ✅ 仅支持中文
 *    - ❌ 不支持英文/日文等
 *    - ❌ 不支持方言识别
 * 
 * 5. 文件大小：
 *    - 建议 <10MB
 *    - 超过可能超时
 * 
 * ============================================
 * 📦 依赖要求
 * ============================================
 * - ENV.ZHIPU_API_KEY 必须配置
 * - 需要 node:buffer 支持（创建 Blob）
 * 
 * ============================================
 * 🔗 官方文档
 * ============================================
 * API文档：https://open.bigmodel.cn/dev/api/audio/asr
 * 
 * ============================================
 * 💰 计费说明
 * ============================================
 * 价格：未明确公开
 * 计费单位：未明确
 * 
 * ============================================
 * 🆚 与阿里云 WebSocket ASR 对比
 * ============================================
 * 智谱 HTTP ASR 优势：
 *   - ✅ 实现超级简单（一次HTTP请求）
 *   - ✅ 稳定性高（无需管理连接）
 *   - ✅ 同步返回（无需轮询）
 *   - ✅ 无需 OSS 存储
 *   - ✅ 适合短语音
 * 
 * 智谱 HTTP ASR 劣势：
 *   - ❌ 时长限制 ≤60秒
 *   - ❌ 仅支持中文
 *   - ❌ 不支持实时流式
 *   - ❌ 不支持说话人分离
 * 
 * 阿里云 WebSocket ASR 优势：
 *   - ✅ 无时长限制
 *   - ✅ 支持多语种/方言
 *   - ✅ 支持实时流式
 *   - ✅ 支持说话人分离
 * 
 * 阿里云 WebSocket ASR 劣势：
 *   - ❌ 实现复杂（WebSocket管理）
 *   - ❌ 需要 OSS 或公网 URL
 *   - ❌ 需要轮询或流式处理
 *   - ❌ 稳定性需要测试
 * 
 * ============================================
 * 💡 使用场景建议
 * ============================================
 * ✅ 适合智谱 HTTP ASR：
 *   - 对话语音输入（<60秒）
 *   - 语音指令识别
 *   - 短音频转文字
 *   - 中文识别
 *   - 快速原型开发
 * 
 * ⚠️ 不适合智谱 HTTP ASR：
 *   - 长音频（>60秒）
 *   - 会议录音
 *   - 多语种识别
 *   - 方言识别
 *   - 需要实时流式的场景
 */

import {
  ENV,
  ZHIPU_API,
  buildApiUrl,
  isProviderAvailable,
} from "../../config/api-config";

/**
 * ASR 返回结果类型
 */
export interface ASRResult {
  text: string;         // 识别出的文本
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
 * 智谱 GLM ASR 调用
 * 
 * @param audioBuffer - 音频文件 Buffer（WAV 格式推荐）
 * @returns Promise<ApiCallResult<ASRResult>>
 * 
 * @example
 * ```typescript
 * const audioBuffer = fs.readFileSync('audio.wav');
 * const result = await callZhipuASR(audioBuffer);
 * if (result.success) {
 *   console.log("识别结果:", result.data.text);
 * }
 * ```
 * 
 * ⚠️ 注意事项：
 * 1. 音频时长必须 ≤60秒
 * 2. 仅支持中文识别
 * 3. 推荐使用 WAV 格式
 * 4. 同步返回，无需轮询
 */
export async function callZhipuASR(audioBuffer: Buffer): Promise<ApiCallResult<ASRResult>> {
  const startTime = Date.now();
  const logPrefix = "[智谱 ASR]";

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
    const audioSizeKB = (audioBuffer.length / 1024).toFixed(1);
    console.log(`${logPrefix} 🚀 开始识别 (${audioSizeKB}KB)`);

    // 2. 检查文件大小（建议 <10MB）
    if (audioBuffer.length > 10 * 1024 * 1024) {
      console.warn(`${logPrefix} ⚠️ 文件较大 (${audioSizeKB}KB)，可能超时`);
    }

    // 3. 创建 FormData
    const { Blob } = await import("node:buffer");
    const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });
    
    const formData = new FormData();
    formData.append("model", ZHIPU_API.models.asr);  // glm-asr-2512
    formData.append("file", audioBlob as unknown as File, "recording.wav");

    console.log(`${logPrefix} 📋 请求参数:`, {
      model: ZHIPU_API.models.asr,
      file_size: `${audioSizeKB}KB`,
      file_name: "recording.wav",
    });

    // 4. 发送请求
    const url = buildApiUrl("zhipu", ZHIPU_API.endpoints.audioTranscription);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ZHIPU_API.timeout);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ENV.ZHIPU_API_KEY}`,
        // ⚠️ 注意：不要设置 Content-Type，FormData 会自动设置
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    // 5. 检查响应
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${logPrefix} ❌ API 错误 (${response.status}): ${errorText}`);
      
      // 特殊错误提示
      if (response.status === 400 && errorText.includes("duration")) {
        return {
          success: false,
          error: "音频时长超过60秒限制，请使用更短的音频",
          provider: "zhipu",
          duration,
        };
      }
      
      return {
        success: false,
        error: `${response.status}: ${errorText}`,
        provider: "zhipu",
        duration,
      };
    }

    // 6. 解析结果
    const data = await response.json() as { text?: string };
    const text = data?.text || "";

    if (!text) {
      console.warn(`${logPrefix} ⚠️ 识别结果为空`);
    }

    console.log(`${logPrefix} ✅ 识别成功 (${duration}ms, ${text.length}字)`);
    console.log(`${logPrefix} 📝 结果预览: ${text.slice(0, 50)}${text.length > 50 ? "..." : ""}`);

    // 7. 返回结果
    return {
      success: true,
      data: { text },
      provider: "zhipu",
      duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} ❌ 调用失败: ${errorMsg}`);
    
    // 特殊错误提示
    if (errorMsg.includes("abort")) {
      return {
        success: false,
        error: "请求超时，音频可能过长或网络问题",
        provider: "zhipu",
        duration,
      };
    }
    
    return {
      success: false,
      error: errorMsg,
      provider: "zhipu",
      duration,
    };
  }
}

/**
 * 检查智谱 ASR 是否可用
 */
export function isZhipuASRAvailable(): boolean {
  return isProviderAvailable("zhipu");
}

/**
 * 验证音频是否符合智谱 ASR 要求
 * 
 * @param audioBuffer - 音频 Buffer
 * @returns 验证结果 { valid: boolean, reason?: string }
 * 
 * @example
 * ```typescript
 * const validation = validateAudioForZhipuASR(audioBuffer);
 * if (!validation.valid) {
 *   console.error("音频不符合要求:", validation.reason);
 * }
 * ```
 */
export function validateAudioForZhipuASR(audioBuffer: Buffer): { valid: boolean; reason?: string } {
  // 检查文件大小
  const sizeInMB = audioBuffer.length / (1024 * 1024);
  if (sizeInMB > 10) {
    return {
      valid: false,
      reason: `文件过大 (${sizeInMB.toFixed(1)}MB)，建议 <10MB`,
    };
  }

  // 估算时长（粗略估计，假设 WAV 格式，16000Hz，16bit）
  // 实际应该解析 WAV header
  const estimatedDurationSec = audioBuffer.length / (16000 * 2);
  if (estimatedDurationSec > 60) {
    return {
      valid: false,
      reason: `音频时长可能超过60秒限制 (估计 ${estimatedDurationSec.toFixed(1)}s)`,
    };
  }

  return { valid: true };
}
