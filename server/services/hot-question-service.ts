import fs from "fs/promises";
import { getHotQuestionsPath, getMerchantConfigPath } from "../config/paths";
import { HotQuestion, MerchantHotQuestions } from "../types/hot-questions";
import { agentB } from "../agents/agent-b";
import { configManager } from "../config-manager";

/**
 * 热门问题业务服务
 * 解构热门问题的增删改查逻辑
 */
export class HotQuestionService {
  /**
   * 加载商户热门问题
   */
  static async load(merchantId: string): Promise<MerchantHotQuestions> {
    const config = configManager.getConfig();
    const dataSource = config?.dataSource?.hotQuestions || "local";

    if (dataSource === "mongodb") {
      // TODO: 未来扩展 MongoDB 支持
      return this.loadFromLocal(merchantId);
    }

    return this.loadFromLocal(merchantId);
  }

  /**
   * 从本地文件加载 (内部方法)
   */
  private static async loadFromLocal(merchantId: string): Promise<MerchantHotQuestions> {
    const filePath = getHotQuestionsPath(merchantId);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch {
      return {
        merchantId,
        hotQuestions: [],
        updatedAt: Date.now(),
        version: 1,
      };
    }
  }

  /**
   * 保存热门问题
   * @param merchantId 商户ID
   * @param data 数据
   * @param shouldRefreshCache 是否刷新 Agent B 的缓存（默认 true）
   */
  static async save(merchantId: string, data: MerchantHotQuestions, shouldRefreshCache = true): Promise<void> {
    const dirPath = getMerchantConfigPath(merchantId);
    const filePath = getHotQuestionsPath(merchantId);
    
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    
    // 如果需要且 Agent B 已加载，则刷新其缓存
    if (shouldRefreshCache) {
      await agentB.refreshHotQuestionsCache(merchantId);
    }
  }

  /**
   * 添加热门问题
   */
  static async add(merchantId: string, questionData: Partial<HotQuestion>): Promise<HotQuestion> {
    const hotQuestions = await this.load(merchantId);
    const newId = `hot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    const newHotQuestion: HotQuestion = {
      id: newId,
      question: questionData.question || "",
      keywords: questionData.keywords || [],
      answer: questionData.answer || "",
      hitCount: 0,
      lastUpdated: new Date().toISOString(),
      enabled: true,
      createdAt: new Date().toISOString(),
      source: questionData.source || "manual",
      originalMissingQuestion: questionData.originalMissingQuestion,
    };

    hotQuestions.hotQuestions.push(newHotQuestion);
    hotQuestions.updatedAt = Date.now();
    hotQuestions.version++;

    await this.save(merchantId, hotQuestions);
    return newHotQuestion;
  }

  /**
   * 增加命中次数 (不刷新缓存，保证性能)
   */
  static async incrementHit(merchantId: string, hotId: string): Promise<void> {
    try {
      const data = await this.load(merchantId);
      const hot = data.hotQuestions.find(h => h.id === hotId);
      if (hot) {
        hot.hitCount = (hot.hitCount || 0) + 1;
        data.updatedAt = Date.now();
        // 关键：命中次数更新不刷新 B 的缓存，避免性能抖动
        await this.save(merchantId, data, false);
      }
    } catch (error) {
      console.error("[HotQuestionService] 累加命中失败:", error);
    }
  }
}
