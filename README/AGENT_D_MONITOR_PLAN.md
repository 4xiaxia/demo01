# 📊 Agent D 监控功能实现计划

> **基于**: 不要删后台大概的功能.md  
> **目标**: 实现完整的监控面板和 Agent D 数据收集

---

## 🎯 **监控面板需求（界面 3）**

### **必须显示的数据**:

#### 1. ❤️ **Agent 健康状态**

```
Agent A  ✅ 健康   处理: 245次  平均: 150ms
Agent B  ✅ 健康   处理: 245次  平均: 200ms
Agent C  ✅ 健康   检索: 180次  平均: 50ms
Agent D  ✅ 健康   记录: 490条  正常
```

#### 2. 📊 **今日统计（实时更新）**

```
对话总数:     245次
缓存命中率:   78%
平均响应:     0.3秒

语音对话:     98次(40%)
文本对话:     147次(60%)
报缺数:       12次
```

#### 3. 🔄 **业务流实时日志（最近 10 条）**

```
21:28:45 UUID-123 🎤 "门票多少钱"
  → A处理(150ms) → B缓存命中 → 回复(0.2s)
  ✅ 完成

21:28:30 UUID-456 ⌨️ "开放时间"
  → A处理(100ms) → B→C检索(50ms) → 回复
  ✅ 完成

21:28:15 UUID-789 🎤 "天气怎么样"
  → A处理(120ms) → C未找到 → AI兜底
  ⚠️ 报缺记录
```

#### 4. ⚠️ **报缺列表（需要补充知识）**

```
"天气怎么样" - 被问3次
"附近有没有酒店" - 被问2次
"可以带狗吗" - 被问1次
```

#### 5. 🔍 **查询功能**

- UUID 查询
- 其他字段查询
- 查询列表下载

---

## 🔧 **Agent D 需要收集的数据**

### **当前已有**:

```typescript
// server/agents/agent-d.ts
private stats = {
  agentHealth: {
    A: { lastSeen: 0, messageCount: 0, avgCostMs: 0 },
    B: { lastSeen: 0, messageCount: 0, avgCostMs: 0 },
    C: { lastSeen: 0, messageCount: 0, avgCostMs: 0 },
    D: { lastSeen: 0, messageCount: 0, avgCostMs: 0 },
  },
  daily: {
    date: '',
    totalDialogs: 0,
    voiceDialogs: 0,
    textDialogs: 0,
    cacheHits: 0,
    aiCalls: 0,
    avgResponseMs: 0,
  },
  missingQuestions: {} as Record<string, number>,
};
```

### **需要新增**:

#### 1. **实时日志队列**

```typescript
private realtimeLogs: Array<{
  timestamp: number;
  traceId: string;
  userId: string;
  inputType: 'voice' | 'text';
  question: string;
  flow: Array<{
    agent: string;
    action: string;
    costMs: number;
  }>;
  status: 'completed' | 'missing' | 'error';
  totalMs: number;
}> = [];
```

#### 2. **报缺详情**

```typescript
private missingDetails: Array<{
  question: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  intentCategory: string;
}> = [];
```

#### 3. **性能统计**

```typescript
private performance = {
  cacheHitRate: 0,
  avgResponseMs: 0,
  fastestMs: Infinity,
  slowestMs: 0,
};
```

---

## 📋 **实现步骤**

### **Step 1: 扩展 Agent D 数据收集** ⭐⭐⭐

**文件**: `server/agents/agent-d.ts`

**新增方法**:

```typescript
// 记录完整的业务流
recordBusinessFlow(traceId: string, flow: FlowStep[]) {
  this.realtimeLogs.push({
    timestamp: Date.now(),
    traceId,
    flow,
    // ...
  });

  // 只保留最近100条
  if (this.realtimeLogs.length > 100) {
    this.realtimeLogs.shift();
  }
}

// 更新报缺详情
recordMissingDetail(question: string, intent: string) {
  const existing = this.missingDetails.find(m => m.question === question);
  if (existing) {
    existing.count++;
    existing.lastSeenAt = new Date().toISOString();
  } else {
    this.missingDetails.push({
      question,
      count: 1,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      intentCategory: intent,
    });
  }
}

// 计算性能指标
calculatePerformance() {
  const total = this.stats.daily.totalDialogs;
  const cacheHits = this.stats.daily.cacheHits;

  this.performance.cacheHitRate = total > 0
    ? Math.round((cacheHits / total) * 100)
    : 0;

  // 从realtimeLogs计算平均响应时间
  if (this.realtimeLogs.length > 0) {
    const sum = this.realtimeLogs.reduce((acc, log) => acc + log.totalMs, 0);
    this.performance.avgResponseMs = Math.round(sum / this.realtimeLogs.length);
  }
}
```

---

### **Step 2: 扩展监控 API** ⭐⭐

**文件**: `server/routes/monitor.ts`

**新增端点**:

```typescript
// 获取实时日志
server.get("/api/monitor/logs", async (req, reply) => {
  const { limit = 10, offset = 0 } = req.query;
  const logs = agentD.getRealtimeLogs(limit, offset);

  reply.send({
    success: true,
    data: {
      logs,
      total: logs.length,
    },
  });
});

// 获取报缺详情
server.get("/api/monitor/missing-details", async (req, reply) => {
  const details = agentD.getMissingDetails();

  reply.send({
    success: true,
    data: details,
  });
});

// UUID查询
server.get("/api/monitor/trace/:traceId", async (req, reply) => {
  const { traceId } = req.params;
  const trace = agentD.getTraceById(traceId);

  reply.send({
    success: true,
    data: trace,
  });
});
```

---

### **Step 3: 完善监控面板 UI** ⭐⭐

**文件**: `src/views/admin/MonitorPage.tsx`

**新增组件**:

```typescript
// 实时日志组件
function RealtimeLogs({ logs }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>🔄 业务流实时日志（最近10条）</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.map(log => (
          <div key={log.traceId} className="border-b pb-2 mb-2">
            <div className="flex items-center gap-2">
              <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span>{log.traceId}</span>
              <span>{log.inputType === "voice" ? "🎤" : "⌨️"}</span>
              <span>"{log.question}"</span>
            </div>
            <div className="text-sm text-gray-600 ml-4">
              {log.flow.map((step, idx) => (
                <span key={idx}>
                  → {step.agent}处理({step.costMs}ms)
                </span>
              ))}
            </div>
            <div className="ml-4">{log.status === "completed" ? "✅ 完成" : "⚠️ 报缺记录"}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// 报缺列表组件
function MissingList({ missing }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>⚠️ 报缺列表（需要补充知识）</CardTitle>
      </CardHeader>
      <CardContent>
        {missing.map((item, idx) => (
          <div key={idx} className="flex justify-between p-2 border-b">
            <span>"{item.question}"</span>
            <span>被问{item.count}次</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## 🎯 **优先级**

### **P0 - 立即实现** ✅

- [x] Agent 健康状态（已完成）
- [x] 今日统计（已完成）
- [x] 报缺问题（已完成）

### **P1 - 本次完成** 🔧

- [ ] 实时日志队列
- [ ] 报缺详情
- [ ] 性能统计计算
- [ ] 监控 API 扩展
- [ ] UI 组件完善

### **P2 - 后续优化** ⏳

- [ ] UUID 查询功能
- [ ] 日志导出
- [ ] 清理缓存功能
- [ ] MongoDB 持久化

---

## 📊 **数据流**

```
用户提问
  ↓
Agent A: 记录开始时间
  ↓
Agent B: 记录处理步骤
  ↓
Agent C: 记录检索结果
  ↓
Agent D:
  - 收集所有步骤
  - 计算总耗时
  - 判断是否报缺
  - 更新统计数据
  - 添加到实时日志
  ↓
监控面板: 实时显示
```

---

## 🚀 **下一步行动**

1. **扩展 Agent D** - 添加实时日志和报缺详情收集
2. **扩展监控 API** - 添加日志和报缺端点
3. **完善 UI** - 添加实时日志和报缺列表组件
4. **测试验证** - 确保数据正确显示

**预计时间**: 1-2 小时

---

**要开始实现吗？** 🎯
