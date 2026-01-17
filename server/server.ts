import "dotenv/config"; // 加载.env文件
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import formBody from "@fastify/formbody";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import multipart from "@fastify/multipart";
import { agentA } from "./agents/agent-a";
import { agentB } from "./agents/agent-b";
import { agentC } from "./agents/agent-c";
import { agentD } from "./agents/agent-d";
import { anpBus } from "./bus";
import { responseStore } from "./response-store";
import { contextPool } from "./context-pool";
import { databaseService } from "./database";
import { configManager } from "./config-manager";
import { Message } from "./types";
import { registerHotQuestionsRoutes } from "./routes/hot-questions";
import { registerMonitorRoutes } from "./routes/monitor";
import { registerKnowledgeRoutes } from "./routes/knowledge";

// ES模块中获取__dirname的替代方法
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化所有Agents
console.log("[Server] 初始化Agents...");
agentC.init("dongli"); // C加载知识库
console.log("[Server] AgentB已导入:", !!agentB); // 确保B被引用
console.log("[Server] AgentD已导入:", !!agentD); // 确保D被引用
console.log("[Server] 所有Agents初始化完成");

// 创建 Fastify 实例
const server: FastifyInstance = fastify({
  logger: true,
});

// 监听 Bus 消息，暂存回复以便前端轮询
anpBus.on("B→USER", (msg: Message) => {
  if (msg.traceId) {
    console.log(`[Server] 暂存回复: ${msg.traceId}`);
    responseStore.save(msg.traceId, msg);
  }
});

// API 路由：轮询回复
server.get<{ Querystring: { traceId: string } }>("/api/poll-response", async (req, reply) => {
  const { traceId } = req.query;
  const data = responseStore.get(traceId);
  if (data) {
    return reply.send({ success: true, data });
  } else {
    // 尚未准备好，返回空，保留success:false让前端继续轮询
    // 或者返回 success:true 但 data: null
    return reply.send({ success: false });
  }
});

// 定义类型以避免过度使用any
// interface ProcessInputBody {
//   userId: string;
//   sessionId: string;
//   inputType: "text" | "voice";
//   merchantId: string;
//   text?: string;
//   audio?: any;
// }

// API 路由：用户进入（通知Agent D）
server.post(
  "/api/user-enter",
  async (
    req: FastifyRequest<{
      Body: { merchantId: string; userId: string; mode: string; timestamp: number };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { merchantId, userId, mode, timestamp } = req.body;

      console.log(`[Server] 用户进入: merchantId=${merchantId}, userId=${userId}, mode=${mode}`);

      // 直接通知Agent D
      agentD.logUserEnter({ merchantId, userId, mode: mode as "voice" | "text", timestamp });

      reply.send({ success: true });
    } catch (error) {
      console.error("Error in user-enter:", error);
      reply.status(500).send({ error: "Internal server error" });
    }
  }
);

// API 路由：处理输入
server.post("/api/process-input", async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    // 使用 @fastify/multipart 解析表单数据
    const parts = req.parts();

    let userId = "";
    let sessionId = "";
    let inputType: "text" | "voice" = "text";
    let merchantId = "";
    let textInput = "";
    let audioBuffer: Buffer | null = null;

    for await (const part of parts) {
      if (part.type === "field") {
        // 处理普通字段
        switch (part.fieldname) {
          case "userId":
            userId = part.value as string;
            break;
          case "sessionId":
            sessionId = part.value as string;
            break;
          case "inputType":
            inputType = part.value as "text" | "voice";
            break;
          case "merchantId":
            merchantId = part.value as string;
            break;
          case "text":
            textInput = part.value as string;
            break;
        }
      } else if (part.type === "file" && part.fieldname === "audio") {
        // 处理音频文件
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        audioBuffer = Buffer.concat(chunks);
      }
    }

    // 验证必填字段
    if (!userId || !sessionId || !inputType || !merchantId) {
      return reply.status(400).send({
        error: "Missing required fields",
        received: { userId, sessionId, inputType, merchantId },
      });
    }

    let input: string | Buffer;

    if (inputType === "voice") {
      if (!audioBuffer) {
        return reply.status(400).send({ error: "Missing audio file" });
      }
      input = audioBuffer;
    } else {
      if (!textInput) {
        return reply.status(400).send({ error: "Missing text input" });
      }
      input = textInput;
    }

    console.log(
      `[Server] 收到请求: userId=${userId}, merchantId=${merchantId}, inputType=${inputType}`
    );

    // 调用服务端 Agent A 处理输入
    const result = await agentA.processInput(userId, sessionId, input, inputType, merchantId);

    // 返回处理结果
    reply.send(result);
  } catch (error) {
    console.error("Error processing input:", error);
    reply.status(500).send({ error: "Internal server error", details: String(error) });
  }
});

