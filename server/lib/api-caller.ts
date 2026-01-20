/**
 * 统一API调用工具
 *
 * 功能：
 * - 统一错误处理
 * - 统一日志记录
 * - 统一超时控制 (30s)
 * - 统一重试机制 (1次)
 * 
 * ========================================
 * 🎤 ASR (语音识别) API
 * ========================================
 * 1. callDashScopeASR() - 阿里云 Paraformer-v2 (主用)
 *    - 文档: https://help.aliyun.com/zh/model-studio/user-guide/paraformer-real-time
 *    - 格式: Base64编码音频
 * 
 * 2. callZhipuASR() - 智谱 GLM-ASR-2512 (备用)
 *    - 文档: https://open.bigmodel.cn/dev/api#audio
 *    - 格式: FormData (multipart)
 * 
 * ========================================
 * 🔊 TTS (语音合成) API
 * ========================================
 * 1. callDashScopeTTS() - 阿里云 CosyVoice-v2 (主用)
 *    - 文档: https://help.aliyun.com/zh/model-studio/user-guide/cosyvoice
 *    - 格式: MP3
 *    - 音色: longxiaochun_v2(男), longxiaoxia_v2(女)
 * 
 * 2. callZhipuTTS() - 智谱 GLM-TTS (备用)
 *    - 文档: https://open.bigmodel.cn/dev/api#tts
 *    - 格式: WAV
 *    - 音色: male(男), female(女)
 * 
 * ========================================
 * 🤖 Chat (对话) API
 * ========================================
 * 1. callSiliconFlowChat() - SiliconFlow Qwen2.5-7B (主用，免费)
 *    - 文档: https://docs.siliconflow.cn/
 *    - 特点: ✅ 完全免费，70+开源模型
 * 
 * 2. callZhipuChat() - 智谱 GLM-4-Flash (备用，付费)
 *    - 文档: https://open.bigmodel.cn/dev/api#glm-4
 *    - 特点: 高速响应，32k上下文
 * 
 * ========================================
 * 🏪 商家配置关联
 * ========================================
 * 配置文件位置：
 * - 本地: public/data/{merchantId}/config.json
 * - 云端: MongoDB merchants 集合
 * 
 * 后台管理页面：
 * - /admin/config - 配置生成器，可选择ASR/TTS服务商
 * - PUT /api/merchant/:id/config - 保存配置
 * 
 * 商家可配置选项：
 * - apiSource: 'custom' | 'system' - 自己的Key or 系统默认Key
 * - asr.provider: 'zhipu' | 'aliyun' - 选择ASR服务商
 * - tts.provider: 'zhipu' | 'aliyun' | 'microsoft' - 选择TTS服务商
 * - asr.apiKey / tts.apiKey - 自定义API Key
 * 
 * 注意：
 * - 商家配置修改后会影响 Agent A (语音识别) 和 Server TTS端点
 * - 但当前实现为：统一使用环境变量中的API Key
 * - 未来可扩展：根据 merchantId 动态加载商家自有Key
 * 
 * ========================================
 * ⚠️ 注意事项
 * ========================================
 * - 所有API Key必须在服务端管理，不能暴露到前端
 * - 优先级: 阿里云/SiliconFlow(免费) > 智谱(备选)
 * - 超时设置: 30秒
 * - 重试次数: 1次
 * - API Key来源: process.env.环境变量 (当前) OR 商家配置 (未来)
 */

interface ApiCallOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string | FormData;
  timeout?: number;
  retries?: number;
  logPrefix?: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * 统一API调用函数
 */
