# 🔑 为什么不传递上下文，只传递 UUID？

> **核心设计**: Agent 之间只传递"钥匙"（UUID+时间戳），不传递"数据"

---

## ❌ **错误的设计：传递上下文数据**

### 传统方案（会串线）

```typescript
// ❌ 错误：A把上下文数据传给B
A → B: {
  traceId: "ticket-xxx-dongli-user123",
  question: "门票多少钱",
  context: [  // ❌ 传递了上下文数据
    { role: "user", content: "东里村在哪" },
    { role: "assistant", content: "福建省..." },
    { role: "user", content: "门票多少钱" }
  ]
}

// ❌ 错误：B把上下文数据传给C
B → C: {
  traceId: "ticket-xxx-dongli-user123",
  query: "门票价格",
  context: [  // ❌ 又传递了一遍
    { role: "user", content: "东里村在哪" },
    { role: "assistant", content: "福建省..." },
    { role: "user", content: "门票多少钱" }
  ]
}
```

### 问题：多用户并发时会串线

```
时刻1: 用户A问 "门票多少钱"
  ↓
A → B: { context: [用户A的历史] }
  ↓
B正在处理...

时刻2: 用户B也问 "门票多少钱"
  ↓
A → B: { context: [用户B的历史] }  // ❌ 覆盖了用户A的上下文！
  ↓
B处理完成，但用的是用户B的上下文
  ↓
用户A收到了错误的回复！ ❌
```

---

## ✅ **正确的设计：只传递 UUID，自己查池子**

### 你的方案（不会串线）

```typescript
// ✅ 正确：A只传递UUID和时间戳
A → B: {
  traceId: "ticket-1705329600000-dongli-user123",
  merchantId: "dongli",
  userId: "user123",
  sessionId: "session_abc",
  question: "门票多少钱",
  // ✅ 不传递context数据
}

// ✅ 正确：B需要上下文时，自己去池子查
B收到消息:
  1. 提取: merchantId="dongli", userId="user123"
  2. 查池子: contextPool.getRecentTurns(merchantId, userId, sessionId, 5)
  3. 得到该用户的最近5条对话
  4. 处理完成

// ✅ 正确：C需要上下文时，也自己去池子查
C收到消息:
  1. 提取: merchantId="dongli", userId="user123"
  2. 查池子: contextPool.getRecentTurns(merchantId, userId, sessionId, 3)
  3. 得到该用户的最近3条对话
  4. 智能选择答案
```

### 多用户并发：完全不会串线

```
时刻1: 用户A问 "门票多少钱"
  ↓
A → B: {
  traceId: "ticket-1705329600000-dongli-userA",
  userId: "userA"  // ✅ 只传UUID
}
  ↓
B查池子: contextPool.getRecentTurns("dongli", "userA", ...)
  → 得到用户A的历史 ✅

时刻2: 用户B也问 "门票多少钱"
  ↓
A → B: {
  traceId: "ticket-1705329601000-dongli-userB",
  userId: "userB"  // ✅ 只传UUID
}
  ↓
B查池子: contextPool.getRecentTurns("dongli", "userB", ...)
  → 得到用户B的历史 ✅

结果:
  - 用户A收到基于用户A历史的回复 ✅
  - 用户B收到基于用户B历史的回复 ✅
  - 完全不会串线！
```

---

## 🎯 **为什么这样设计**

### 1. **池子是唯一数据源**

```
传统设计:
  上下文数据在消息中传来传去
  ❌ A传给B，B传给C，C传给D
  ❌ 数据冗余
  ❌ 容易不一致
  ❌ 容易串线

你的设计:
  上下文数据只存在池子里
  ✅ Agent需要时自己查
  ✅ 数据唯一
  ✅ 永远一致
  ✅ 不会串线
```

### 2. **UUID 是钥匙，不是数据**

```
消息中只传递:
  ✅ traceId: "ticket-时间戳-商家-用户"
  ✅ merchantId: "dongli"
  ✅ userId: "user123"
  ✅ sessionId: "session_abc"

这些是"钥匙"，用来查池子:
  key = "ctx:dongli:user123:session_abc"
  ↓
  Redis.lrange(key, -5, -1)  // 查最近5条
  ↓
  得到该用户的上下文
```