// API 路由：获取商户配置
server.get(
  "/api/merchant/:id/config",
  async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const merchantId = req.params.id;
      console.log(`[Server] 获取商户配置: ${merchantId}`);

      // 从public/data读取配置
      const configPath = path.join(__dirname, "..", "public", "data", merchantId, "config.json");

      try {
        const configData = await fs.readFile(configPath, "utf-8");
        const config = JSON.parse(configData);
        reply.send(config);
      } catch (error) {
        console.error(`[Server] 读取配置失败:`, error);
        reply.status(404).send({ error: "Config not found" });
      }
    } catch (error) {
      console.error("Error in get config:", error);
      reply.status(500).send({ error: "Internal server error" });
    }
  }
);

// API 路由：保存商户配置
server.put(
  "/api/merchant/:id/config",
  async (req: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) => {
    try {
      const merchantId = req.params.id;
      const newConfig = req.body as Record<string, unknown>;

      console.log(`[Server] 保存商户配置: ${merchantId}`);

      // 保存到本地文件
      const configPath = path.join(
        __dirname,
        "..",
        "server",
        "merchant",
        merchantId,
        "config.json"
      );

      try {
        // 确保目录存在
        const dir = path.dirname(configPath);
        await fs.mkdir(dir, { recursive: true });

        // 读取现有配置并合并
        let existingConfig = {};
        try {
          const existingData = await fs.readFile(configPath, "utf-8");
          existingConfig = JSON.parse(existingData);
        } catch {
          // 文件不存在，使用空对象
        }

        // 合并配置
        const mergedConfig = {
          ...existingConfig,
          ...newConfig,
          merchantId, // 确保merchantId正确
        };

        // 写入文件
        await fs.writeFile(configPath, JSON.stringify(mergedConfig, null, 2), "utf-8");

        // 重新加载配置使其生效
        await configManager.init();

        console.log(`[Server] ✅ 配置已保存: ${merchantId}`);
        reply.send({ success: true, message: "配置已保存并实时生效" });
      } catch (error) {
        console.error(`[Server] 保存配置失败:`, error);
        reply.status(500).send({ error: "保存配置失败" });
      }
    } catch (error) {
      console.error("Error in save config:", error);
      reply.status(500).send({ error: "Internal server error" });
    }
  }
);

// API 路由：商户知识库搜索
server.get(
  "/api/merchant/:id/knowledge/search",
  async (
    req: FastifyRequest<{ Params: { id: string }; Querystring: { q: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const merchantId = req.params.id;
      const query = req.query.q as string;

      if (!query) {
        return reply.status(400).send({ error: "Missing query parameter" });
      }

      const knowledgePath = path.join(__dirname, "merchant", merchantId, "knowledge.json");

      try {
        const knowledgeData = await fs.readFile(knowledgePath, "utf-8");
        const knowledge = JSON.parse(knowledgeData);

        // 简单的关键词匹配搜索
        const results =
          knowledge.items?.filter(
            (item: { keywords?: string[]; name: string; content: string }) =>
              item.keywords?.some((kw: string) => kw.toLowerCase().includes(query.toLowerCase())) ||
              item.name.toLowerCase().includes(query.toLowerCase()) ||
              item.content.toLowerCase().includes(query.toLowerCase())
          ) || [];

        reply.send({ results });
      } catch (error) {
        console.error(`Error searching knowledge for merchant ${merchantId}:`, error);
        reply.status(404).send({ error: "Knowledge not found" });
      }
    } catch (error) {
      console.error("Error searching knowledge:", error);
      reply.status(500).send({ error: "Internal server error" });
    }
  }
);

// API 路由：获取上下文
server.get(
  "/api/context/:merchantId/:userId/:sessionId",
  async (
    req: FastifyRequest<{ Params: { merchantId: string; userId: string; sessionId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      // const { merchantId, userId, sessionId } = req.params; // unused

      // TODO: 实现从服务端context pool获取上下文
      reply.send({ context: [], message: "Context pool not yet implemented in API route" });
    } catch (error) {
      console.error("Error getting context:", error);
      reply.status(500).send({ error: "Internal server error" });
    }
  }
);

// API 路由：添加上下文
server.post(
  "/api/context/:merchantId/:userId/:sessionId",
  async (
    req: FastifyRequest<{ Params: { merchantId: string; userId: string; sessionId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      // TODO: 实现向服务端context pool添加上下文
      reply.send({ success: true, message: "Context pool not yet implemented in API route" });
    } catch (error) {
      console.error("Error adding context:", error);
      reply.status(500).send({ error: "Internal server error" });
    }
  }
);

// API 路由：刷新热门问题缓存
server.post(
  "/api/merchant/:id/hot-questions/refresh-cache",
  async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = req.params;
      agentB.refreshHotQuestionsCache(id);
      reply.send({ success: true, message: `热门问题缓存已刷新: ${id}` });
    } catch (error) {
      console.error("Error refreshing hot questions cache:", error);
      reply.status(500).send({ error: "Internal server error" });
    }
  }
);

// API 路由：刷新知识库
server.post(
  "/api/merchant/:id/knowledge/refresh",
  async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = req.params;
      await agentC.refreshKnowledge(id);
      const status = agentC.getStatus();
      reply.send({
        success: true,
        message: `知识库已刷新: ${id}`,
        status,
      });
    } catch (error) {
      console.error("Error refreshing knowledge:", error);
      reply.status(500).send({ error: "Internal server error" });
    }
  }
);

