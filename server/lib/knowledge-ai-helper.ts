/**
 * Agent C 的 AI 助手 - 帮助商户整理知识库
 *
 * 核心价值：
 * 1. 让不懂技术的商户也能用AI
 * 2. 用小模型(Qwen3-8)降低成本
 * 3. 3步上手，所见即所得
 *
 * 使用场景：
 * - 商户复制粘贴文字
 * - AI自动提取关键词、分类、标题
 */

interface StructuredKnowledge {
  title: string;
  content: string;
  keywords: string[];
  category: "price" | "info" | "service" | "route" | "facility";
  isHot: boolean;
  weight: number;
}

// 定义 API 响应的类型
interface SiliconFlowResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * 使用硅基流动 Qwen3-8 整理知识
 *
 * 为什么用Qwen3-8?
 * 1. 免费 (有余额)
 * 2. 中文理解好
 * 3. 小模型够用 (不需要GPT-4)
 */
export async function structureKnowledgeWithAI(rawText: string): Promise<StructuredKnowledge> {
  const apiKey = process.env.SILICONFLOW_API_KEY || "";

  if (!apiKey) {
    throw new Error("SILICONFLOW_API_KEY not configured");
  }

  // 构建Prompt - 让AI理解商户的意图
  const systemPrompt = `你是一个知识库整理助手，帮助景区商户整理知识条目。

你的任务：
1. 提取标题（简短，≤10字）
2. 整理内容（规范化，保留关键信息）
3. 提取关键词（5-10个，用户可能会问的词）
4. 判断分类：
   - price: 价格、收费、门票
   - info: 一般信息、介绍
   - service: 服务、设施
   - route: 路线、交通
   - facility: 设施、场所
5. 判断是否热门（常见问题）

请以JSON格式返回，格式：
{
  "title": "标题",
  "content": "整理后的内容",
  "keywords": ["关键词1", "关键词2", ...],
  "category": "分类",
  "isHot": true/false,
  "weight": 1.0-2.0
}`;

  const userPrompt = `请整理以下内容：

${rawText}`;

  try {
    const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "Qwen/Qwen2.5-7B-Instruct", // 使用Qwen2.5-7B (免费)
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3, // 低温度，保证稳定输出
        max_tokens: 1000,
        response_format: { type: "json_object" }, // 强制JSON输出
      }),
    });

    if (!response.ok) {
      throw new Error(`SiliconFlow API Error: ${response.status}`);
    }

    const data = await response.json() as SiliconFlowResponse;
    
    // 验证响应数据结构
    if (
      !data ||
      typeof data !== 'object' ||
      !data.choices ||
      !Array.isArray(data.choices) ||
      data.choices.length === 0 ||
      typeof data.choices[0] !== 'object' ||
      !data.choices[0].message ||
      typeof data.choices[0].message !== 'object' ||
      typeof data.choices[0].message.content !== 'string'
    ) {
      throw new Error("API响应数据格式不正确");
    }

    const content = data.choices[0].message.content;

    if (!content) {
      throw new Error("AI返回内容为空");
    }

    // 解析JSON
    const structured = JSON.parse(content) as StructuredKnowledge;

    // 验证必填字段
    if (!structured.title || !structured.content || !structured.keywords) {
      throw new Error("AI返回的数据不完整");
    }

    console.log("[Agent C AI助手] ✅ 知识整理完成:", structured.title);

    return structured;
  } catch (error) {
    console.error("[Agent C AI助手] ❌ 整理失败:", error);
    // 抛出错误而不是静默处理，保持函数签名的一致性
    throw error;
  }
}
