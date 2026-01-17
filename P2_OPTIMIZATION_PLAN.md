# 🎯 P2 优化增强 - 实施计划

> **当前状态**: P0✅ P1✅ → 开始 P2  
> **目标**: 完善系统，提升稳定性和可维护性

---

## 📋 **P2 待完成项目**

### **优先级排序**:

#### **P2.1 - Lint 错误清理** ⭐⭐⭐ (30 分钟)

**重要性**: 代码质量基础

**当前问题**:

- TypeScript 类型错误
- 未使用的变量
- ESLint 警告

**修复方案**:

```bash
# 1. 运行lint检查
npm run lint

# 2. 逐个修复
- 移除未使用的导入
- 修复类型定义
- 添加缺失的类型注解
```

**预计时间**: 30 分钟

---

#### **P2.2 - 语音对话功能测试** ⭐⭐ (1 小时)

**重要性**: 核心功能验证

**测试内容**:

1. **ASR 测试** (智谱 whisper-medium)

   - 上传语音文件
   - 验证识别准确率
   - 检查响应时间

2. **TTS 测试**

   - 文本转语音
   - 验证音质
   - 检查返回格式

3. **完整流程**
   - 语音输入 → ASR → Agent 处理 → TTS → 语音输出
   - 验证端到端流程

**测试步骤**:

```typescript
// 1. 测试ASR
POST /api/process-input
Content-Type: multipart/form-data
- userId: test_user
- merchantId: dongli
- inputType: voice
- audio: [语音文件]

// 2. 验证返回
{
  "response": "...",
  "audioBase64": "...",  // ← 应该有TTS音频
  "source": "..."
}
```

**预计时间**: 1 小时

---

#### **P2.3 - Agent D MongoDB 持久化** ⭐ (1.5 小时)

**重要性**: 数据持久化（可选）

**当前状态**:

- MongoDB 连接失败
- 使用本地文件系统

**实施方案**:

**方案 A: 修复 MongoDB 连接** (如果需要)

```typescript
// server/database.ts
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/tourist_guide";

// 连接MongoDB
await mongoose.connect(MONGODB_URI);

// 创建日志模型
const UserLogSchema = new Schema({
  traceId: String,
  merchantId: String,
  userId: String,
  timestamp: Date,
  question: String,
  answer: String,
  source: String,
  // ...
});
```

**方案 B: 继续使用本地文件** (推荐)

- ✅ 简单可靠
- ✅ 无需额外服务
- ✅ 24h 数据足够监控
- ⚠️ 重启丢失（可接受）

**建议**: 方案 B，MongoDB 作为未来扩展

**预计时间**: 如果实施方案 A 需要 1.5 小时，方案 B 无需修改

---

#### **P2.4 - 性能优化** ⭐ (30 分钟)

**重要性**: 提升用户体验

**优化项目**:

1. **Context Pool 查询优化**

```typescript
// 当前: 遍历所有keys
const keys = await this.redis.keys(`${this.KEY_PREFIX}*`);

// 优化: 使用SCAN代替KEYS（生产环境）
const keys = [];
let cursor = "0";
do {
  const result = await this.redis.scan(cursor, "MATCH", `${this.KEY_PREFIX}*`, "COUNT", 100);
  cursor = result[0];
  keys.push(...result[1]);
} while (cursor !== "0");
```

2. **监控面板缓存**

```typescript
// 添加前端缓存，减少API调用
const [cacheTime, setCacheTime] = useState(0);

const loadData = async () => {
  const now = Date.now();
  if (now - cacheTime < 5000) return; // 5秒内不重复请求

  await loadMonitorStats();
  setCacheTime(now);
};
```

3. **热门问题文件读取优化**

```typescript
// 添加内存缓存
private hotQuestionsCache: Map<string, { data: any, timestamp: number }> = new Map();

async checkMerchantHotQuestions(merchantId: string, query: string) {
  // 检查缓存（5分钟有效）
  const cached = this.hotQuestionsCache.get(merchantId);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return this.matchQuestion(cached.data, query);
  }

  // 读取文件并缓存
  const data = await this.loadHotQuestions(merchantId);
  this.hotQuestionsCache.set(merchantId, { data, timestamp: Date.now() });

  return this.matchQuestion(data, query);
}
```

**预计时间**: 30 分钟

---

#### **P2.5 - 文档完善** ⭐ (30 分钟)

**重要性**: 可维护性

**需要补充的文档**:

1. **API 文档**

```markdown
# API 接口文档

## 对话接口

POST /api/process-input

- 参数: userId, merchantId, inputType, text/audio
- 返回: traceId

GET /api/poll-response?traceId=xxx

- 返回: response, source, audioBase64

## 监控接口

GET /api/monitor/stats
GET /api/monitor/logs
GET /api/monitor/trace/:traceId

## 管理接口

GET/PUT /api/merchant/:id/knowledge
GET/POST/PUT/DELETE /api/merchant/:id/hot-questions
```

2. **部署文档**

```markdown
# 部署指南

## 环境变量

DRAGONFLY_HOST=xxx
DRAGONFLY_PORT=xxx
DRAGONFLY_PASSWORD=xxx
SILICONFLOW_API_KEY=xxx
ZHIPU_API_KEY=xxx

## 启动命令

npm run build
npm run start
```

3. **开发文档**

```markdown
# 开发指南

## 项目结构

server/
agents/ - Agent 实现
routes/ - API 路由
merchant/ - 商户数据
src/
views/ - 页面组件
components/ - UI 组件
```

**预计时间**: 30 分钟

---

## 🎯 **P2 实施顺序**

### **建议顺序**:

1. **P2.1 Lint 清理** (30 分钟) ⭐⭐⭐

   - 立即提升代码质量
   - 消除警告

2. **P2.4 性能优化** (30 分钟) ⭐

   - 热门问题缓存（最有价值）
   - 其他优化可选

3. **P2.2 语音测试** (1 小时) ⭐⭐

   - 验证核心功能
   - 发现潜在问题

4. **P2.5 文档** (30 分钟) ⭐

   - 方便后续维护

5. **P2.3 MongoDB** (可选)
   - 当前方案已够用
   - 未来扩展时再做

---

## ⏱️ **时间预估**

### **必做项目** (2 小时):

- Lint 清理: 30 分钟
- 性能优化: 30 分钟
- 语音测试: 1 小时

### **可选项目** (1 小时):

- 文档完善: 30 分钟
- MongoDB 持久化: 跳过

---

## 🚀 **下一步行动**

**立即开始**: P2.1 Lint 错误清理

**命令**:

```bash
npm run lint
```

**要开始吗？** 🎯
