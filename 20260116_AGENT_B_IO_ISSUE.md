# ⚠️ Agent B I/O 性能问题分析报告

> **发现时间**: 2026-01-16 16:25  
> **严重程度**: 🔴 高 (P1)  
> **影响**: 性能瓶颈

---

## 🐛 问题描述

### 核心问题

**Agent B 每次处理请求都会读取文件系统**

在 `checkMerchantHotQuestions()` 方法中（第 258-310 行）：

```typescript
private async checkMerchantHotQuestions(merchantId: string, query: string) {
  // ⚠️ 问题：每次都读取文件
  const content = await fs.readFile(hotQuestionsPath, "utf-8");
  const data = JSON.parse(content);

  // 然后遍历匹配...
}
```

### 影响分析

```
每个用户请求:
  1. Redis查询 (Context Pool) - 快 ✅
  2. 文件读取 (hot-questions.json) - 慢 ❌ ← 问题在这里
  3. JSON解析 - 慢 ❌
  4. 关键词匹配 - 快 ✅
```

**性能影响**:

- 文件 I/O: ~10-50ms (取决于磁盘速度)
- JSON 解析: ~1-5ms
- **总计**: 每次请求增加 11-55ms

**并发影响**:

- 10 个并发请求 = 10 次文件读取
- 100 个并发请求 = 100 次文件读取
- 可能导致磁盘 I/O 瓶颈

---

## 📊 性能对比

### 当前实现 (文件读取)

```
请求1: Redis(5ms) + 文件读取(20ms) + JSON解析(2ms) = 27ms
请求2: Redis(5ms) + 文件读取(20ms) + JSON解析(2ms) = 27ms
请求3: Redis(5ms) + 文件读取(20ms) + JSON解析(2ms) = 27ms
...
10个请求总计: 270ms
```

### 优化后 (内存缓存)

```
请求1: Redis(5ms) + 内存读取(0.1ms) = 5.1ms
请求2: Redis(5ms) + 内存读取(0.1ms) = 5.1ms
请求3: Redis(5ms) + 内存读取(0.1ms) = 5.1ms
...
10个请求总计: 51ms

性能提升: 5.3倍 🚀
```

---

## 💡 解决方案

### 方案 1: 内存缓存 (推荐)

**实现代码**:

```typescript
class AgentB {
  // 添加缓存
  private hotQuestionsCache = new Map<
    string,
    {
      data: HotQuestion[];
      timestamp: number;
    }
  >();

  private CACHE_TTL = 5 * 60 * 1000; // 5分钟

  /**
   * 检查商户热门问题（带缓存）
   */
  private async checkMerchantHotQuestions(
    merchantId: string,
    query: string
  ): Promise<{ id: string; answer: string } | null> {
    // 1. 检查缓存
    const cached = this.hotQuestionsCache.get(merchantId);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      // 缓存命中，直接使用
      return this.matchHotQuestion(cached.data, query);
    }

    // 2. 缓存未命中，从文件加载
    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      const hotQuestionsPath = path.join(
        process.cwd(),
        "server",
        "merchant",
        merchantId,
        "hot-questions.json"
      );

      const content = await fs.readFile(hotQuestionsPath, "utf-8");
      const data = JSON.parse(content);

      // 3. 更新缓存
      this.hotQuestionsCache.set(merchantId, {
        data: data.hotQuestions,
        timestamp: Date.now(),
      });

      // 4. 匹配并返回
      return this.matchHotQuestion(data.hotQuestions, query);
    } catch (error) {
      console.error(`[${this.name}] 读取热门问题失败:`, error);
      return null;
    }
  }

  /**
   * 匹配热门问题（提取为独立方法）
   */
  private matchHotQuestion(
    hotQuestions: HotQuestion[],
    query: string
  ): { id: string; answer: string } | null {
    const queryLower = query.toLowerCase();

    for (const hot of hotQuestions) {
      if (!hot.enabled) continue;

      for (const keyword of hot.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          return {
            id: hot.id,
            answer: hot.answer,
          };
        }
      }
    }

    return null;
  }

  /**
   * 手动刷新缓存（供API调用）
   */
  public refreshHotQuestionsCache(merchantId: string) {
    this.hotQuestionsCache.delete(merchantId);
    console.log(`[${this.name}] 已清除 ${merchantId} 的热门问题缓存`);
  }
}
```

