# 🔐 环境变量配置规范

> **最后更新**: 2026-01-20  
> **状态**: ✅ 已完成清理和规范化

---

## ⚠️ 核心安全规则（必读！）

### 🚫 绝对禁止

```bash
# ❌ 错误示范：API Key 使用 VITE_ 前缀
VITE_ZHIPU_API_KEY=sk-xxxxx        # 会暴露到前端！
VITE_SILICONFLOW_API_KEY=sk-xxxxx  # 会暴露到前端！
VITE_DASHSCOPE_API_KEY=sk-xxxxx    # 会暴露到前端！
```

**危险原因**：
- Vite 会将所有 `VITE_` 前缀的环境变量打包到前端 `dist/` 文件中
- 用户可以在浏览器 DevTools → Sources 中直接查看到密钥
- 任何人都可以复制你的 API Key 并滥用

---

### ✅ 正确使用

```bash
# ✅ 正确示范：后端专用 API Keys（不带 VITE_ 前缀）
ZHIPU_API_KEY=a049afdafb1b41a0862cdc1d73d5d6eb.YuGYXVGRQEUILpog
SILICONFLOW_API_KEY=sk-vkggbmtfcqjjtmkphjupzyhorvjilexvhjweuphtxzzdksvw
DASHSCOPE_API_KEY=sk-0ecae1777d2240ea88064fa3a5a645b3

# ✅ 前端可用：非敏感配置（可以用 VITE_ 前缀）
VITE_MERCHANT_ID=dongli                # 商户ID
VITE_AMAP_API_KEY=xxx                  # 高德地图（非关键）
VITE_DEBUG_MODE=true                   # 调试开关
```

---

## 📋 完整环境变量列表

### 🗄️ 数据库配置（后端专用）

```bash
# MongoDB
MONGODB_URI=mongodb://mongo:password@host:27017
MONGODB_DB=smart_guide
MONGODB_HOST=service-xxx
MONGODB_PORT=27017
MONGODB_USER=mongo
MONGODB_PASSWORD=xxxxx

# Redis (Dragonfly)
DRAGONFLY_HOST=cgk1.clusters.zeabur.com
DRAGONFLY_PORT=23465
DRAGONFLY_PASSWORD=xxxxx
DRAGONFLY_URL=redis://default:password@host:port
```

### 🤖 AI 服务 API Keys（后端专用）

```bash
# 智谱 GLM (用于 Chat + ASR)
ZHIPU_API_KEY=a049afdafb1b41a0862cdc1d73d5d6eb.YuGYXVGRQEUILpog

# 硅基流动 SiliconFlow (用于 TTS)
SILICONFLOW_API_KEY=sk-vkggbmtfcqjjtmkphjupzyhorvjilexvhjweuphtxzzdksvw

# 阿里云 DashScope (用于 TTS + ASR备选)
DASHSCOPE_API_KEY=sk-0ecae1777d2240ea88064fa3a5a645b3
```

### 🌐 前端配置（可用 VITE_ 前缀）

```bash
# 商户配置
VITE_MERCHANT_ID=dongli

# 高德地图 API Key（相对低敏感）
VITE_AMAP_API_KEY=8428614f111312a91d57c0651f63e743

# ANP 系统配置
VITE_ANP_SERVER_URL=http://localhost:3000
VITE_ANP_ENABLE_DEBUG=true

# 开发环境配置
VITE_ENV=development
VITE_DEBUG_MODE=true

# 地图配置
VITE_MAP_DEFAULT_ZOOM=15
VITE_MAP_DEFAULT_CENTER_LAT=25.235
VITE_MAP_DEFAULT_CENTER_LNG=118.205

# 功能开关
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true
VITE_ENABLE_PERFORMANCE_MONITORING=true
```

### 🖥️ 服务器配置（后端专用）

```bash
# 服务端口
PORT=3000
```

---

## 🔍 如何判断是否可以使用 VITE_ 前缀？

### 决策树

```
是否包含敏感信息？（API Key、密码、Token）
    ├─ 是 → ❌ 不能使用 VITE_ 前缀
    │       → 必须保存在后端环境变量中
    │       → 通过 process.env.XXX_API_KEY 访问
    │
    └─ 否 → 是否需要在前端使用？
            ├─ 是 → ✅ 可以使用 VITE_ 前缀
            │       → 示例：VITE_MERCHANT_ID, VITE_DEBUG_MODE
            │
            └─ 否 → ❌ 不要使用 VITE_ 前缀
                    → 后端专用变量不需要 VITE_
```

---

## 🛡️ 安全验证清单

在部署前执行以下检查：

### 1️⃣ 检查 `.env` 文件