export async function callAPI<T = unknown>(options: ApiCallOptions): Promise<ApiResponse<T>> {
  const {
    url,
    method = "POST",
    headers = {},
    body,
    timeout = 30000,
    retries = 0,
    logPrefix = "[API]",
  } = options;

  const startTime = Date.now();
  console.log(`${logPrefix} 🚀 ${method} ${url}`);

  let lastError: Error | null = null;

  // 重试逻辑
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      console.log(`${logPrefix} 🔄 重试第 ${attempt} 次...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 指数退避
    }

    try {
      // 创建AbortController用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      console.log(`${logPrefix} ⏱️  响应时间: ${duration}ms, 状态码: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${logPrefix} ❌ API错误 (${response.status}):`, errorText);

        return {
          success: false,
          error: `API返回错误: ${response.status} - ${errorText}`,
          statusCode: response.status,
        };
      }

      // 解析响应
      const contentType = response.headers.get("content-type");
      let data: T;

      if (contentType?.includes("application/json")) {
        data = (await response.json()) as T;
      } else {
        data = (await response.text()) as T;
      }

      console.log(`${logPrefix} ✅ 调用成功`);
      return {
        success: true,
        data,
        statusCode: response.status,
      };
    } catch (error) {
      lastError = error as Error;

      if ((error as Error).name === "AbortError") {
        console.error(`${logPrefix} ⏰ 请求超时 (${timeout}ms)`);
      } else {
        console.error(`${logPrefix} ❌ 请求失败:`, error);
      }

      // 如果还有重试次数，继续
      if (attempt < retries) {
        continue;
      }
    }
  }

  // 所有重试都失败
  return {
    success: false,
    error: lastError?.message || "未知错误",
  };
}

/**
 * 阿里云 DashScope ASR (语音识别) API调用
 * 
 * 模型：paraformer-realtime-v2 (实时语音识别推荐版本)
 * 官方文档：https://help.aliyun.com/zh/model-studio/paraformer-real-time-speech-recognition-java-sdk
 * 
 * 特点：
 * - 支持中英文混合识别及多语种（日语、韩语、德语、法语、俄语）
 * - 支持多种中文方言（粤语、闽南语、东北话、四川话等）
 * - 实时流式识别能力
 * - 自动标点符号和逆文本正则化（ITN）
 * - 支持任意采样率
 * - 格式：Base64编码音频
 * 
 * 可用模型：
 * - paraformer-realtime-v2: 推荐，适用于直播、会议等场景
 * - paraformer-realtime-8k-v2: 8kHz音频，适用于电话客服场景
 * 
 * @param audioBuffer WAV音频Buffer
 * @param apiKey 阿里云DashScope API Key (环境变量: DASHSCOPE_API_KEY)
 * @param model 模型名称，默认 "paraformer-realtime-v2"
 * @returns {Promise<ApiResponse<{ text: string }>>} 识别的文本
 */
export async function callDashScopeASR(
  audioBuffer: Buffer,
  apiKey: string,
  model = "paraformer-realtime-v2"
): Promise<ApiResponse<{ text: string }>> {
  const base64Audio = audioBuffer.toString("base64");

  const result = await callAPI({
    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/audio/transcriptions",
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      file: `data:audio/wav;base64,${base64Audio}`,
    }),
    timeout: 30000,
    retries: 1,
    logPrefix: "[DashScope ASR]",
  });

  if (!result.success) {
    return { success: false, error: result.error, statusCode: result.statusCode };
  }

  // 提取文本
  const data = result.data as {
    text?: string;
    output?: { text?: string; sentence?: { text?: string }[] };
  };
  const text = data.text || data.output?.text || data.output?.sentence?.[0]?.text || "";

  return {
    success: true,
    data: { text },
    statusCode: result.statusCode,
  };
}

/**
 * 智谱 GLM ASR (语音识别) API调用
 * 
 * 模型：GLM-ASR-2512 (语音识别)
 * 官方文档：https://open.bigmodel.cn/dev/api#audio
 * 
 * 特点：
 * - 支持多种音频格式 (wav/mp3/m4a/flac)
 * - 自动语音活动检测
 * - 格式：FormData (multipart/form-data)
 * 
 * @param audioBuffer WAV音频Buffer
 * @param apiKey 智谱API Key (环境变量: ZHIPU_API_KEY)
 * @returns {Promise<ApiResponse<{ text: string }>>} 识别的文本
 */
export async function callZhipuASR(
  audioBuffer: Buffer,
  apiKey: string
): Promise<ApiResponse<{ text: string }>> {
  const { Blob } = await import("node:buffer");
  const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });

  const formData = new FormData();
  formData.append("model", "glm-asr-2512");
  formData.append("file", audioBlob as unknown as File, "recording.wav");

  const result = await callAPI({
    url: "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions",
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
    timeout: 30000,
    retries: 1,
    logPrefix: "[智谱 ASR]",
  });

  if (!result.success) {
    return { success: false, error: result.error, statusCode: result.statusCode };
  }

  // 提取文本
  const data = result.data as { text?: string };
  const text = typeof data.text === "string" ? data.text : "";

  return {
    success: true,
    data: { text },
    statusCode: result.statusCode,
  };
}

/**
 * 阿里云 DashScope TTS (语音合成) API调用
 * 
 * 模型：CosyVoice-v3-flash (推荐，性价比高)
 * 官方文档：https://help.aliyun.com/zh/model-studio/cosyvoice-java-sdk
 * 
 * 特点：
 * - 自然流畅的语音合成
 * - 多音色支持
 * - 输出格式：MP3
 * - 文本限制：20000字符
 * 
 * 可用模型：
 * - cosyvoice-v3-plus: 最佳质量（2元/万字符）
 * - cosyvoice-v3-flash: 性价比高（1元/万字符）- 推荐
 * - cosyvoice-v2: 旧版本（2元/万字符）
 * 
 * 可用音色（v3系列）：
 * - longxiaochun: 男声 (阳光活力)
 * - longanyang: 男声 (稳重磁性)
 * - longxiaoxia: 女声 (温柔亲切)
 * - longwan: 女声 (成熟知性)
 * - longshuoshuo: 女声 (活泼开朗)
 * 
 * @param text 要合成的文本 (最大20000字符)
 * @param apiKey 阿里云DashScope API Key (环境变量: DASHSCOPE_API_KEY)
 * @param voice 音色名称，默认 "longxiaoxia" (女声)
 * @param model 模型名称，默认 "cosyvoice-v3-flash"
 * @returns {Promise<ApiResponse<{ audioBase64: string }>>} Base64编码的MP3音频
 */
export async function callDashScopeTTS(
  text: string,
  apiKey: string,
  voice = "longxiaoxia",
  model = "cosyvoice-v3-flash"
): Promise<ApiResponse<{ audioBase64: string }>> {
  try {
    // 创建AbortController用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: "mp3",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `DashScope TTS错误: ${response.status}` };
    }

    // ArrayBuffer 转 Base64
    const arrayBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");
    console.log(`[DashScope TTS] ✅ 成功 (${(arrayBuffer.byteLength / 1024).toFixed(1)}KB)`);

    return {
      success: true,
      data: { audioBase64 },
      statusCode: response.status,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 智谱 GLM TTS (语音合成) API调用
 * 
 * 模型：GLM-TTS (语音合成)
 * 官方文档：https://open.bigmodel.cn/dev/api#tts
 * 
 * 特点：
 * - 情感丰富的语音合成
 * - 语速可调节 (0.5-2.0)
 * - 输出格式：WAV
 * 
 * 可用音色：
 * - male: 男声
 * - female: 女声
 * 
 * @param text 要合成的文本 (建议500字符以内，最大约4000字符)
 * @param apiKey 智谱API Key (环境变量: ZHIPU_API_KEY)
 * @param voice 音色，默认 "female"
 * @param speed 语速，默认 1.2 (范围: 0.5-2.0)
 * @returns {Promise<ApiResponse<{ audioBase64: string }>>} Base64编码的WAV音频
 */
export async function callZhipuTTS(
  text: string,
  apiKey: string,
  voice = "female",
  speed = 1.2
): Promise<ApiResponse<{ audioBase64: string }>> {
  try {
    // 创建AbortController用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "glm-tts",
        input: text,
        voice,
        speed,
        response_format: "wav",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `智谱TTS错误: ${response.status}` };
    }

    // ArrayBuffer 转 Base64
    const arrayBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");
    console.log(`[智谱 TTS] ✅ 成功 (${(arrayBuffer.byteLength / 1024).toFixed(1)}KB)`);

    return {
      success: true,
      data: { audioBase64 },
      statusCode: response.status,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * SiliconFlow Chat API调用 (免费)
 * 
 * 模型：Qwen/Qwen2.5-7B-Instruct (通义千问)
 * 官方文档：https://docs.siliconflow.cn/
 * 
 * 特点：
 * - ✅ 完全免费，无数据传输成本
 * - 支持70+开源模型
 * - OpenAI兼容格式
 * - 适合作为主要Chat接口
 * 
 * 可用模型：
 * - Qwen/Qwen2.5-7B-Instruct: 通用对话 (默认)
 * - deepseek-ai/DeepSeek-V2.5: 代码和推理
 * - meta-llama/Llama-3.1-70B-Instruct: 强推理
 * 
 * @param messages 对话消息数组
 * @param apiKey SiliconFlow API Key (环境变量: SILICONFLOW_API_KEY)
 * @param model 模型名称，默认 "Qwen/Qwen2.5-7B-Instruct"
 * @returns {Promise<ApiResponse<{ content: string }>>} AI回复内容
 */
export async function callSiliconFlowChat(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  model = "Qwen/Qwen2.5-7B-Instruct"
): Promise<ApiResponse<{ content: string }>> {
  const result = await callAPI({
    url: "https://api.siliconflow.cn/v1/chat/completions",
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 512,
    }),
    timeout: 30000,
    retries: 1,
    logPrefix: "[SiliconFlow Chat]",
  });

  if (!result.success) {
    return { success: false, error: result.error, statusCode: result.statusCode };
  }

  // 提取文本
  const data = result.data as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content || "";

  return {
    success: true,
    data: { content },
    statusCode: result.statusCode,
  };
}

/**
 * 智谱 GLM Chat API调用 (付费)
 * 
 * 模型：GLM-4-Flash (高速通用模型)
 * 官方文档：https://open.bigmodel.cn/dev/api#glm-4
 * 
 * 特点：
 * - 高速响应 (Flash版本)
 * - 支持32k上下文长度
 * - 中文优化
 * - 付费但价格亲民
 * - 适合作为备选Chat接口
 * 
 * 可用模型：
 * - glm-4-flash: 高速版 (默认)
 * - glm-4: 完整版 (更强能力)
 * - glm-4-plus: 增强版 (最强)
 * 
 * @param messages 对话消息数组
 * @param apiKey 智谱API Key (环境变量: ZHIPU_API_KEY)
 * @param model 模型名称，默认 "glm-4-flash"
 * @returns {Promise<ApiResponse<{ content: string }>>} AI回复内容
 */
export async function callZhipuChat(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  model = "glm-4-flash"
): Promise<ApiResponse<{ content: string }>> {
  const result = await callAPI({
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 512,
    }),
    timeout: 30000,
    retries: 1,
    logPrefix: "[智谱 Chat]",
  });

  if (!result.success) {
    return { success: false, error: result.error, statusCode: result.statusCode };
  }

  // 提取文本
  const data = result.data as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content || "";

  return {
    success: true,
    data: { content },
    statusCode: result.statusCode,
  };
}