// API 路由：AI聊天（用于B的AI兜底）
interface ChatBody {
  provider?: string;
  model?: string;
  messages: Array<{ role: string; content: string }>;
}

server.post("/api/chat", async (req: FastifyRequest<{ Body: ChatBody }>, reply: FastifyReply) => {
  try {
    // Agent B 使用智谱免费版 GLM-4.5-Flash
    const { provider = "zhipu", model = "GLM-4-Flash", messages } = req.body;

    console.log(`[Server] AI Chat: provider=${provider}, model=${model}`);

    if (provider === "zhipu") {
      // 使用智谱 GLM-4-Flash (免费)
      const apiKey = process.env.VITE_ZHIPU_API_KEY || "";

      if (!apiKey) {
        console.warn("[Server] VITE_ZHIPU_API_KEY 未配置，使用兜底回复");
        return reply.send({
          choices: [
            {
              message: {
                content: "抱歉，AI服务暂时不可用，请稍后再试。如需帮助，请联系景区工作人员。",
              },
            },
          ],
        });
      }

      const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`Zhipu API Error: ${response.status}`);
      }

      const data = await response.json();
      reply.send(data);
    } else {
      // 备用：SiliconFlow
      const apiKey = process.env.SILICONFLOW_API_KEY || "";

      if (!apiKey) {
        console.warn("[Server] SILICONFLOW_API_KEY 未配置，使用兜底回复");
        return reply.send({
          choices: [
            {
              message: {
                content: "抱歉，AI服务暂时不可用，请稍后再试。",
              },
            },
          ],
        });
      }

      const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`SiliconFlow API Error: ${response.status}`);
      }

      const data = await response.json();
      reply.send(data);
    }
  } catch (error) {
    console.error("Error in AI chat:", error);
    // 返回兜底回复
    reply.send({
      choices: [
        {
          message: {
            content: "抱歉，AI服务暂时不可用，请稍后再试。",
          },
        },
      ],
    });
  }
});

// 静态文件服务
server.get("/", async (_, reply: FastifyReply) => {
  reply.type("text/html").send(`
    <html>
      <body>
        <h1>ANP Backend Service</h1>
        <p>Backend service for the ANP (Async Named Pipe) system</p>
        <p>Endpoints:</p>
        <ul>
          <li>POST /api/process-input - Process user input</li>
          <li>GET /api/merchant/:id/config - Get merchant config</li>
          <li>GET /api/merchant/:id/knowledge - Get merchant knowledge</li>
          <li>GET /api/merchant/:id/knowledge/search?q=:query - Search knowledge</li>
        </ul>
      </body>
    </html>
  `);
});

// 启动服务器
const start = async () => {
  try {
    // 注册插件
    await server.register(cors, {
      origin: true,
    });
    await server.register(formBody);
    await server.register(multipart);

    // 初始化数据库服务
    console.log("[Server] 初始化数据库连接...");
    await databaseService.init();

    // 初始化配置管理器
    await configManager.init();

    // 初始化上下文池
    console.log("[Server] 初始化Context Pool (Redis)...");
    await contextPool.init();

    // 注册热门问题管理路由
    await registerHotQuestionsRoutes(server);

    // 注册监控统计路由
    await registerMonitorRoutes(server);

    // 注册知识库管理路由
    await registerKnowledgeRoutes(server);

    console.log("[Server] ✅ 所有服务初始化完成");

    // 确保uploads目录存在
    await fs.mkdir(path.join(__dirname, "uploads"), { recursive: true });

    await server.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Server running on http://localhost:3000");

    // 输出连接状态
    const poolStatus = await contextPool.getStatus();
    console.log("[Server] Context Pool状态:", poolStatus);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