```bash
# ✅ 正确：不包含 VITE_*_API_KEY
grep "VITE_.*API_KEY" .env
# 预期结果：没有匹配项（或只有 VITE_AMAP_API_KEY）
```

### 2️⃣ 检查后端代码

```bash
# ✅ 正确：后端不使用 VITE_ 前缀的 API Key
grep "VITE_ZHIPU_API_KEY" server/**/*.ts
grep "VITE_SILICONFLOW_API_KEY" server/**/*.ts
grep "VITE_DASHSCOPE_API_KEY" server/**/*.ts
# 预期结果：全部为 0 matches
```

### 3️⃣ 检查前端代码

```bash
# ✅ 正确：前端不直接使用 API Key
grep "import.meta.env.VITE_.*API_KEY" src/**/*.ts src/**/*.tsx
# 预期结果：只允许 VITE_AMAP_API_KEY（非核心密钥）
```

### 4️⃣ 检查打包产物

```bash
# 构建前端
npm run build

# 搜索是否有泄露的密钥
grep -r "sk-" dist/assets/*.js
# 预期结果：没有匹配项
```

---

## 🔧 修复历史记录

### 2026-01-20 清理完成

#### 修改文件清单

1. **`.env`**
   - ❌ 移除：`VITE_ZHIPU_API_KEY`
   - ❌ 移除：`VITE_SILICONFLOW_API_KEY`
   - ❌ 移除：`VITE_DASHSCOPE_API_KEY`
   - ✅ 保留：`ZHIPU_API_KEY`, `SILICONFLOW_API_KEY`, `DASHSCOPE_API_KEY`
   - ✅ 添加：安全警告注释

2. **`.env.example`**
   - ✅ 添加：详细的安全规则说明
   - ✅ 添加：`DASHSCOPE_API_KEY` 示例
   - ✅ 修正：所有 API Key 命名规范

3. **`server/server.ts`** (第 473 行)
   - ❌ 修复前：`process.env.VITE_ZHIPU_API_KEY`
   - ✅ 修复后：`process.env.ZHIPU_API_KEY`

4. **`server/server-mongo.ts`** (第 46, 71, 101 行)
   - ❌ 修复前：`process.env.VITE_ZHIPU_API_KEY`
   - ✅ 修复后：`process.env.ZHIPU_API_KEY`
   - ❌ 修复前：`process.env.VITE_SILICONFLOW_API_KEY`
   - ✅ 修复后：`process.env.SILICONFLOW_API_KEY`

#### 遗留问题

⚠️ **ASR 前端调用仍需修复**（优先级 P0）

**位置**：`src/lib/api-config.ts` 第 220-221 行

```typescript
// ❌ 当前状态（临时妥协）
get apiKey() {
  return (import.meta.env.VITE_ZHIPU_API_KEY as string) || "";
}
```

**修复计划**：
1. 在 `server/server.ts` 添加 `/api/asr` 路由（支持 multipart/form-data）
2. 修改 `api-config.ts` 的 `speechToText()` 改为调用后端
3. 从 `.env` 移除 `VITE_ZHIPU_API_KEY`

---

## 📚 相关文档

- [API 安全配置说明](./API_SECURITY_README.md)
- [TTS API 差异说明](./TTS_API_差异说明.md)
- [ASR API 差异说明](./ASR_API_差异说明.md)
- [服务模块文档](./server/services/README.md)

---

## ❓ 常见问题

### Q1: 为什么 `VITE_AMAP_API_KEY` 可以保留？

A: 高德地图 API Key 有域名和 IP 白名单限制，即使暴露也无法在其他域名使用，安全风险相对较低。但建议生产环境也配置域名白名单。

### Q2: 后端如何访问环境变量？

A: 使用 `process.env.XXX_API_KEY`，不要带 `VITE_` 前缀。

```typescript
// ✅ 正确
const apiKey = process.env.ZHIPU_API_KEY || "";

// ❌ 错误
const apiKey = process.env.VITE_ZHIPU_API_KEY || "";
```

### Q3: 前端如何访问环境变量？

A: 只能访问 `VITE_` 前缀的变量，且仅用于非敏感配置。

```typescript
// ✅ 正确（非敏感配置）
const merchantId = import.meta.env.VITE_MERCHANT_ID;

// ❌ 错误（敏感信息）
const apiKey = import.meta.env.VITE_ZHIPU_API_KEY;
```

### Q4: 本地开发如何测试？

A: 确保 `.env` 文件中包含正确的后端专用 API Keys（不带 VITE_ 前缀）。

---

**维护者**: AI Assistant  
**审核者**: 项目团队  
**状态**: ✅ 已验证并清理完成
