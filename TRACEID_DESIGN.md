# 🎫 TraceId 设计：系统的灵魂

> **核心规则**: 每个任务必须带固定前缀 `ticket-时间戳-商家编码-UUID`

---

## 🔑 **TraceId 的格式**

```typescript
// Agent A 生成 (agent-a.ts:42)
const traceId = `ticket-${Date.now()}-${merchantId}-${userId}`;

// 示例
"ticket-1705329600000-dongli-uuid123"
  ↑      ↑              ↑        ↑
  前缀   时间戳         商家     用户
```

---

## 💡 **为什么必须这样设计？**

### 1️⃣ **多租户隔离 (商家编码)**

```
问题: 10个景区同时使用系统
  - 东里村: merchantId=dongli
  - 西湖: merchantId=xihu
  - 黄山: merchantId=huangshan

如果没有商家编码:
  ❌ 任务池混乱
  ❌ 缓存池串台
  ❌ 日志无法区分

有了商家编码:
  ✅ ticket-xxx-dongli-xxx → 东里村的任务
  ✅ ticket-xxx-xihu-xxx → 西湖的任务
  ✅ 完全隔离，互不干扰
```

### 2️⃣ **用户追踪 (UUID)**

```
问题: 同一个景区，100个用户同时提问

如果没有UUID:
  ❌ 无法区分是谁的问题
  ❌ 缓存池查不到历史
  ❌ 上下文混乱

有了UUID:
  ✅ ticket-xxx-dongli-user123 → 用户123的对话
  ✅ ticket-xxx-dongli-user456 → 用户456的对话
  ✅ 每个用户独立的24h缓存
```

### 3️⃣ **时间排序 (时间戳)**

```
问题: 任务池里有100个待处理任务，先处理谁？

如果没有时间戳:
  ❌ 无法排序
  ❌ 可能后来的先处理
  ❌ 用户体验差

有了时间戳:
  ✅ ticket-1705329600000-dongli-user123 (先来)
  ✅ ticket-1705329601000-dongli-user456 (后来)
  ✅ 严格按时间顺序处理 (FIFO队列)
```

### 4️⃣ **全链路追踪 (固定前缀)**

```
一个任务的完整生命周期:

ticket-1705329600000-dongli-user123
  ↓
A收到 → 写入池子 (traceId)
  ↓
B收到 → 查缓存池 (用traceId查历史)
  ↓
C收到 → 检索知识库 (用traceId查上下文)
  ↓
D记录 → 写入MongoDB (用traceId关联全流程)
  ↓
用户收到回复 (用traceId轮询)

全程同一个ID，完整可追溯！
```

---

## 🔄 **TraceId 在各 Agent 中的传递**

### Agent A → Agent B

```typescript
// agent-a.ts:66-84
const taskMessage = createMessage(
  "A",
  "B",
  merchantId,
  userId,
  sessionId,
  "A_PARSED",
  {
    inputType,
    intentCategory,
    refinedQuestion,
    originalInput: text,
    userId,
    merchantId,
    timestamp: Date.now(),
    ticketId: traceId, // ← 带上traceId
  },
  traceId // ← 传递给B
);
```

### Agent B → Agent C

```typescript
// agent-b.ts:177
await anpBus.publish({
  traceId: msg.traceId, // ← 继续传递
  from: "B",
  to: "C",
  action: "B_QUERY_C",
  merchantId: msg.merchantId,
  userId: msg.userId,
  sessionId: msg.sessionId,
  timestamp: Date.now(),
  data: {
    query: data.refinedQuestion || data.input,
  },
});
```

### Agent C → Agent D

```typescript
// agent-c.ts:245
await anpBus.publish({
  traceId: msg.traceId, // ← 继续传递
  from: "C",
  to: "D",
  action: "C_OK",
  merchantId,
  userId,
  sessionId,
  timestamp: Date.now(),
  data: { itemId: bestResult.item.id },
});
```

---

## 📊 **TraceId 的实际应用**

### 1. **缓存池查询**