### 3. **时间戳保证顺序**

```
用户A:
  ticket-1705329600000-dongli-userA  (时间戳: 1705329600000)
  ↓
  池子: ctx:dongli:userA:session
  ↓
  按时间戳排序，先进先出

用户B:
  ticket-1705329601000-dongli-userB  (时间戳: 1705329601000)
  ↓
  池子: ctx:dongli:userB:session
  ↓
  完全独立，不会混淆
```

---

## 📊 **实际代码验证**

### Agent B 的正确实现

```typescript
// server/agents/agent-b.ts:100-117
private async handleInput(msg: Message) {
  const { merchantId, userId, sessionId } = msg;  // ✅ 只提取UUID
  const query = String(data.refinedQuestion || data.input || "");

  // ===== 第一层: 查用户历史缓存 =====
  const cachedAnswer = await contextPool.findSimilarAnswer(
    merchantId,   // ✅ 用UUID查池子
    userId,       // ✅ 不是传递context数据
    sessionId,
    query
  );

  if (cachedAnswer) {
    console.log(`[B哥] ⚡ 24h缓存命中`);
    await this.replyUser(msg, cachedAnswer, "cache", Date.now() - startTime);
    return;
  }
  // ...
}
```

### Context Pool 的实现

```typescript
// server/context-pool.ts:163-209
async findSimilarAnswer(
  merchantId: string,  // ✅ 接收UUID
  userId: string,      // ✅ 接收UUID
  sessionId: string,
  question: string
): Promise<string | null> {
  const key = this.getKey(merchantId, userId, sessionId);
  // key = "ctx:dongli:user123:session_abc"

  // ✅ 从Redis查该用户的历史
  const items = await this.redis.lrange(key, 0, -1);

  // ✅ 只查该用户的数据，不会串线
  const turns: ContextTurn[] = items.map(item => JSON.parse(item));

  // 查找相似问题...
}
```

### Agent C 的正确实现

```typescript
// server/agents/agent-c.ts:203-207
if (results.length > 1) {
  console.log(`[C哥] 📋 命中${results.length}条，结合上下文优选...`);

  // ✅ C需要上下文时，自己去池子查
  const context = await contextPool.getRecentTurns(
    merchantId, // ✅ 用UUID查池子
    userId, // ✅ 不是从消息中获取context
    sessionId,
    3
  );

  bestResult = await this.selectBestResult(
    results,
    context, // ✅ 这是C自己查到的，不是B传来的
    merchantId,
    userId,
    sessionId
  );
}
```

---

## 🎯 **关键优势**

### 1. **完全不会串线**

```
100个用户同时提问:
  - 每个用户有独立的UUID
  - 每个用户有独立的池子key
  - Agent查池子时用UUID
  - 完全隔离，不会混淆 ✅
```

### 2. **消息轻量**

```
传统方案:
  消息大小 = 基础字段 + 上下文数据（可能很大）
  ❌ 1KB + 10KB = 11KB

你的方案:
  消息大小 = 基础字段 + UUID
  ✅ 1KB + 0.1KB = 1.1KB

节省: 90%
```

### 3. **数据一致性**

```
传统方案:
  A传给B的context = v1
  B传给C的context = v2  // ❌ 可能不一致

你的方案:
  B查池子 = 最新数据
  C查池子 = 最新数据  // ✅ 永远一致
```

### 4. **易于扩展**

```
新增Agent E:
  ✅ 不需要修改消息格式
  ✅ 只需要用UUID查池子
  ✅ 立即可用
```

---

## 🌟 **总结**

### 设计原则

**不是**:

- ❌ 把上下文数据传来传去
- ❌ A 传给 B，B 传给 C
- ❌ 消息越来越大

**而是**:

- ✅ 只传递"钥匙"（UUID+时间戳）
- ✅ Agent 需要时自己去池子查
- ✅ 消息轻量，数据一致

### 这就是池子设计的精髓

```
池子 = 唯一数据源
UUID = 钥匙
Agent = 自己拿钥匙开门

不是搬运工，是图书馆用户
不是传递数据，是查询数据
不是复制粘贴，是按需获取
```

**这就是为什么 100 个用户并发也不会串线！** 🔑
