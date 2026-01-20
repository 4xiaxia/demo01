/**
 * 服务端 Agent A - 输入解析与意图分类
 *
 * 职责：
 * 1. 接收用户输入（语音/文本）
 * 2. 语音转文字（ASR）
 * 3. 意图分类
 * 4. 问题精简
 * 5. 将任务丢入池子并通知B
 *
 * 注意：此文件应放置于服务端(server/agents)，不能被前端打包
 */

import { createMessage } from "../types";
import { anpBus } from "../bus";
import { contextPool } from "../context-pool";
import { speechToText as unifiedSpeechToText } from "../services/api-service";
import { IntentRules, RefinePatterns } from "../config/intent-rules";

interface AgentAOptions {
  asrProvider?: string;
}

class AgentA {
  private name = "A";
  private asrProvider: string;

  constructor(options?: AgentAOptions) {
    this.asrProvider = options?.asrProvider || "zhipu";
  }

  /**
   * 处理用户输入
   */
  async processInput(
    userId: string,
    sessionId: string,
    input: string | Buffer,
    inputType: "text" | "voice",
    merchantId: string
  ) {
    // 生成唯一的跟踪ID，包含商户、用户和时间戳信息
    const traceId = `ticket-${Date.now()}-${merchantId}-${userId}`;

    let text = "";

    if (inputType === "voice") {
      if (!(input instanceof Buffer)) {
        throw new Error("Voice input must be a Buffer");
      }

      text = await this.speechToText(input);
    } else {
      if (typeof input !== "string") {
        throw new Error("Text input must be a string");
      }
      text = input;
    }

    // 意图识别
    const intentCategory = this.classifyIntent(text);

    // 问题精简
    const refinedQuestion = this.refineQuestion(text, intentCategory);

    // 创建任务消息
    const taskMessage = createMessage(
      "A",
      "B",
      merchantId,
      userId,
      sessionId,
      "A_PARSED",
      {
        inputType,
        intentCategory,
        refinedQuestion,
        originalInput: text,
        userId,
        merchantId,
        timestamp: Date.now(),
        ticketId: traceId,
      },
      traceId
    );

    // 写入上下文池 - LPUSH 操作
    await contextPool.addTurn(
      merchantId,
      userId,
      sessionId,
      {
        role: "user",
        content: text,
        refined: refinedQuestion,
        intent: intentCategory,
        inputType,
        timestamp: Date.now(),
        ticketId: traceId,
      },
      traceId
    );

    console.log(
      `[A哥] ✍️ LPUSH 写入用户问题到上下文池 (用户: ${userId}, 商户: ${merchantId}, 流水号: ${traceId})`
    );

    // 将任务丢入ANP总线池子
    await anpBus.publish(taskMessage);

    // 通知B查看池子
    const notifyBMessage = createMessage(
      "A",
      "B",
      merchantId,
      userId,
      sessionId,
      "A_NOTIFY_B",
      {
        type: "check_pool",
        taskId: taskMessage.traceId,
        inputType,
        intentCategory,
        refinedQuestion,
        originalInput: text,
        userId,
        merchantId,
        timestamp: Date.now(),
        ticketId: traceId,
      },
      traceId
    );

    console.log(
      `[A哥] @B 查看池子，有新任务待处理 (用户: ${userId}, 商户: ${merchantId}, 流水号: ${traceId})`
    );
    await anpBus.publish(notifyBMessage);

    // 通知D A处理完成
    const logMsg = createMessage(
      "A",
      "D",
      merchantId,
      userId,
      sessionId,
      "A_COMPLETED",
      {
        success: true,
        inputType,
        intentCategory,
        refinedQuestion,
        timestamp: Date.now(),
        ticketId: traceId,
      },
      traceId
    );

    console.log(`[A哥] 🔔 汇报D: A处理完成 (ID: ${traceId})`);
    await anpBus.publish(logMsg);

    return {
      success: true,
      traceId,
      refinedQuestion,
      intentCategory,
    };
  }

  /**
   * 语音转文字 - 使用统一API服务
   */
  private async speechToText(audioBuffer: Buffer): Promise<string> {
    console.log(`[A哥] 🎤 speechToText 开始, audioSize=${audioBuffer.length}bytes`);

    const result = await unifiedSpeechToText(audioBuffer);

    if (!result.success) {
      console.error(`[A哥] ❌ ASR失败:`, result.error);
      throw new Error(result.error || "ASR failed");
    }

    const text = result.data?.text || "";
    console.log(`[A哥] ✅ ASR识别成功 [${result.provider}]: "${text}"`);
    return text;
  }

  /**
   * 意图分类
   * 
   * 重构说明：已将硬编码的关键词迁移至 config/intent-rules.ts
   * 这样可以方便非技术人员通过配置文件调整识别规则，而无需修改核心代码
   */
  private classifyIntent(text: string): string {
    const lowerText = text.toLowerCase();

    // 1. 闲聊检测 - 支持正则和字符串混合匹配
    if (
      IntentRules.CHITCHAT.some(pattern =>
        pattern instanceof RegExp ? pattern.test(lowerText) : lowerText.includes(String(pattern))
      )
    ) {
      return "CHITCHAT";
    }

    // 2. 价格查询
    if (IntentRules.PRICE_QUERY.some(keyword => lowerText.includes(String(keyword)))) {
      return "PRICE_QUERY";
    }

    // 3. 位置查询
    if (IntentRules.LOCATION_QUERY.some(keyword => lowerText.includes(String(keyword)))) {
      return "LOCATION_QUERY";
    }

    // 4. 时间查询
    if (IntentRules.TIME_QUERY.some(keyword => lowerText.includes(String(keyword)))) {
      return "TIME_QUERY";
    }

    // 5. 设施查询
    if (IntentRules.FACILITY_QUERY.some(keyword => lowerText.includes(String(keyword)))) {
      return "FACILITY_QUERY";
    }

    // 6. 活动查询
    if (IntentRules.EVENT_QUERY.some(keyword => lowerText.includes(String(keyword)))) {
      return "EVENT_QUERY";
    }

    // 其他查询
    return "OTHER_QUERY";
  }

  /**
   * 问题精简
   */
  private refineQuestion(text: string, intent: string): string {
    const pattern = RefinePatterns[intent as keyof typeof RefinePatterns];

    if (pattern) {
      const match = text.match(pattern);
      if (match) {
        const keyword = match[0];
        const before = text.substring(0, match.index!).split(" ").slice(-3).join(" ");
        const after = text
          .substring(match.index! + keyword.length)
          .split(" ")
          .slice(0, 3)
          .join(" ");
        return `${before}${keyword}${after}`.trim();
      }
    }

    // 对于其他类型，去除冗余词语
    return text.replace(/[。.!！？\s]+$/, "").trim();
  }
}

export const agentA = new AgentA();
