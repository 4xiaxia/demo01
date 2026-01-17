# 🤖 Agent 模型配置说明

> **更新时间**: 2026-01-15 22:46  
> **配置状态**: 已按用户要求修正

---

## 📋 模型分配表

| Agent       | 职责             | 使用模型         | 提供商          | API Key               | 状态        |
| ----------- | ---------------- | ---------------- | --------------- | --------------------- | ----------- | --- |
| **Agent A** | 意图识别+ASR     | `whisper-medium` | 智谱 GLM        | `VITE_ZHIPU_API_KEY`  | ✅ 已配置   |
| **Agent B** | 决策中心+AI 兜底 | `GLM-4.5-Flash`  | 智谱 GLM (免费) | `VITE_ZHIPU_API_KEY`  | ✅ 已修正   |     |
| **Agent C** | 知识库检索       | `Qwen/Qwen3-8`   | 硅基流动        | `SILICONFLOW_API_KEY` | ⚠️ 待实现   |
| **Agent D** | 监控日志         | 无需 AI          | -               | -                     | ✅ 无需配置 |

---

## 🔧 详细配置

### Agent A - 语音识别 (ASR)

**文件**: `server/agents/agent-a.ts:184-195`

```typescript
// 使用智谱 Whisper-Medium
const response = await fetch("https://open.bigmodel.cn/api/paas/v4/audio/transcriptions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`, // VITE_ZHIPU_API_KEY
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    file: base64,
    model: "whisper-medium",
  }),
});
```

**用途**:

- 语音转文字
- 处理用户语音输入
- 限制 60 秒内

---

### Agent B - AI 兜底 (智谱免费版)

**文件**: `server/server.ts:307-362` (已修正)

```typescript
// 默认使用智谱 GLM-4-Flash (免费版)
const { provider = "zhipu", model = "GLM-4-Flash", messages } = req.body;

const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`, // VITE_ZHIPU_API_KEY
  },
  body: JSON.stringify({
    model,
    messages,
    max_tokens: 500,
  }),
});
```

**用途**:

- 知识库未找到答案时的 AI 兜底
- 闲聊回复生成
- 温柔引导用户

**调用场景**:

1. Agent C 未找到答案 → B 调用 AI 兜底
2. CHITCHAT 闲聊 → B 调用 AI 温柔回复

---

### Agent C - 知识库检索 (待增强)

**当前状态**: 只做关键词检索，未使用 AI

**计划增强**: 使用硅基流动 Qwen/Qwen3-8 做智能理解

**文件**: `server/agents/agent-c.ts:260-296` (待修改)

```typescript
// 当前: 简单关键词匹配
private smartSearch(query: string): SearchResult[] {
  // 关键词精确匹配
  // 标题模糊匹配
  // 内容模糊匹配
}

// 计划: 增加AI语义理解
private async aiEnhancedSearch(query: string): Promise<SearchResult[]> {
  // 使用 Qwen/Qwen3-8 理解查询意图
  // 语义匹配知识库
  // 结合上下文优选
}
```

**需要实现的功能**:

1. **语义理解**: 用户问"那边门票多少钱" → AI 理解"那边"指代
2. **多结果优选**: 命中多条时，用 AI 结合上下文选最佳
3. **模糊匹配**: 用户问法不标准时，AI 理解真实意图

---

## 🔑 环境变量配置

### .env 文件 (已配置)

```bash
# 智谱 GLM (Agent A + Agent B)
VITE_ZHIPU_API_KEY=a049afdafb1b41a0862cdc1d73d5d6eb.YuGYXVGRQEUILpog

# 硅基流动 (Agent C 待用)
VITE_SILICONFLOW_API_KEY=sk-vkggbmtfcqjjtmkphjupzyhorvjilexvhjweuphtxzzdksvw
SILICONFLOW_API_KEY=sk-vkggbmtfcqjjtmkphjupzyhorvjilexvhjweuphtxzzdksvw

# 阿里云 DashScope (备用)
VITE_DASHSCOPE_API_KEY=sk-0ecae1777d2240ea88064fa3a5a645b3
```

---

## 📊 成本分析

### 智谱 GLM (Agent A + B)

| 服务 | 模型           | 计费         | 用途               |
| ---- | -------------- | ------------ | ------------------ |
| ASR  | whisper-medium | 0.0002 元/秒 | Agent A 语音转文字 |
| LLM  | GLM-4-Flash    | **免费**     | Agent B AI 兜底    |

**日成本估算** (1000 次对话):

- 语音对话 (30%): 300 次 × 平均 3 秒 × 0.0002 元 = 0.18 元
- AI 兜底 (10%): 100 次 × 免费 = 0 元
- **合计**: ~0.18 元/天

### 硅基流动 (Agent C 待用)

| 服务 | 模型         | 计费              | 用途             |
| ---- | ------------ | ----------------- | ---------------- |
| LLM  | Qwen/Qwen3-8 | **免费** (有余额) | Agent C 语义理解 |

**优势**:

- 免费额度充足
- 适合高频调用
- 语义理解能力强

---

## ✅ 下一步工作

### 1. Agent C 增强 (优先级 P1)

**目标**: 实现 AI 语义理解，处理指代词问题

**步骤**:

1. 创建 `server/lib/qwen-api.ts` - 封装硅基流动 API
2. 修改 `agent-c.ts` - 增加 `aiEnhancedSearch()` 方法
3. 实现指代词理解 - "那边" → 查上下文 → "东里村"
4. 测试多轮对话场景

**预期效果**:

```
用户1: "东里村在哪里?"
回复: "福建省莆田市..."

用户2: "那边门票多少钱?" ← AI理解"那边"="东里村"
回复: "东里村成人票60元..."
```

### 2. Agent B 闲聊优化 (优先级 P2)

**目标**: 温柔处理闲聊，引导业务

**当前**: 返回固定文案
**优化**: 调用 GLM-4-Flash 生成个性化回复

---

## 🔍 验证方法

### 测试 Agent A (智谱 ASR)

```bash
# 发送语音输入
curl -X POST http://localhost:3000/api/process-input \
  -F "userId=test123" \
  -F "sessionId=sess123" \
  -F "merchantId=dongli" \
  -F "inputType=voice" \
  -F "audio=@test.wav"

# 查看日志
[A哥] 使用智谱 whisper-medium 转写...
```

### 测试 Agent B (智谱免费版)

```bash
# 触发AI兜底
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "zhipu",
    "model": "GLM-4-Flash",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'

# 查看日志
[Server] AI Chat: provider=zhipu, model=GLM-4-Flash
```

### 测试 Agent C (待实现)

```bash
# 当前: 关键词检索
[C哥] 🔍 收到查询: "那边门票多少钱"
[C哥] ❌ 未找到答案 (无法理解"那边")

# 期望: AI语义理解
[C哥] 🔍 收到查询: "那边门票多少钱"
[C哥] 🤖 AI理解: "那边" → 查上下文 → "东里村"
[C哥] ✅ 找到答案: 门票价格
```

---

**配置状态**: ✅ Agent A/B 已修正，Agent C 待增强
