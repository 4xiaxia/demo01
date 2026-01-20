/**
 * 监控统计API路由
 *
 * 功能：
 * 1. 获取Agent健康状态
 * 2. 获取对话统计（按商家隔离）
 * 3. 获取缓存命中率
 * 4. 获取报缺列表（按商家隔离）
 *
 * 商家隔离设计（2026-01-20更新）：
 * - 所有统计API都支持 merchantId 参数
 * - 不传 merchantId 时返回汇总数据（向后兼容）
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { agentD } from "../agents/agent-d";
import { contextPool } from "../context-pool";

interface MissingDetail {
  count: number;
}

/**
 * 注册监控统计路由
 */
export async function registerMonitorRoutes(server: FastifyInstance) {
  // ===== 1. 获取监控统计数据（按商家隔离） =====
  server.get(
    "/api/monitor/stats",
    async (
      req: FastifyRequest<{
        Querystring: {
          merchantId?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const merchantId = req.query.merchantId;

        // 从Agent D获取统计数据（支持按商家获取）
        const stats = agentD.getStats(merchantId);

        // 格式化返回数据
        const response = {
          success: true,
          data: {
            merchantId: stats.merchantId,

            // Agent健康状态（全局共享）
            agentHealth: Object.entries(stats.agentHealth).map(([name, status]) => ({
              name,
              status: "healthy" as const,
              lastSeen: status.lastSeen,
              messageCount: status.messageCount,
              avgCostMs: status.avgCostMs || 0,
            })),

            // 每日统计（按商家隔离）
            dailyStats: {
              date: stats.daily.date,
              totalDialogs: stats.daily.totalDialogs,
              voiceDialogs: stats.daily.voiceDialogs,
              textDialogs: stats.daily.textDialogs,
              cacheHits: stats.daily.cacheHits,
              aiCalls: stats.daily.aiCalls,
              avgResponseMs: stats.daily.avgResponseMs,
              // 计算缓存命中率
              cacheHitRate:
                stats.daily.totalDialogs > 0
                  ? Math.round((stats.daily.cacheHits / stats.daily.totalDialogs) * 100)
                  : 0,
            },

            // 报缺问题（按商家隔离，过滤掉空question）
            missingQuestions: Object.entries(stats.missingQuestions)
              .filter(([question]) => question && question.trim())
              .map(([question, detail]) => ({
                question,
                count: (detail as MissingDetail).count || 0,
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
    }
  );

  // ===== 1.5 按商家路径获取统计（RESTful风格） =====
  server.get(
    "/api/merchant/:merchantId/monitor/stats",
    async (
      req: FastifyRequest<{
        Params: {
          merchantId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { merchantId } = req.params;

        // 从Agent D获取该商家的统计数据
        const stats = agentD.getStats(merchantId);

        const response = {
          success: true,
          data: {
            merchantId,

            agentHealth: Object.entries(stats.agentHealth).map(([name, status]) => ({
              name,
              status: "healthy" as const,
              lastSeen: status.lastSeen,
              messageCount: status.messageCount,
              avgCostMs: status.avgCostMs || 0,
            })),

            dailyStats: {
              date: stats.daily.date,
              totalDialogs: stats.daily.totalDialogs,
              voiceDialogs: stats.daily.voiceDialogs,
              textDialogs: stats.daily.textDialogs,
              cacheHits: stats.daily.cacheHits,
              aiCalls: stats.daily.aiCalls,
              avgResponseMs: stats.daily.avgResponseMs,
              cacheHitRate:
                stats.daily.totalDialogs > 0
                  ? Math.round((stats.daily.cacheHits / stats.daily.totalDialogs) * 100)
                  : 0,
            },

            missingQuestions: Object.entries(stats.missingQuestions)
              .filter(([question]) => question && question.trim())
              .map(([question, detail]) => ({
                question,
                count: (detail as MissingDetail).count || 0,
                status: "pending" as const,
              })),
          },
        };

        reply.send(response);
      } catch (error) {
        console.error("获取商家监控统计失败:", error);
        reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );

  // ===== 2. 获取实时日志（按商家隔离） =====
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
            merchantId,
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

  // ===== 2.5 按商家路径获取日志（RESTful风格） =====
  server.get(
    "/api/merchant/:merchantId/monitor/logs",
    async (
      req: FastifyRequest<{
        Params: {
          merchantId: string;
        };
        Querystring: {
          limit?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { merchantId } = req.params;
        const limit = parseInt(req.query.limit || "10", 10);

        const logs = await contextPool.getRecentDialogs(merchantId, limit);

        reply.send({
          success: true,
          data: {
            merchantId,
            logs,
            total: logs.length,
          },
        });
      } catch (error) {
        console.error("获取商家日志失败:", error);
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
        mongoConnected = databaseService !== null && databaseService !== undefined;
      } catch {
        mongoConnected = false;
      }

      // 获取已注册的商家列表
      const merchantList = agentD.getMerchantList();

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
          // 已注册商家列表
          merchants: merchantList,
          merchantCount: merchantList.length,
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

  // ===== 5. 忽略报缺问题（按商家） =====
  server.delete(
    "/api/merchant/:merchantId/monitor/missing/:question",
    async (
      req: FastifyRequest<{
        Params: {
          merchantId: string;
          question: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { merchantId, question } = req.params;
        const decodedQuestion = decodeURIComponent(question);

        agentD.ignoreMissingQuestion(merchantId, decodedQuestion);

        reply.send({
          success: true,
          message: `已忽略报缺问题: ${decodedQuestion}`,
        });
      } catch (error) {
        console.error("忽略报缺问题失败:", error);
        reply.status(500).send({
          success: false,
          error: "Internal server error",
        });
      }
    }
  );
}