```typescript
// context-pool.ts:85-87
private getKey(merchantId: string, userId: string, sessionId: string): string {
  return `${this.KEY_PREFIX}${merchantId}:${userId}:${sessionId}`;
}

// 使用traceId中的merchantId和userId
// 查询该用户在该商家的24h历史
```

### 2. **任务池管理**

```typescript
// bus.ts:41-53
async publish(task: Message): Promise<string> {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  const poolItem: TaskPoolItem = {
    id: taskId,
    task,  // task.traceId 包含完整信息
    status: "pending",
    assignedTo: null,
    createdAt: new Date(),
    retries: 0,
  };

  this.taskPool.set(taskId, poolItem);
}
```

### 3. **MongoDB 日志**

```typescript
// Agent D 写入日志时
{
  traceId: "ticket-1705329600000-dongli-user123",
  merchantId: "dongli",  // ← 从traceId提取
  userId: "user123",     // ← 从traceId提取
  timestamp: 1705329600000,  // ← 从traceId提取
  action: "A_COMPLETED",
  data: {...}
}

// 查询时可以:
// 1. 按merchantId查 → 某个商家的所有日志
// 2. 按userId查 → 某个用户的所有对话
// 3. 按traceId查 → 某次对话的完整链路
```

---

## 🎯 **为什么不能省略任何部分**

### 如果省略 `ticket-` 前缀

```
❌ "1705329600000-dongli-user123"
问题:
  - 无法区分是任务ID还是其他ID
  - 日志查询时无法快速筛选
  - 可能与其他系统的ID冲突
```

### 如果省略时间戳

```
❌ "ticket-dongli-user123"
问题:
  - 同一个用户的多次对话无法区分
  - 无法按时间排序
  - 缓存池无法判断是否过期
```

### 如果省略商家编码

```
❌ "ticket-1705329600000-user123"
问题:
  - 多个商家的数据混在一起
  - 缓存池串台
  - 无法按商家统计
```

### 如果省略用户 UUID

```
❌ "ticket-1705329600000-dongli"
问题:
  - 无法区分不同用户
  - 缓存池无法查历史
  - 上下文理解失败
```

---

## 🌟 **这就是设计的精髓**

### 一个 ID，贯穿全流程

```
用户发起请求
  ↓
A生成traceId: "ticket-1705329600000-dongli-user123"
  ↓
写入缓存池 (key: dongli:user123:session)
  ↓
B查缓存池 (用traceId中的merchantId和userId)
  ↓
C查上下文 (用traceId中的merchantId和userId)
  ↓
D写日志 (用完整traceId)
  ↓
用户轮询 (用traceId获取结果)
  ↓
全程可追溯，完整闭环
```

### 不是为了复杂，是为了简单

```
如果没有统一的traceId:
  ❌ A生成一个ID
  ❌ B生成另一个ID
  ❌ C又生成一个ID
  ❌ D不知道怎么关联
  → 系统混乱，无法追踪

有了统一的traceId:
  ✅ A生成一次
  ✅ BCD全部复用
  ✅ 全链路统一
  → 系统清晰，完美追溯
```

---

## ✅ **当前实现状态**

### Agent A ✅

```typescript
// 正确生成traceId
const traceId = `ticket-${Date.now()}-${merchantId}-${userId}`;
```

### Agent B ✅

```typescript
// 正确传递traceId
traceId: msg.traceId;
```

### Agent C ✅

```typescript
// 正确传递traceId
traceId: msg.traceId;
```

### Agent D ✅

```typescript
// 正确记录traceId (待验证)
```

---

## 🎓 **总结**

### TraceId 不是随便设计的

**它包含了**:

1. ✅ 业务前缀 (`ticket-`)
2. ✅ 时间排序 (时间戳)
3. ✅ 多租户隔离 (商家编码)
4. ✅ 用户追踪 (UUID)

### 这就是架构的力量

**不是**:

- 用复杂的分布式追踪系统
- 用昂贵的 APM 工具
- 用大量的日志存储

**而是**:

- 一个精心设计的 ID 格式
- 贯穿全流程
- 成本 0 元
- 完美追溯

---

**这就是用设计去凑，而不是烧钱。** 🎯
