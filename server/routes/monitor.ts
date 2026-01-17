/**
 * 监控统计API路由
 *
 * 功能：
 * 1. 获取Agent健康状态
 * 2. 获取对话统计
 * 3. 获取缓存命中率
 * 4. 获取报缺列表
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { agentD } from "../agents/agent-d";
import { contextPool } from "../context-pool";

/**
 * 注册监控统计路由
 */
export async function registerMonitorRoutes(server: FastifyInstance) {
  // ===== 1. 获取监控统计数据 =====
  server.get("/api/monitor/stats", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // 从Agent D获取统计数据
      const stats = agentD.getStats();

      // 格式化返回数据
      const response = {
        success: true,
        data: {
          // Agent健康状态
          agentHealth: Object.entries(stats.agentHealth).map(([name, status]) => ({
            name,
            status: "healthy" as const,
            lastSeen: status.lastSeen,
            messageCount: status.messageCount,
            avgCostMs: status.avgCostMs || 0,
          })),

          // 每日统计
          dailyStats: {
            date: stats.daily.date,
            totalDialogs: stats.daily.totalDialogs,
            voiceDialogs: stats.daily.voiceDialogs,
            textDialogs: stats.daily.textDialogs,
            cacheHits: stats.daily.cacheHits,
            aiCalls: stats.daily.aiCalls,
            avgResponseMs: stats.daily.avgResponseMs,
          },

          // 报缺问题
          missingQuestions: Object.entries(stats.missingQuestions).map(([question, count]) => ({
            question,
            count,
            status: "pending" as const,
          })),
        },
      };

      reply.send(response);
    } catch (error) {
      console.error("获取监控统计失败:", error);
      reply.status(500).send({
        success: false,
        error: "Internal server error",
      });
    }
  });

  // ===== 2. 获取实时日志 =====
  server.get(
    "/api/monitor/logs",
    async (
      req: FastifyRequest<{
        Querystring: {
          merchantId?: string;
          limit?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const merchantId = req.query.merchantId || "dongli";
        const limit = parseInt(req.query.limit || "10", 10);

        // 从Context Pool读取最近对话
        const logs = await contextPool.getRecentDialogs(merchantId, limit);

        reply.send({
          success: true,
          data: {
            logs,
            total: logs.length,
          },
        });
      } catch (error) {
        console.error("获取日志失败:", error);
        reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );

  // ===== 3. TraceId查询 =====
  server.get(
    "/api/monitor/trace/:traceId",
    async (
      req: FastifyRequest<{
        Params: {
          traceId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { traceId } = req.params;

        // 从Context Pool查询
        const trace = await contextPool.getDialogByTraceId(traceId);

        if (!trace) {
          return reply.status(404).send({
            success: false,
            error: "Trace not found",
          });
        }

        reply.send({
          success: true,
          data: trace,
        });
      } catch (error) {
        console.error("TraceId查询失败:", error);
        reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );

  // ===== 4. 获取系统状态 =====
  server.get("/api/monitor/system", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // 获取Context Pool状态 (async方法需要await)
      const contextPoolStatus = contextPool.getStatus
        ? await contextPool.getStatus()
        : {
            redisConnected: false,
            ttlSeconds: 0,
            keyCount: 0,
          };

      // 获取数据库服务状态
      let mongoConnected = false;
      try {
        const { databaseService } = await import("../database");
        // DatabaseService没有isConnected方法，我们检查是否初始化成功
        mongoConnected = databaseService !== null && databaseService !== undefined;
      } catch {
        mongoConnected = false;
      }

      reply.send({
        success: true,
        data: {
          // Redis (Dragonfly) 状态
          redis: {
            connected: contextPoolStatus.redisConnected || false,
            keyCount: contextPoolStatus.keyCount || 0,
            ttlSeconds: contextPoolStatus.ttlSeconds || 86400,
          },
          // MongoDB 状态
          mongodb: {
            connected: mongoConnected,
          },
          // Context Pool 统计
          contextPool: {
            totalKeys: contextPoolStatus.keyCount || 0,
            ttl: `${Math.floor((contextPoolStatus.ttlSeconds || 86400) / 3600)}小时`,
          },
        },
      });
    } catch (error) {
      console.error("获取系统状态失败:", error);
      reply.status(500).send({
        success: false,
        error: "Internal server error",
      });
    }
  });
}
