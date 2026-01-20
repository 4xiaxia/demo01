# 🛠️ 修复优先级清单 - 代码洁癖友好版

> **原则**: 从核心到外围，从底层到上层，从数据到 UI

---

## 📋 **修复路线图**

```
第一层: 数据层（底层基础）
  ↓
第二层: Agent层（核心逻辑）
  ↓
第三层: API层（接口）
  ↓
第四层: UI层（前端）
```

---

## 🎯 **P0 - 核心基础（必须先修）**

### ✅ 已完成

- [x] Context Pool (Redis) - 已实现并连接 Dragonfly
- [x] Agent A/B/C/D - 已实现基本逻辑
- [x] TraceId 传递 - 已验证正确
- [x] 模型配置 - Agent A(智谱), B(GLM-4-Flash), C(Qwen2.5-7B)

### 🔧 需要修复

#### 1. **Agent B - 添加热门问题查询** ⭐⭐⭐

**文件**: `server/agents/agent-b.ts`

**当前问题**:

- 只查用户历史缓存
- 没有查商户热门问题

**修复内容**:

```typescript
// 在 handleInput 中添加第二层缓存
// 第一层: 用户历史缓存 ✅ (已有)
// 第二层: 商户热门问题 ❌ (需要添加)
// 第三层: 查知识库 ✅ (已有)
```

**预计时间**: 30 分钟

---

#### 2. **Agent C - AI 智能优选** ⭐⭐⭐

**文件**: `server/agents/agent-c.ts`

**当前状态**:

- ✅ 已实现 AI 优选逻辑
- ⚠️ 需要测试验证

**修复内容**:

- 验证 AI 优选是否正常工作
- 确保降级方案正常

**预计时间**: 15 分钟

---

#### 3. **Server - 注册热门问题路由** ⭐⭐

**文件**: `server/server.ts`

**当前问题**:

- 热门问题 API 路由未注册

**修复内容**:

```typescript
import { registerHotQuestionsRoutes } from "./routes/hot-questions";

// 注册路由
await registerHotQuestionsRoutes(server);
```

**预计时间**: 10 分钟

---

## 🎯 **P1 - 后台功能（重要但不紧急）**

#### 4. **后台 - 热门问题管理页面** ⭐⭐

**文件**: `src/App.tsx`, `src/views/admin/HotQuestionsPage.tsx`

**当前问题**:

- 页面已创建，但未添加到路由

**修复内容**:

```typescript
// src/App.tsx
import { HotQuestionsPage } from "./views/admin/HotQuestionsPage";

// 添加路由
<Route path="hot-questions" element={<HotQuestionsPage />} />;
```

**预计时间**: 10 分钟

---

#### 5. **后台 - 监控面板连接真实数据** ⭐⭐

**文件**: `src/views/admin/MonitorPage.tsx`

**当前问题**:

- 显示假数据（Math.random()）

**修复内容**:

- 创建 `/api/monitor/stats` API
- 从 Agent D 获取真实统计
- 更新 MonitorPage 连接 API

**预计时间**: 45 分钟

---

#### 6. **后台 - 知识库保存 API** ⭐⭐

**文件**: `server/routes/knowledge.ts` (需创建)

**当前问题**:

- KnowledgePage 前端完整，但后端 API 不存在

**修复内容**:

- 创建 PUT `/api/merchant/:id/knowledge`
- 实现保存到 JSON 文件
- 实现 AI 智能整理功能

**预计时间**: 1 小时

---

## 🎯 **P2 - 优化增强（可以后做）**

#### 7. **Agent D - MongoDB 持久化** ⭐

**文件**: `server/agents/agent-d.ts`

**当前问题**:

- 使用内存日志，重启丢失

**修复内容**:

- 连接 MongoDB
- 写入 user_logs 表
- 实现 24h 自动清理

**预计时间**: 1 小时

---

#### 8. **前端 - 修复 Lint 错误** ⭐

**文件**: 多个文件

**当前问题**:

- 一些 TypeScript 类型错误
- 一些未使用的变量

**修复内容**:

- 运行 `npm run lint`
- 逐个修复错误

**预计时间**: 30 分钟

---

## 📝 **建议的修复顺序**

### **第一天（核心功能）**

```
上午:
  1. ✅ Agent B - 添加热门问题查询 (30分钟)
  2. ✅ Agent C - 验证AI优选 (15分钟)
  3. ✅ Server - 注册热门问题路由 (10分钟)

  → 测试: 用户提问 → 热门问题命中 ✅

下午:
  4. ✅ 后台 - 热门问题管理页面路由 (10分钟)
  5. ✅ 后台 - 知识库保存API (1小时)

  → 测试: 后台添加热门问题 → 前台命中 ✅
```

### **第二天（监控和优化）**

```
上午:
  6. ✅ 后台 - 监控面板真实数据 (45分钟)
  7. ✅ Agent D - MongoDB持久化 (1小时)

  → 测试: 后台查看真实统计 ✅

下午:
  8. ✅ 前端 - 修复Lint错误 (30分钟)
  9. ✅ 整体测试 + 文档整理 (1小时)
```

---

## 🎯 **立即开始：第一步**

### **从 Agent B 开始** ⭐⭐⭐

**为什么先修这个？**

1. ✅ 核心功能（热门问题缓存）
2. ✅ 影响用户体验
3. ✅ 修复简单（30 分钟）
4. ✅ 立即可测试

**具体步骤**:

```typescript
// server/agents/agent-b.ts

// 1. 添加热门问题查询方法
private async checkMerchantHotQuestions(
  merchantId: string,
  query: string
): Promise<{ id: string; answer: string } | null> {
  // 实现逻辑...
}

// 2. 在handleInput中调用
private async handleInput(msg: Message) {
  // ... 第一层：用户历史缓存 (已有)

  // 第二层：商户热门问题 (新增)
  const hotAnswer = await this.checkMerchantHotQuestions(merchantId, query);
  if (hotAnswer) {
    console.log(`[B哥] 🔥 商户热门问题命中`);
    await this.replyUser(msg, hotAnswer.answer, "hot_question", Date.now() - startTime);
    return;
  }

  // ... 第三层：查知识库 (已有)
}
```

---

## 🧹 **代码洁癖检查清单**

### **修复前检查**

- [ ] 文件命名规范（kebab-case）
- [ ] 类型定义完整（无 any）
- [ ] 注释清晰（中文说明）
- [ ] 错误处理完善（try-catch）
- [ ] 日志输出统一（console.log 格式）

### **修复后检查**

- [ ] `npm run lint` 无错误
- [ ] `npm run build` 成功
- [ ] 功能测试通过
- [ ] 代码格式化（Prettier）
- [ ] Git 提交信息清晰

---

## 🚀 **现在开始？**

**建议从这里开始**:

1. ✅ 先修复 **Agent B 热门问题查询** (30 分钟)
2. ✅ 测试验证功能正常
3. ✅ 然后继续下一个

**需要我立即帮你修复 Agent B 吗？**

---

**记住：一次只修一个，修完测试，再修下一个。**

**代码洁癖的正确姿势：小步快跑，频繁测试。** 🧹✨
