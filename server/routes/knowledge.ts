/**
 * 知识库管理API路由
 *
 * 功能：
 * 1. 获取知识库列表
 * 2. 保存知识库
 * 3. AI智能整理
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { KnowledgeService, KnowledgeItem } from "../services/knowledge-service";
import { detectKnowledgeConflicts } from "../lib/knowledge-ai-helper";

/**
 * 注册知识库管理路由
 */
export async function registerKnowledgeRoutes(server: FastifyInstance) {
  // ===== 1. 获取知识库列表 =====
  server.get(
    "/api/merchant/:id/knowledge",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const merchantId = req.params.id;
        const knowledge = await KnowledgeService.load(merchantId);

        reply.send({
          success: true,
          data: knowledge,
        });
      } catch (error) {
        console.error("获取知识库失败:", error);
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // ===== 2. 保存知识库 =====
  server.put(
    "/api/merchant/:id/knowledge",
    async (
      req: FastifyRequest<{
        Params: { id: string };
        Body: { knowledge: KnowledgeItem[] };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const merchantId = req.params.id;
        const body = req.body as { knowledge?: KnowledgeItem[]; items?: KnowledgeItem[] };
        const knowledge = body.knowledge || body.items;

        if (!knowledge || !Array.isArray(knowledge)) {
          return reply.status(400).send({ error: "Invalid knowledge data" });
        }

        const success = await KnowledgeService.save(merchantId, knowledge);

        reply.send({
          success,
          message: success ? "知识库保存成功" : "保存失败",
        });
      } catch (error) {
        console.error("保存知识库失败:", error);
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // ===== 3. AI智能整理 =====
  server.post(
    "/api/merchant/:id/knowledge/ai-organize",
    async (
      req: FastifyRequest<{
        Params: { id: string };
        Body: { rawText: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { rawText } = req.body;

        if (!rawText) {
          return reply.status(400).send({ error: "Missing rawText" });
        }

        // 尝试使用AI整理
        try {
          const { structureKnowledgeWithAI } = await import("../lib/knowledge-ai-helper");
          const organized = await structureKnowledgeWithAI(rawText);

          console.log(`[KnowledgeAPI] ✅ AI整理成功: ${organized.title}`);

          reply.send({
            success: true,
            data: {
              name: organized.title,
              content: organized.content,
              keywords: organized.keywords,
              category: organized.category === "price" ? "price" : "info",
              enabled: true,
              isHot: organized.isHot,
              weight: organized.weight,
            },
          });
        } catch (aiError) {
          console.error("[KnowledgeAPI] ⚠️ AI整理失败，使用简单整理:", aiError);

          // 降级：使用简单整理
          const organized = {
            name: rawText.slice(0, 20).replace(/\n/g, " "),
            content: rawText.trim(),
            keywords: extractKeywordsSimple(rawText),
            category: "info",
            enabled: true,
            isHot: false,
            weight: 1.0,
          };

          reply.send({
            success: true,
            data: organized,
            fallback: true, // 标记使用了降级逻辑
            message: "AI服务暂不可用，使用简单整理",
          });
        }
      } catch (error) {
        console.error("AI整理失败:", error);
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // ===== 4. 冲突/重复性检查 =====
  server.post(
    "/api/merchant/:id/knowledge/check-conflicts",
    async (
      req: FastifyRequest<{
        Params: { id: string };
        Body: { newItem: { title: string; content: string } };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const merchantId = req.params.id;
        const { newItem } = req.body;

        // 加载现有知识库
        const existingKnowledge = await KnowledgeService.load(merchantId);

        // 调用AI进行检测
        const conflicts = await detectKnowledgeConflicts(newItem, existingKnowledge);

        reply.send({
          success: true,
          conflicts,
        });
      } catch (error) {
        console.error("冲突检测失败:", error);
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}

/**
 * 简单关键词提取
 */
function extractKeywordsSimple(text: string): string[] {
  const commonWords = ["门票", "价格", "多少钱", "开放", "时间", "地址", "路线", "交通"];
  const keywords: string[] = [];

  for (const word of commonWords) {
    if (text.includes(word)) {
      keywords.push(word);
    }
  }

  return keywords.length > 0 ? keywords : ["信息"];
}
