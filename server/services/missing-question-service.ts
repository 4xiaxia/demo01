import { agentD } from "../agents/agent-d";
import { KnowledgeService } from "./knowledge-service";

/**
 * 报缺问题服务
 * 负责从未匹配问题到知识库的转化流程解构
 *
 * 商家隔离设计（2026-01-20更新）：
 * - 所有方法都需要传入 merchantId 参数
 */
export class MissingQuestionService {
  /**
   * 获取指定商家的报缺统计
   */
  static getStats(merchantId?: string) {
    return agentD.getStats(merchantId);
  }

  /**
   * 将报缺问题转化为知识条目并自动忽略原记录
   */
  static async convertToKnowledge(
    merchantId: string,
    question: string,
    knowledgeData: {
      content: string;
      category: "price" | "info" | "service" | "route" | "facility";
      keywords: string[];
    }
  ) {
    // 1. 构造新知识项
    const newItem = {
      id: `k_from_missing_${Date.now()}`,
      name: question,
      content: knowledgeData.content,
      keywords: knowledgeData.keywords,
      category: knowledgeData.category,
      enabled: true,
      isHot: true, // 报缺转来的通常建议设为热门
      weight: 1.2,
    };

    // 2. 存入知识库
    const success = await KnowledgeService.append(merchantId, newItem);

    // 3. 如果成功，从报缺列表中移除/忽略
    if (success) {
      agentD.ignoreMissingQuestion(merchantId, question);
    }

    return success;
  }

  /**
   * AI 自动聚类建议 (P2-12 核心解构)
   * 将大量报缺问题聚类，识别出商户最迫切需要补充的知识点
   */
  static async getClusteringSuggestions(merchantId: string) {
    console.log(`[MissingQuestionService] 为商户 ${merchantId} 执行AI聚类分析...`);
    // 获取商家的报缺统计
    const stats = agentD.getStats(merchantId);
    const questions = Object.keys(stats.missingQuestions);

    if (questions.length < 3) return [];

    // 这里未来可以接入 AI 进行语义聚类
    // 目前先按意图分类进行基础聚类解构
    const clusters: Record<string, string[]> = {};
    questions.forEach(q => {
      const intent = stats.missingQuestions[q].intentCategory || "OTHER";
      if (!clusters[intent]) clusters[intent] = [];
      clusters[intent].push(q);
    });

    return Object.entries(clusters).map(([intent, list]) => ({
      intent,
      count: list.length,
      questions: list,
      suggestedAction: this.getSuggestedAction(intent),
    }));
  }

  /**
   * 根据聚类意图给出建议动作
   */
  private static getSuggestedAction(intent: string): string {
    const actions: Record<string, string> = {
      PRICE_QUERY: "建议补充：详细价格表、优惠政策、学生/老人票价",
      FACILITY_QUERY: "建议补充：厕所位置、母婴室、充电宝分布、停车场信息",
      ROUTE_QUERY: "建议补充：景区建议路线、游览时长、最佳拍照点",
      OTHER_QUERY: "建议：人工审核这些零散问题，提取关键词",
    };
    return actions[intent] || "建议管理员核实该意图下的常见提问";
  }
}