**优点**:

- ✅ 性能提升 5-10 倍
- ✅ 减少磁盘 I/O
- ✅ 支持高并发
- ✅ 实现简单

**缺点**:

- ⚠️ 需要手动刷新缓存（或定时刷新）

---

### 方案 2: 启动时预加载

```typescript
class AgentB {
  private hotQuestions = new Map<string, HotQuestion[]>()

  async init() {
    // 启动时加载所有商户的热门问题
    const merchants = await this.getAllMerchants()

    for (const merchantId of merchants) {
      await this.loadHotQuestions(merchantId)
    }
  }

  private async loadHotQuestions(merchantId: string) {
    // 从文件加载并缓存
    const data = await fs.readFile(...)
    this.hotQuestions.set(merchantId, JSON.parse(data).hotQuestions)
  }
}
```

**优点**:

- ✅ 启动后完全无 I/O
- ✅ 性能最优

**缺点**:

- ⚠️ 启动时间增加
- ⚠️ 需要监听文件变化

---

### 方案 3: Redis 缓存

```typescript
private async checkMerchantHotQuestions(merchantId: string, query: string) {
  // 1. 从Redis读取
  const cached = await redis.get(`hot:${merchantId}`)

  if (cached) {
    return this.matchHotQuestion(JSON.parse(cached), query)
  }

  // 2. 从文件加载并写入Redis
  const data = await fs.readFile(...)
  await redis.setex(`hot:${merchantId}`, 300, JSON.stringify(data))

  return this.matchHotQuestion(data, query)
}
```

**优点**:

- ✅ 多进程共享缓存
- ✅ 支持分布式部署

**缺点**:

- ⚠️ 增加 Redis 依赖
- ⚠️ 网络 I/O 开销

---

## 🎯 推荐方案

**推荐使用方案 1: 内存缓存**

**理由**:

1. 实现简单，改动最小
2. 性能提升明显 (5-10 倍)
3. 不增加外部依赖
4. 5 分钟 TTL 足够平衡性能和实时性

---

## 📋 实施计划

### Step 1: 添加缓存机制 (15 分钟)

```typescript
// 1. 添加缓存字段
private hotQuestionsCache = new Map<...>()
private CACHE_TTL = 5 * 60 * 1000

// 2. 修改checkMerchantHotQuestions方法
// 3. 提取matchHotQuestion方法
```

### Step 2: 添加刷新 API (10 分钟)

```typescript
// server/server.ts
server.post("/api/merchant/:id/hot-questions/refresh", async (req, reply) => {
  const { id } = req.params;
  agentB.refreshHotQuestionsCache(id);
  return { success: true, message: "缓存已刷新" };
});
```

### Step 3: 测试验证 (5 分钟)

```bash
# 测试缓存命中
# 测试缓存过期
# 测试手动刷新
```

**总计时间**: 30 分钟

---

## 📊 预期效果

### 性能提升

```
场景: 100个并发请求

优化前:
  热门问题检查: 20ms × 100 = 2000ms
  总响应时间: ~2500ms

优化后:
  热门问题检查: 0.1ms × 100 = 10ms
  总响应时间: ~500ms

性能提升: 5倍 🚀
```

### 资源节省

```
磁盘I/O: 减少 95%
CPU使用: 减少 30% (JSON解析减少)
内存增加: ~10KB (可忽略)
```

---

## ⚠️ 其他潜在 I/O 问题

### 已检查

1. **Context Pool** ✅ - 使用 Redis，无问题
2. **知识库检索** ⏳ - Agent C 也可能有类似问题
3. **配置读取** ⏳ - 需要检查

### 建议检查

- [ ] Agent C 的知识库加载
- [ ] ConfigManager 的配置读取
- [ ] 其他文件读取操作

---

## 🎉 总结

**问题**: Agent B 每次请求都读取文件，造成 I/O 瓶颈

**影响**: 性能下降 20-50ms，并发能力受限

**解决方案**: 添加内存缓存，5 分钟 TTL

**预期效果**: 性能提升 5 倍，支持更高并发

**实施时间**: 30 分钟

**优先级**: 🔴 P1 (高)

---

**报告时间**: 2026-01-16 16:25  
**建议**: 立即实施优化
