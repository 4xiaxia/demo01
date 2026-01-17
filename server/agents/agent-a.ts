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
import { configManager } from "../config-manager";

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
   * 语音转文字
   */
  private async speechToText(audioBuffer: Buffer): Promise<string> {
    const config = configManager.getConfig();
    const apiKey = config?.api?.apiKey;

    if (!apiKey) {
      throw new Error("ASR API key not configured");
    }

    // 转换buffer为base64
    const base64 = audioBuffer.toString("base64");

    try {
      // 使用配置的ASR提供商
      if (this.asrProvider === "zhipu") {
        const response = await fetch("https://open.bigmodel.cn/api/paas/v4/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file: base64,
            model: "whisper-medium",
          }),
        });

        if (!response.ok) {
          throw new Error(`ASR request failed: ${response.statusText}`);
        }

        const data = (await response.json()) as unknown;

        // 验证响应数据结构后再访问text属性
        if (data && typeof data === "object" && "text" in data) {
          return typeof data.text === "string" ? data.text : "";
        }
        return "";
      } else {
        // 其他ASR提供商的实现
        throw new Error(`Unsupported ASR provider: ${this.asrProvider}`);
      }
    } catch (error) {
      console.error("ASR failed:", error);
      throw error;
    }
  }

  /**
   * 意图分类
   */
  private classifyIntent(text: string): string {
    const lowerText = text.toLowerCase();

    // 闲聊检测
    const chitchatPatterns = [
      /^(你好|hi|hello|嗨)/i,
      /^(在吗|在不在)/i,
      /今天.*天气/,
      /聊天/,
      /闲聊/,
      /^ok/,
      /^嗯$/,
      /^啊$/,
      /^哦$/,
      /^嗯.*啊/,
      /随便聊聊/,
      /你好.*助手/,
      /您好/,
      /早上好/,
      /下午好/,
      /晚上好/,
      /中午好/,
    ];

    if (chitchatPatterns.some(pattern => pattern.test(lowerText))) {
      return "CHITCHAT";
    }

    // 价格查询
    const priceKeywords = [
      "多少钱",
      "价格",
      "收费",
      "费用",
      "票",
      "门票",
      "票价",
      "优惠",
      "打折",
      "折扣",
    ];
    if (priceKeywords.some(keyword => lowerText.includes(keyword))) {
      return "PRICE_QUERY";
    }

    // 位置查询
    const locationKeywords = [
      "在哪",
      "位置",
      "地址",
      "怎么去",
      "路线",
      "交通",
      "导航",
      "方向",
      "地方",
      "哪里",
    ];
    if (locationKeywords.some(keyword => lowerText.includes(keyword))) {
      return "LOCATION_QUERY";
    }

    // 时间查询
    const timeKeywords = [
      "什么时候",
      "时间",
      "几点",
      "几点钟",
      "营业",
      "开放",
      "关闭",
      "截止",
      "开始",
      "结束",
      "多久",
      "时期",
      "季节",
    ];
    if (timeKeywords.some(keyword => lowerText.includes(keyword))) {
      return "TIME_QUERY";
    }

    // 设施查询
    const facilityKeywords = [
      "厕所",
      "卫生间",
      "洗手间",
      "餐厅",
      "食堂",
      "商店",
      "超市",
      "医务室",
      "休息",
      "座椅",
      "充电桩",
      "停车场",
    ];
    if (facilityKeywords.some(keyword => lowerText.includes(keyword))) {
      return "FACILITY_QUERY";
    }

    // 活动查询
    const eventKeywords = [
      "活动",
      "表演",
      "演出",
      "节目",
      "特色",
      "节日",
      "庆典",
      "展览",
      "展会",
      "比赛",
    ];
    if (eventKeywords.some(keyword => lowerText.includes(keyword))) {
      return "EVENT_QUERY";
    }

    // 其他查询
    return "OTHER_QUERY";
  }

  /**
   * 问题精简
   */
  private refineQuestion(text: string, intent: string): string {
    // 使用块级作用域解决case声明问题
    if (intent === "PRICE_QUERY") {
      const priceMatch = text.match(/(多少钱|价格|收费|费用|票|门票|票价|优惠|打折|折扣)/);
      if (priceMatch) {
        const keyword = priceMatch[0];
        const before = text.substring(0, priceMatch.index!).split(" ").slice(-3).join(" ");
        const after = text
          .substring(priceMatch.index! + keyword.length)
          .split(" ")
          .slice(0, 3)
          .join(" ");
        return `${before}${keyword}${after}`.trim();
      }
    } else if (intent === "LOCATION_QUERY") {
      const locationMatch = text.match(/(在哪|位置|地址|怎么去|路线|交通|导航|方向|地方|哪里)/);
      if (locationMatch) {
        const keyword = locationMatch[0];
        const before = text.substring(0, locationMatch.index!).split(" ").slice(-3).join(" ");
        const after = text
          .substring(locationMatch.index! + keyword.length)
          .split(" ")
          .slice(0, 3)
          .join(" ");
        return `${before}${keyword}${after}`.trim();
      }
    } else if (intent === "TIME_QUERY") {
      const timeMatch = text.match(
        /(什么时候|时间|几点|几点钟|营业|开放|关闭|截止|开始|结束|多久|时期|季节)/
      );
      if (timeMatch) {
        const keyword = timeMatch[0];
        const before = text.substring(0, timeMatch.index!).split(" ").slice(-3).join(" ");
        const after = text
          .substring(timeMatch.index! + keyword.length)
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
