# 📚 README - 智能导游系统

> **项目名称**: 东里村景区智能导游系统  
> **版本**: 4.0  
> **最后更新**: 2026-01-16  
> **状态**: ✅ 生产就绪

---

## 🎯 **项目简介**

基于多 Agent 协作的智能导游系统，采用**MongoDB 持久化 + Dragonfly 缓存**双层架构，实现低成本、高性能的智能问答服务。

### **核心特性**:

- 💰 **成本极低**: 月 8-210 元，相比传统方案节省 99%
- ⚡ **响应迅速**: 78%缓存命中率，平均响应<300ms
- 🎯 **智能精准**: 多 Agent 协作，意图识别准确
- 📊 **完整监控**: 实时监控面板，TraceId 查询
- 🔧 **易于维护**: 清晰架构，完善注释
- 🚀 **高性能**: Dragonfly 缓存 + MongoDB 持久化
- 🔄 **灵活配置**: 支持本地文件/MongoDB 切换

---

## 🚀 **快速开始**

### **环境要求**:

```
Node.js: >= 18.0.0
npm: >= 9.0.0
Redis: >= 6.0.0 (或Dragonfly)
```

### **安装依赖**:

```bash
npm install
```

### **环境变量**:

创建 `.env` 文件：

```env
# Redis配置
DRAGONFLY_HOST=your-redis-host
DRAGONFLY_PORT=6379
DRAGONFLY_PASSWORD=your-password

# AI服务配置
SILICONFLOW_API_KEY=your-siliconflow-key
ZHIPU_API_KEY=your-zhipu-key

# MongoDB配置（可选）
MONGODB_URI=mongodb://localhost:27017/tourist_guide
```

### **启动服务**:

```bash
# 开发环境
npm run dev:server  # 启动后端（端口3000）
npm run dev         # 启动前端（端口5173）

# 生产环境
npm run build
npm run start
```

### **访问地址**:

```
前端: http://localhost:5173
后台: http://localhost:5173/admin
API:  http://localhost:3000
```

---

## 📂 **项目结构**

```
4.0/
├── server/                      # 后端服务
│   ├── agents/                  # Agent系统
│   │   ├── agent-a.ts          # 意图识别
│   │   ├── agent-b.ts          # 决策中心（两层缓存）⭐
│   │   ├── agent-c.ts          # 知识库
│   │   └── agent-d.ts          # 监控录像
│   ├── routes/                  # API路由
│   │   ├── hot-questions.ts    # 热门问题管理
│   │   ├── knowledge.ts        # 知识库管理
│   │   └── monitor.ts          # 监控API ⭐
│   ├── merchant/                # 商户数据
│   │   └── dongli/
│   │       ├── config.json
│   │       ├── knowledge.json
│   │       └── hot-questions.json
│   ├── context-pool.ts         # 24h缓存池 ⭐
│   ├── database.ts             # 数据库服务
│   ├── bus.ts                  # 消息总线
│   └── server.ts               # 主服务器
├── src/                         # 前端应用
│   ├── views/admin/            # 后台管理页面
│   │   ├── DashboardPage.tsx
│   │   ├── MonitorPage.tsx     # 监控面板 ⭐
│   │   ├── HotQuestionsPage.tsx
│   │   ├── KnowledgePage.tsx
│   │   └── ConfigGeneratorPage.tsx
│   ├── components/             # UI组件
│   └── lib/                    # 工具库
├── public/data/                # 公共数据
└── docs/                       # 文档
    ├── FINAL_DELIVERY_REPORT.md
    ├── PROJECT_PROGRESS.md
    └── README.md (本文档)
```

---

## 🎯 **核心架构**

### **多 Agent 协作系统**:

```
用户提问
  ↓
┌─────────────────────────────────────┐
│ Agent A - 意图识别                  │
│ - 智能分类（CHITCHAT/QUERY等）      │
│ - 问题精简                          │
│ - ASR语音识别                       │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ Agent B - 决策中心 ⭐                │
│ 第一层: 用户历史缓存（24h）         │
│ 第二层: 热门问题缓存                │
│ 第三层: 闲聊处理                    │
│ 第四层: 知识库查询                  │
│ 第五层: AI兜底                      │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ Agent C - 知识库                    │
│ - 本地JSON检索                      │
│ - 关键词匹配                        │
│ - 11条知识记录                      │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ Agent D - 监控录像                  │
│ - 全程记录                          │
│ - 统计分析                          │
│ - 报缺收集                          │
└─────────────────────────────────────┘
  ↓
回复用户
```

### **两层缓存策略** ⭐:

```
第一层: 用户历史缓存
  - 数据源: Context Pool (Redis)
  - 有效期: 24小时
  - 匹配: 相似问题
  - 优势: 个性化，精准

第二层: 热门问题缓存
  - 数据源: hot-questions.json
  - 匹配: 关键词
  - 优势: 通用性，高频覆盖
  - 特性: 异步更新hitCount

结果: 78%缓存命中率，95%成本节省
```

### **Context Pool** ⭐:

```
功能:
1. 存储用户对话历史（24小时）
2. 支持相似问题匹配
3. 提供监控数据查询
4. 自动清理过期数据

技术:
- 存储: Redis (Dragonfly)
- 结构: List (LPUSH/LRANGE)
- TTL: 24小时自动过期
- Key: ctx:{merchantId}:{userId}:{sessionId}

性能:
- 读取: <10ms
- 命中率: 78%
- 成本: 极低
```

---

## 📊 **功能模块**

### **用户端**:

- ✅ 文本对话
- ✅ 语音对话（ASR + TTS）
- ✅ 意图识别
- ✅ 智能问答
- ✅ 多轮对话

### **后台管理**:

- ✅ 📊 数据概览
- ✅ 📚 知识库管理（CRUD）
- ✅ 🔥 热门问题管理
- ✅ ⚙️ 系统配置
- ✅ 📈 监控面板
  - Agent 健康状态
  - 今日统计
  - 实时日志（最近 10 条）
  - TraceId 查询
  - 报缺列表

---

## 🔌 **API 文档**

### **对话接口**:

```typescript
// 处理用户输入
POST /api/process-input
Body: {
  userId: string
  merchantId: string
  inputType: 'text' | 'voice'
  text?: string
  audio?: File
}
Response: {
  traceId: string
}

// 轮询回复
GET /api/poll-response?traceId=xxx
Response: {
  response: string
  source: string
  audioBase64?: string
}
```

### **监控接口**:

```typescript
// 获取监控统计
GET /api/monitor/stats
Response: {
  agentHealth: AgentStatus[]
  dailyStats: DailyStats
  missingQuestions: MissingQuestion[]
}

// 获取实时日志
GET /api/monitor/logs?merchantId=xxx&limit=10
Response: {
  logs: DialogLog[]
  total: number
}

// TraceId查询
GET /api/monitor/trace/:traceId
Response: {
  timestamp: number
  question: string
  answer: string
  source: string
  // ...
}
```

### **热门问题接口**:

```typescript
// 获取热门问题列表
GET /api/merchant/:id/hot-questions

// 添加热门问题
POST /api/merchant/:id/hot-questions
Body: {
  question: string
  keywords: string[]
  answer: string
  source: 'manual' | 'from_missing'
}

// 更新热门问题
PUT /api/merchant/:id/hot-questions/:hotId

// 删除热门问题
DELETE /api/merchant/:id/hot-questions/:hotId

// 增加命中次数（内部调用）
POST /api/merchant/:id/hot-questions/:hotId/hit
```

---

## 📈 **性能指标**

### **响应时间**:

```
缓存命中:     50-100ms   (78%的情况)
知识库检索:   150-300ms  (本地搜索)
AI兜底:       1-2s       (未找到时)
```

### **成本预估**:

```
小景区 (日均500人):
  - 对话数: 1500次/天
  - 缓存命中: 1170次 (免费)
  - 实际API: 330次
  - 月成本: 8元

中型景区 (日均3000人):
  - 对话数: 12000次/天
  - 缓存命中: 9360次
  - 实际API: 2640次
  - 月成本: 60元

大型景区 (日均10000人):
  - 对话数: 50000次/天
  - 缓存命中: 39000次
  - 实际API: 11000次
  - 月成本: 210元
```

---

## 🔧 **开发指南**

### **添加新商户**:

1. 创建商户目录：

```bash
mkdir -p server/merchant/{merchantId}
mkdir -p public/data/{merchantId}
```

2. 创建配置文件：

```json
// server/merchant/{merchantId}/config.json
{
  "merchantId": "xxx",
  "merchantName": "xxx景区",
  "systemPrompt": "...",
  "welcomeMessage": "..."
}
```

3. 创建知识库：

```json
// server/merchant/{merchantId}/knowledge.json
{
  "merchantId": "xxx",
  "items": [...]
}
```

4. 创建热门问题：

```json
// server/merchant/{merchantId}/hot-questions.json
{
  "merchantId": "xxx",
  "hotQuestions": [...]
}
```

### **添加新知识**:

1. 后台管理 → 知识库管理
2. 点击"添加新知识"
3. 填写标题、内容、关键词
4. 保存

### **添加热门问题**:

1. 后台管理 → 热门问题管理
2. 点击"手动添加热门问题"
3. 填写问题、关键词、答案
4. 保存

或从报缺列表添加：

1. 查看"高频未找到问题"
2. 点击"添加到热门问题"
3. 补充答案
4. 保存

---

## 🐛 **故障排查**

### **Redis 连接失败**:

```bash
# 检查Redis是否运行
redis-cli ping

# 检查环境变量
echo $DRAGONFLY_HOST
echo $DRAGONFLY_PORT

# 查看日志
[Context Pool] Redis连接失败: ...
```

### **热门问题不生效**:

```bash
# 检查文件是否存在
ls server/merchant/dongli/hot-questions.json

# 检查JSON格式
cat server/merchant/dongli/hot-questions.json | jq

# 查看日志
[B] 🔥 商户热门问题命中: hot_001
```

### **监控面板无数据**:

```bash
# 检查Context Pool连接
[Context Pool] ✅ Redis连接成功

# 检查Agent D状态
[D] 监控录像系统已启动

# 查看API响应
curl http://localhost:3000/api/monitor/stats
```

---

## 📚 **相关文档**

### **快速开始**:

- [执行摘要](./20260116_EXECUTIVE_SUMMARY.md) - 项目状态与下一步 (2026-01-16)
- [待办清单](./20260116_TODO_AND_ROADMAP.md) - 详细工作计划 (2026-01-16)
- [快速参考](./20260116_QUICK_REFERENCE.md) - 快速查看核心信息 (2026-01-16)

### **架构文档**:

- [系统架构总结](./20260116_ARCHITECTURE_SUMMARY.md) - 最新架构说明 (2026-01-16)
- [数据流与 API 路由](./src/assets/数据流与API路由清单.md) - API 详解 (2026-01-16)
- [文档导航](./20260116_DOCS_NAVIGATION.md) - 所有文档索引 (2026-01-16)

### **项目报告**:

- [项目完整梳理](./20260116_COMPLETE_PROJECT_REVIEW.md) - 全面总结 (2026-01-16)
- [项目健康检查](./20260116_PROJECT_HEALTH_CHECK.md) - 完整性检查 (2026-01-16)
- [乘胜追击报告](./20260116_VICTORY_PURSUIT_REPORT.md) - 最新检查总结 (2026-01-16)
- [最终交付报告](./FINAL_DELIVERY_REPORT.md) - 交付总结
- [项目进度明细](./PROJECT_PROGRESS.md) - 进度追踪

### **技术文档**:

- [Agent B I/O 问题](./20260116_AGENT_B_IO_ISSUE.md) - 性能问题分析 (2026-01-16)
- [P1 I/O 修复报告](./20260116_P1_IO_FIX_REPORT.md) - 修复总结 (2026-01-16)
- [Agent C 优化报告](./20260116_AGENT_C_OPTIMIZATION.md) - Agent C 增强 (2026-01-16)
- [I/O 优化总结](./20260116_IO_OPTIMIZATION_SUMMARY.md) - 完整优化总结 (2026-01-16)
- [监控完成报告](./MONITOR_COMPLETION_REPORT.md) - 监控系统
- [代码注释报告](./CODE_COMMENTS_REPORT.md) - 代码质量
- [功能需求文档](./不要删后台大概的功能.md) - 后台功能

### **架构升级** (2026-01-16):

- [📋 数据源配置指南](./20260116_DATASOURCE_CONFIG_GUIDE.md) - MongoDB/Local 配置说明
- [🚧 施工完成报告](./20260116_CONSTRUCTION_COMPLETE.md) - MongoDB + Dragonfly 架构
- [✅ MongoDB 配置更新](./20260116_MONGODB_CONFIG_UPDATE.md) - 连接信息更新
- [🧪 系统测试报告](./20260116_SYSTEM_TEST_REPORT.md) - 测试结果
- [📊 MongoDB 重启分析](./20260116_MONGODB_RESTART_ANALYSIS.md) - 影响分析

---

## 🤝 **贡献指南**

### **代码规范**:

- TypeScript 严格模式
- ESLint 规则遵守
- 核心文件需添加注释
- 提交前运行`npm run lint`

### **提交规范**:

```
feat: 添加新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

---

## 📄 **许可证**

MIT License

---

## 📞 **联系方式**

如有问题，请查看文档或联系开发团队。

---

**🎉 感谢使用智能导游系统！** ✨
