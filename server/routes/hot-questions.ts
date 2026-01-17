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
import fs from "fs/promises";
import path from "path";
import type {
  HotQuestion,
  MerchantHotQuestions,
  MissingQuestionRecord,
} from "../types/hot-questions";

/**
 * 注册热门问题管理路由
 */
export async function registerHotQuestionsRoutes(server: FastifyInstance) {
  // ===== 1. 获取商户热门问题列表 =====
  server.get(
    "/api/merchant/:id/hot-questions",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const merchantId = req.params.id;
        const hotQuestions = await loadHotQuestions(merchantId);

        reply.send({
          success: true,
          data: hotQuestions,
        });
      } catch (error) {
        console.error("获取热门问题失败:", error);
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
        Body: {
          question: string;
          keywords: string[];
          answer: string;
          source: "manual" | "from_missing";
          originalMissingQuestion?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const merchantId = req.params.id;
        const { question, keywords, answer, source, originalMissingQuestion } = req.body;

        console.log(`[HotQuestions] 添加热门问题请求:`, {
          merchantId,
          question,
          keywords,
          answer,
          source,
        });

        // 验证必填字段
        if (!question || !keywords || !answer) {
          console.log(`[HotQuestions] ❌ 缺少必填字段`);
          return reply.status(400).send({ error: "Missing required fields" });
        }

        const hotQuestions = await loadHotQuestions(merchantId);

        // 生成新ID
        const newId = `hot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        const newHotQuestion: HotQuestion = {
          id: newId,
          question,
          keywords,
          answer,
          hitCount: 0,
          lastUpdated: new Date().toISOString(),
          enabled: true,
          createdAt: new Date().toISOString(),
          source,
          originalMissingQuestion,
        };

        hotQuestions.hotQuestions.push(newHotQuestion);
        hotQuestions.updatedAt = Date.now();
        hotQuestions.version++;

        await saveHotQuestions(merchantId, hotQuestions);

        console.log(`[HotQuestions] ✅ 热门问题添加成功: ${newId}`);

        reply.send({
          success: true,
          data: newHotQuestion,
        });
      } catch (error) {
        console.error("添加热门问题失败:", error);
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
        const updates = req.body;

        const hotQuestions = await loadHotQuestions(merchantId);
        const index = hotQuestions.hotQuestions.findIndex(h => h.id === hotId);

        if (index === -1) {
          return reply.status(404).send({ error: "Hot question not found" });
        }

        // 更新字段
        hotQuestions.hotQuestions[index] = {
          ...hotQuestions.hotQuestions[index],
          ...updates,
          lastUpdated: new Date().toISOString(),
        };

        hotQuestions.updatedAt = Date.now();
        hotQuestions.version++;

        await saveHotQuestions(merchantId, hotQuestions);

        reply.send({
          success: true,
          data: hotQuestions.hotQuestions[index],
        });
      } catch (error) {
        console.error("更新热门问题失败:", error);
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

        const hotQuestions = await loadHotQuestions(merchantId);
        const index = hotQuestions.hotQuestions.findIndex(h => h.id === hotId);

        if (index === -1) {
          return reply.status(404).send({ error: "Hot question not found" });
        }

        hotQuestions.hotQuestions.splice(index, 1);
        hotQuestions.updatedAt = Date.now();
        hotQuestions.version++;

        await saveHotQuestions(merchantId, hotQuestions);

        reply.send({ success: true });
      } catch (error) {
        console.error("删除热门问题失败:", error);
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // ===== 5. 获取报缺列表（来自Agent D）=====
  server.get(
    "/api/merchant/:id/missing-questions",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const merchantId = req.params.id;

        // TODO: 从Agent D获取报缺列表
        // 当前返回模拟数据
        const missingQuestions: MissingQuestionRecord[] = [
          {
            question: "门票多少钱",
            count: 152,
            firstSeenAt: "2026-01-10T10:00:00Z",
            lastSeenAt: "2026-01-15T22:00:00Z",
            status: "pending",
            merchantId,
            intentCategory: "PRICE_QUERY",
          },
          {
            question: "怎么去",
            count: 89,
            firstSeenAt: "2026-01-12T14:00:00Z",
            lastSeenAt: "2026-01-15T20:00:00Z",
            status: "pending",
            merchantId,
            intentCategory: "LOCATION_QUERY",
          },
        ];

        reply.send({
          success: true,
          data: missingQuestions,
        });
      } catch (error) {
        console.error("获取报缺列表失败:", error);
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // ===== 6. 增加热门问题命中次数 =====
  server.post(
    "/api/merchant/:id/hot-questions/:hotId/hit",
    async (req: FastifyRequest<{ Params: { id: string; hotId: string } }>, reply: FastifyReply) => {
      try {
        const merchantId = req.params.id;
        const hotId = req.params.hotId;

        const hotQuestions = await loadHotQuestions(merchantId);
        const index = hotQuestions.hotQuestions.findIndex(h => h.id === hotId);

        if (index !== -1) {
          hotQuestions.hotQuestions[index].hitCount++;
          await saveHotQuestions(merchantId, hotQuestions);
        }

        reply.send({ success: true });
      } catch (error) {
        console.error("更新命中次数失败:", error);
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}

/**
 * 加载商户热门问题
 */
async function loadHotQuestions(merchantId: string): Promise<MerchantHotQuestions> {
  const filePath = path.join(process.cwd(), "server", "merchant", merchantId, "hot-questions.json");

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    // 文件不存在，返回空列表
    return {
      merchantId,
      hotQuestions: [],
      updatedAt: Date.now(),
      version: 1,
    };
  }
}

/**
 * 保存商户热门问题
 */
async function saveHotQuestions(merchantId: string, data: MerchantHotQuestions): Promise<void> {
  const dirPath = path.join(process.cwd(), "server", "merchant", merchantId);
  const filePath = path.join(dirPath, "hot-questions.json");

  // 确保目录存在
  await fs.mkdir(dirPath, { recursive: true });

  // 写入文件
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}
