/**
 * 后台热门问题管理 API 路由
 *
 * 功能：
 * 1. 查看报缺列表（来自Agent D）
 * 2. 添加热门问题
 * 3. 编辑热门问题
 * 4. 删除热门问题
 * 5. 启用/禁用热门问题
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { HotQuestionService } from "../services/hot-question-service";
import { MissingQuestionService } from "../services/missing-question-service";
import { agentD } from "../agents/agent-d";
import { HotQuestion, MissingQuestionRecord } from "../types/hot-questions";

/**
 * 注册热门问题管理路由 (已解构)
 */
export async function registerHotQuestionsRoutes(server: FastifyInstance) {
  // ===== 1. 获取商户热门问题列表 =====
  server.get(
    "/api/merchant/:id/hot-questions",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const merchantId = req.params.id;
        const hotQuestions = await HotQuestionService.load(merchantId);
        reply.send({ success: true, data: hotQuestions });
      } catch {
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // ===== 2. 添加热门问题 =====
  server.post(
    "/api/merchant/:id/hot-questions",
    async (
      req: FastifyRequest<{
        Params: { id: string };
        Body: Partial<HotQuestion>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const merchantId = req.params.id;
        const newHotQuestion = await HotQuestionService.add(merchantId, req.body);
        reply.send({ success: true, data: newHotQuestion });
      } catch {
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // ===== 3. 更新热门问题 =====
  server.put(
    "/api/merchant/:id/hot-questions/:hotId",
    async (
      req: FastifyRequest<{
        Params: { id: string; hotId: string };
        Body: Partial<HotQuestion>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const merchantId = req.params.id;
        const hotId = req.params.hotId;
        const hotQuestions = await HotQuestionService.load(merchantId);
        const index = hotQuestions.hotQuestions.findIndex(h => h.id === hotId);

        if (index === -1) return reply.status(404).send({ error: "Not found" });

        hotQuestions.hotQuestions[index] = {
          ...hotQuestions.hotQuestions[index],
          ...req.body,
          lastUpdated: new Date().toISOString(),
        };

        await HotQuestionService.save(merchantId, hotQuestions);
        reply.send({ success: true, data: hotQuestions.hotQuestions[index] });
      } catch {
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // ===== 4. 删除热门问题 =====
  server.delete(
    "/api/merchant/:id/hot-questions/:hotId",
    async (req: FastifyRequest<{ Params: { id: string; hotId: string } }>, reply: FastifyReply) => {
      try {
        const merchantId = req.params.id;
        const hotId = req.params.hotId;
        const hotQuestions = await HotQuestionService.load(merchantId);
        hotQuestions.hotQuestions = hotQuestions.hotQuestions.filter(h => h.id !== hotId);
        await HotQuestionService.save(merchantId, hotQuestions);
        reply.send({ success: true });
      } catch {
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // ===== 5. 获取报缺列表 (接入 MissingQuestionService) =====
  server.get(
    "/api/merchant/:id/missing-questions",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const merchantId = req.params.id;
        // 获取该商家的报缺统计
        const stats = MissingQuestionService.getStats(merchantId);
        const missingQuestions: MissingQuestionRecord[] = Object.entries(
          stats.missingQuestions
        ).map(
          ([question, d]: [
            string,
            { count: number; firstSeenAt: number; lastSeenAt: number; intentCategory?: string },
          ]) => ({
            question,
            count: d.count,
            firstSeenAt: new Date(d.firstSeenAt).toISOString(),
            lastSeenAt: new Date(d.lastSeenAt).toISOString(),
            status: "pending",
            merchantId,
            intentCategory: d.intentCategory || "OTHER_QUERY",
          })
        );
        reply.send({ success: true, data: missingQuestions });
      } catch {
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // ===== 6. 忽略报缺问题 =====
  server.post(
    "/api/merchant/:id/missing-questions/ignore",
    async (
      req: FastifyRequest<{ Params: { id: string }; Body: { question: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const merchantId = req.params.id;
        // 传入 merchantId 和 question
        agentD.ignoreMissingQuestion(merchantId, req.body.question);
        reply.send({ success: true });
      } catch {
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // ===== 7. 报缺自动聚类建议 (P2-12) =====
  server.get(
    "/api/merchant/:id/missing-questions/clusters",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const clusters = await MissingQuestionService.getClusteringSuggestions(req.params.id);
        reply.send({ success: true, data: clusters });
      } catch {
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
