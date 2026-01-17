import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AgentStatus {
  name: string;
  status: "healthy" | "degraded" | "offline";
  lastSeen: number;
  messageCount: number;
  avgCostMs: number;
}

interface MissingQuestion {
  question: string;
  count: number;
  status: "pending" | "resolved";
}

interface DialogLog {
  timestamp: number;
  traceId: string;
  userId: string;
  inputType: "text" | "voice";
  question: string;
  answer?: string;
  intent?: string;
  source?: string;
  found: boolean;
}

export default function MonitorPage() {
  const [agentHealth, setAgentHealth] = useState<AgentStatus[]>([]);
  const [dialogStats, setDialogStats] = useState({
    total: 0,
    voice: 0,
    text: 0,
    cacheHits: 0,
  });
  const [missingQuestions, setMissingQuestions] = useState<MissingQuestion[]>([]);
  const [realtimeLogs, setRealtimeLogs] = useState<DialogLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTraceId, setSearchTraceId] = useState("");
  const [searchResult, setSearchResult] = useState<DialogLog | null>(null);
  const [systemStatus, setSystemStatus] = useState({
    redis: { connected: false, keyCount: 0, ttlSeconds: 0 },
    mongodb: { connected: false },
    contextPool: { totalKeys: 0, ttl: "24小时" },
  });

  // 加载系统状态
  const loadSystemStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/monitor/system");
      const data = await res.json();

      if (data.success) {
        setSystemStatus(data.data);
      }
    } catch (error) {
      console.error("加载系统状态失败:", error);
    }
  }, []);

  // 加载监控数据
  const loadMonitorStats = useCallback(async () => {
    try {
      const res = await fetch("/api/monitor/stats");
      const data = await res.json();

      if (data.success) {
        setAgentHealth(data.data.agentHealth);
        setDialogStats({
          total: data.data.dailyStats.totalDialogs,
          voice: data.data.dailyStats.voiceDialogs,
          text: data.data.dailyStats.textDialogs,
          cacheHits: data.data.dailyStats.cacheHits,
        });
        setMissingQuestions(data.data.missingQuestions);
      }

      setLoading(false);
    } catch (error) {
      console.error("加载监控数据失败:", error);
      setLoading(false);
    }
  }, []);

  // 加载实时日志
  const loadRealtimeLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/monitor/logs?merchantId=dongli&limit=10");
      const data = await res.json();

      if (data.success) {
        setRealtimeLogs(data.data.logs);
      }
    } catch (error) {
      console.error("加载实时日志失败:", error);
    }
  }, []);

  // TraceId查询
  const handleTraceSearch = async () => {
    if (!searchTraceId.trim()) return;

    try {
      const res = await fetch(`/api/monitor/trace/${searchTraceId}`);
      const data = await res.json();

      if (data.success) {
        setSearchResult(data.data);
      } else {
        setSearchResult(null);
        alert("未找到该TraceId");
      }
    } catch (error) {
      console.error("TraceId查询失败:", error);
      alert("查询失败");
    }
  };

  useEffect(() => {
    (async () => {
      await loadMonitorStats();
      await loadRealtimeLogs();
      await loadSystemStatus();
    })();

    const interval = setInterval(() => {
      loadMonitorStats();
      loadRealtimeLogs();
      loadSystemStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadMonitorStats, loadRealtimeLogs, loadSystemStatus]);

  if (loading) {
    return <div className="p-6">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📈 监控面板</h1>
        <p className="text-gray-500 mt-2">实时监控系统运行状态</p>
      </div>

      {/* 系统状态 */}
      <Card>
        <CardHeader>
          <CardTitle>🔧 系统状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Redis (Dragonfly) */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Redis (Dragonfly)</span>
                <Badge variant={systemStatus.redis.connected ? "default" : "destructive"}>
                  {systemStatus.redis.connected ? "✅ 已连接" : "❌ 断开"}
                </Badge>
              </div>
              {systemStatus.redis.connected && (
                <div className="text-sm text-gray-600 space-y-1">
                  <div>缓存键: {systemStatus.redis.keyCount} 个</div>
                  <div>TTL: {Math.floor(systemStatus.redis.ttlSeconds / 3600)}小时</div>
                </div>
              )}
            </div>

            {/* MongoDB */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">MongoDB</span>
                <Badge variant={systemStatus.mongodb.connected ? "default" : "destructive"}>
                  {systemStatus.mongodb.connected ? "✅ 已连接" : "❌ 断开"}
                </Badge>
              </div>
              <div className="text-sm text-gray-600">
                {systemStatus.mongodb.connected ? "数据库可用" : "使用本地文件"}
              </div>
            </div>

            {/* Context Pool */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Context Pool</span>
                <Badge variant="default">✅ 正常</Badge>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>对话记录: {systemStatus.contextPool.totalKeys} 个</div>
                <div>保留时长: {systemStatus.contextPool.ttl}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent健康状态 */}
      <Card>
        <CardHeader>
          <CardTitle>❤️ Agent 健康状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {agentHealth.map(agent => (
              <div key={agent.name} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{agent.name}</span>
                  <Badge variant={agent.status === "healthy" ? "default" : "destructive"}>
                    {agent.status === "healthy" ? "✅ 健康" : "⚠️ 异常"}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>处理: {agent.messageCount}次</div>
                  <div>平均: {agent.avgCostMs}ms</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 对话统计 */}
      <Card>
        <CardHeader>
          <CardTitle>📊 今日统计（实时更新）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{dialogStats.total}</div>
              <div className="text-sm text-gray-600">对话总数</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{dialogStats.voice}</div>
              <div className="text-sm text-gray-600">语音对话</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{dialogStats.text}</div>
              <div className="text-sm text-gray-600">文本对话</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{dialogStats.cacheHits}</div>
              <div className="text-sm text-gray-600">缓存命中</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 实时日志 */}
      <Card>
        <CardHeader>
          <CardTitle>🔄 业务流实时日志（最近10条）</CardTitle>
        </CardHeader>
        <CardContent>
          {realtimeLogs.length === 0 ? (
            <p className="text-gray-500">暂无日志记录，开始对话后将在此显示</p>
          ) : (
            <div className="space-y-3">
              {realtimeLogs.map(log => (
                <div key={log.traceId} className="border-b pb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-blue-600 font-mono text-xs">
                      {log.traceId.slice(-12)}
                    </span>
                    <span>{log.inputType === "voice" ? "🎤" : "⌨️"}</span>
                    <span className="font-medium">"{log.question}"</span>
                  </div>
                  {log.answer && (
                    <div className="text-sm text-gray-600 ml-4 mt-1">
                      →{" "}
                      {log.source === "user_cache"
                        ? "缓存命中"
                        : log.source === "hot_question"
                        ? "热门问题"
                        : log.source === "knowledge_base"
                        ? "C检索"
                        : "AI兜底"}
                      {log.found ? " ✅ 完成" : " ⚠️ 报缺"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* TraceId查询 */}
      <Card>
        <CardHeader>
          <CardTitle>🔍 TraceId 查询</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="输入TraceId..."
              value={searchTraceId}
              onChange={e => setSearchTraceId(e.target.value)}
              onKeyPress={e => e.key === "Enter" && handleTraceSearch()}
            />
            <Button onClick={handleTraceSearch}>查询</Button>
          </div>

          {searchResult && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <strong>TraceId:</strong> {searchResult.traceId}
                </div>
                <div>
                  <strong>用户:</strong> {searchResult.userId}
                </div>
                <div>
                  <strong>时间:</strong> {new Date(searchResult.timestamp).toLocaleString()}
                </div>
                <div>
                  <strong>类型:</strong>{" "}
                  {searchResult.inputType === "voice" ? "🎤 语音" : "⌨️ 文本"}
                </div>
                <div className="col-span-2">
                  <strong>问题:</strong> {searchResult.question}
                </div>
                {searchResult.answer && (
                  <div className="col-span-2">
                    <strong>回复:</strong> {searchResult.answer}
                  </div>
                )}
                <div>
                  <strong>来源:</strong> {searchResult.source}
                </div>
                <div>
                  <strong>状态:</strong> {searchResult.found ? "✅ 找到" : "⚠️ 未找到"}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 报缺问题 */}
      <Card>
        <CardHeader>
          <CardTitle>⚠️ 报缺列表（需要补充知识）</CardTitle>
        </CardHeader>
        <CardContent>
          {missingQuestions.length === 0 ? (
            <p className="text-gray-500">暂无报缺记录</p>
          ) : (
            <div className="space-y-2">
              {missingQuestions.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded">
                  <span>"{item.question}"</span>
                  <Badge variant="destructive">被问{item.count}次</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
