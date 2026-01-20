/**
 * 服务端 - MongoDB版本
 *
 * 使用MongoDB Atlas作为数据存储
 * 保持"一个萝卜一个坑"设计（merchantId隔离）
 *
 * 环境变量:
 *   MONGODB_URI - MongoDB连接字符串
 *   MONGODB_DB - 数据库名称 (默认: smart_guide)
 *   PORT - 服务端口 (默认: 3000)
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";

// MongoDB模块
import { connectDB, ConfigService, KnowledgeService, LogService } from "./database";
import type { KnowledgeItem, UserLog } from "./db-schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

// CORS
await fastify.register(cors, { origin: true });

// 静态文件服务
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, "../dist"),
  prefix: "/",
});

// ============ AI服务API (保持不变) ============

// Chat API
fastify.post("/api/chat", async (request, reply) => {
  const { messages, model = "glm-4-flash" } = request.body as {
    messages: { role: string; content: string }[];
    model?: string;
  };

  const API_KEY = process.env.ZHIPU_API_KEY || "";
  if (!API_KEY) {
    return reply.status(500).send({ error: "ZHIPU_API_KEY not configured" });
  }

  try {
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ model, messages }),
    });
    const data = await response.json();
    return data;
  } catch (e) {
    fastify.log.error(e);
    return reply.status(500).send({ error: "Chat API failed" });
  }
});

// ASR API
fastify.post("/api/asr", async (request, reply) => {
  const { audio, format = "wav" } = request.body as { audio: string; format?: string };
  const API_KEY = process.env.ZHIPU_API_KEY || "";

  if (!API_KEY) {
    return reply.status(500).send({ error: "API Key not configured" });
  }

  try {
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/audio/transcriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "glm-asr-2512",
        audio_data: audio,
        audio_format: format,
      }),
    });
    const data = await response.json();
    return data;
  } catch (e) {
    fastify.log.error(e);
    return reply.status(500).send({ error: "ASR API failed" });
  }
});

// TTS API
fastify.post("/api/tts", async (request, reply) => {
  const { text, voice = "alloy" } = request.body as { text: string; voice?: string };
  const API_KEY = process.env.SILICONFLOW_API_KEY || "";

  if (!API_KEY) {
    return reply.status(500).send({ error: "TTS API Key not configured" });
  }

  try {
    const response = await fetch("https://api.siliconflow.cn/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "FunAudioLLM/CosyVoice2-0.5B",
        input: text,
        voice,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return reply.status(response.status).send({ error: errText });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return { audio: base64 };
  } catch (e) {
    fastify.log.error(e);
    return reply.status(500).send({ error: "TTS API failed" });
  }
});

// ============ 商户数据管理 API (MongoDB版) ============

// 商户列表
fastify.get("/api/merchants", async () => {
  return ConfigService.list();
});

// 创建商户
fastify.post("/api/merchants", async (request, reply) => {
  const { id, name } = request.body as { id: string; name: string };
  if (!id || !name) {
    return reply.status(400).send({ error: "id and name required" });
  }

  // 检查是否已存在
  const existing = await ConfigService.get(id);
  if (existing) {
    return reply.status(409).send({ error: "Merchant already exists" });
  }

  // 创建默认配置
  const defaultConfig = {
    merchantId: id,
    name,
    avatar: "🏪",
    api: { provider: "zhipu", apiKey: "", model: "glm-4-flash" },
    prompts: { system: "你是一个智能助手", welcome: "你好，有什么可以帮您？" },
    theme: { primaryColor: "#2563eb", title: name },
  };

  await ConfigService.save(defaultConfig);
  return { success: true, id };
});

// 删除商户
fastify.delete("/api/merchant/:id", async request => {
  const { id } = request.params as { id: string };

  await ConfigService.delete(id);
  await KnowledgeService.deleteAll(id);
  // 可选：也删除日志

  return { success: true };
});

// 获取商户配置
fastify.get("/api/merchant/:id/config", async (request, reply) => {
  const { id } = request.params as { id: string };
  const config = await ConfigService.get(id);

  if (!config) {
    return reply.status(404).send({ error: "Merchant not found" });
  }
  return config;
});

// 保存商户配置
fastify.put("/api/merchant/:id/config", async request => {
  const { id } = request.params as { id: string };
  const config = request.body as Record<string, unknown>;

  await ConfigService.save({ ...config, merchantId: id } as Parameters<
    typeof ConfigService.save
  >[0]);
  return { success: true };
});

// 获取知识库
fastify.get("/api/merchant/:id/knowledge", async request => {
  const { id } = request.params as { id: string };
  const items = await KnowledgeService.getAll(id);
  return { items };
});

// 保存知识库 (整体覆盖)
fastify.put("/api/merchant/:id/knowledge", async request => {
  const { id } = request.params as { id: string };
  const { items } = request.body as { items: KnowledgeItem[] };

  await KnowledgeService.saveAll(id, items);
  return { success: true };
});

// 知识库搜索 (供Agent C调用)
fastify.get("/api/merchant/:id/knowledge/search", async request => {
  const { id } = request.params as { id: string };
  const { q, category } = request.query as { q: string; category?: string };

  const results = await KnowledgeService.search(id, q, category);
  return { results };
});

// 获取热门问答
fastify.get("/api/merchant/:id/knowledge/hot", async request => {
  const { id } = request.params as { id: string };
  const items = await KnowledgeService.getHot(id);
  return { items };
});

// 获取日志
fastify.get("/api/merchant/:id/logs", async request => {
  const { id } = request.params as { id: string };
  const { date } = request.query as { date?: string };

  const logs = await LogService.getByDate(id, date);
  return logs;
});

// 保存日志
fastify.post("/api/merchant/:id/logs", async request => {
  const { id } = request.params as { id: string };
  const logs = request.body as Omit<UserLog, "id" | "createdAt">[];

  const logsWithMerchant = logs.map(log => ({ ...log, merchantId: id }));
  await LogService.addBatch(logsWithMerchant);
  return { success: true, count: logs.length };
});

// 获取统计
fastify.get("/api/merchant/:id/stats", async request => {
  const { id } = request.params as { id: string };
  const { date } = request.query as { date?: string };

  const stats = await LogService.getStats(id, date);
  const knowledgeCount = (await KnowledgeService.getAll(id)).length;

  return {
    ...stats,
    knowledgeCount,
    hitRate: stats.total > 0 ? Math.round((stats.hit / stats.total) * 100) : 0,
  };
});

// 获取报缺列表
fastify.get("/api/merchant/:id/missing", async request => {
  const { id } = request.params as { id: string };
  const { limit = 50 } = request.query as { limit?: number };

  const logs = await LogService.getMissing(id, limit);

  // 聚合报缺
  const missing: Record<string, { query: string; count: number; lastSeen: number }> = {};
  for (const log of logs) {
    const q = log.query || "未知问题";
    if (!missing[q]) {
      missing[q] = { query: q, count: 0, lastSeen: log.timestamp };
    }
    missing[q].count++;
  }

  return Object.values(missing).sort((a, b) => b.count - a.count);
});

// 兜底路由：返回 index.html (SPA)
fastify.setNotFoundHandler((request, reply) => {
  reply.sendFile("index.html");
});

// ============ 启动服务器 ============

const start = async () => {
  try {
    // 连接MongoDB
    await connectDB();

    const port = Number(process.env.PORT) || 3000;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 Server running at http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
