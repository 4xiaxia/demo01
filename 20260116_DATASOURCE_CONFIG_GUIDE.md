# 📋 数据源配置说明

> **创建时间**: 2026-01-16 17:48  
> **最后更新**: 2026-01-16 17:48  
> **版本**: v1.0  
> **状态**: ✅ 最新

---

## 🎯 配置架构

### 设计理念

```
Dragonfly (Redis兼容):
  - 临时缓存 (5分钟)
  - 高频查询结果
  - IO响应提升100倍

MongoDB:
  - 持久化存储
  - 知识库数据
  - 替代本地文件
  - 易于维护

本地文件:
  - 开发环境
  - 快速原型
  - 备用方案
```

---

## ⚙️ 配置选项

### config.json 配置结构

```json
{
  "merchantId": "dongli",
  "name": "东里村智能导游",

  // 数据源配置
  "dataSource": {
    "knowledge": "local", // 知识库: "local" | "mongodb"
    "hotQuestions": "local", // 热门问题: "local" | "mongodb"
    "config": "local" // 配置文件: "local" | "mongodb"
  },

  // 缓存配置
  "cache": {
    "enabled": true, // 是否启用缓存
    "ttl": 300, // 缓存时长(秒) - 5分钟
    "provider": "dragonfly" // 缓存提供者: "dragonfly" | "memory"
  }
}
```

---

## 📊 数据源选项详解

### 1. knowledge (知识库)

#### 选项: "local"

```json
"dataSource": {
  "knowledge": "local"
}
```

**数据位置**: `public/data/{merchantId}/knowledge.json`

**优点**:

- ✅ 简单直接
- ✅ 无需数据库
- ✅ 适合开发环境

**缺点**:

- ❌ 文件 IO 慢
- ❌ 不易维护
- ❌ 无法多实例共享

**适用场景**:

- 开发环境
- 小规模部署
- 快速原型

---

#### 选项: "mongodb"

```json
"dataSource": {
  "knowledge": "mongodb"
}
```

**数据位置**: MongoDB `knowledge` collection

**优点**:

- ✅ 性能优秀（索引检索）
- ✅ 易于维护
- ✅ 支持多实例共享
- ✅ 支持图文、非结构化数据

**缺点**:

- ⚠️ 需要 MongoDB 服务
- ⚠️ 配置稍复杂

**适用场景**:

- 生产环境 ⭐
- 多实例部署
- 大规模数据

**数据结构**:

```javascript
{
  merchantId: "dongli",
  items: [
    {
      id: "k_001",
      name: "景点介绍",
      content: "东里村...",
      keywords: ["景点", "介绍"],
      category: "info",
      enabled: true,
      weight: 1.0,
      // 支持更多字段
      images: ["url1", "url2"],
      audio: "url",
      dialect: "闽南语"
    }
  ]
}
```

---

### 2. hotQuestions (热门问题)

#### 选项: "local"

```json
"dataSource": {
  "hotQuestions": "local"
}
```

**数据位置**: `server/merchant/{merchantId}/hot-questions.json`

**优点**:

- ✅ 简单直接
- ✅ 无需数据库

**缺点**:

- ❌ 文件 IO 慢
- ❌ 更新需要重启或刷新缓存

---

#### 选项: "mongodb"

```json
"dataSource": {
  "hotQuestions": "mongodb"
}
```

**数据位置**: MongoDB `hot_questions` collection

**优点**:

- ✅ 实时更新
- ✅ 易于管理
- ✅ 支持统计分析

**适用场景**:

- 生产环境 ⭐
- 频繁更新

---

### 3. config (配置文件)

#### 选项: "local"

```json
"dataSource": {
  "config": "local"
}
```

**数据位置**: `server/merchant/{merchantId}/config.json`

**适用场景**:

- 开发环境
- 配置较少变动

---

#### 选项: "mongodb"

```json
"dataSource": {
  "config": "mongodb"
}
```

**数据位置**: MongoDB `configs` collection

**适用场景**:

- 生产环境
- 多商户管理
- 配置中心

---

## 🚀 缓存配置

### cache.enabled

```json
"cache": {
  "enabled": true  // 启用缓存
}
```

**说明**: 是否启用 Dragonfly 缓存

---

### cache.ttl

```json
"cache": {
  "ttl": 300  // 5分钟 = 300秒
}
```

**说明**: 缓存有效期（秒）

**推荐值**:

- 知识库: 300 秒 (5 分钟)
- 热门问题: 300 秒 (5 分钟)
- 配置: 600 秒 (10 分钟)

---

### cache.provider

```json
"cache": {
  "provider": "dragonfly"  // "dragonfly" | "memory"
}
```

**选项**:

#### "dragonfly" (推荐)

- ✅ 高性能
- ✅ 多实例共享
- ✅ 持久化
- ✅ 适合生产环境

#### "memory"

- ✅ 简单
- ✅ 无需外部服务
- ❌ 单实例
- ❌ 重启丢失
- ✅ 适合开发环境

---

## 📋 推荐配置

### 开发环境

```json
{
  "dataSource": {
    "knowledge": "local",
    "hotQuestions": "local",
    "config": "local"
  },
  "cache": {
    "enabled": true,
    "ttl": 300,
    "provider": "memory"
  }
}
```

**特点**: 简单、快速、无需外部服务

---

### 生产环境（推荐）⭐

```json
{
  "dataSource": {
    "knowledge": "mongodb",
    "hotQuestions": "mongodb",
    "config": "mongodb"
  },
  "cache": {
    "enabled": true,
    "ttl": 300,
    "provider": "dragonfly"
  }
}
```

**特点**: 高性能、易维护、支持多实例

**架构**:

```
请求 → Dragonfly缓存(5分钟) → MongoDB持久化
         ↓ 命中                  ↓ 未命中
       直接返回              查询并缓存
```

---

### 混合模式

```json
{
  "dataSource": {
    "knowledge": "mongodb", // 知识库用MongoDB
    "hotQuestions": "local", // 热门问题用本地
    "config": "local" // 配置用本地
  },
  "cache": {
    "enabled": true,
    "ttl": 300,
    "provider": "dragonfly"
  }
}
```

**适用场景**: 逐步迁移

---

## 🔄 数据流

### 使用 MongoDB + Dragonfly

```
1. 用户请求
   ↓
2. 检查Dragonfly缓存
   ↓ 命中 (5分钟内)
   返回缓存数据 (<1ms)

   ↓ 未命中
3. 查询MongoDB
   ↓
4. 写入Dragonfly缓存 (TTL=300s)
   ↓
5. 返回数据
```

**性能**:

- 缓存命中: <1ms
- 缓存未命中: ~10ms (MongoDB 查询)
- 本地文件: ~25ms (文件 IO)

**提升**: 25 倍 🚀

---

## 💡 迁移指南

### 从本地文件迁移到 MongoDB

#### Step 1: 导入数据

```bash
# 使用后台管理界面
1. 登录后台: /admin
2. 进入知识库管理
3. 点击"导入"
4. 选择knowledge.json
5. 确认导入
```

#### Step 2: 修改配置

```json
// config.json
{
  "dataSource": {
    "knowledge": "mongodb" // 改为mongodb
  }
}
```

#### Step 3: 重启服务

```bash
# 重启后会从MongoDB加载
[C] 📂 从MongoDB加载知识库
[C] ✅ 知识库加载完成，共 11 条
```

#### Step 4: 验证

```bash
# 测试查询
POST /api/process-input
✅ 应该正常工作
```

---

## 🎯 后台管理界面

### 配置生成器页面

应该添加数据源配置选项：

```tsx
// ConfigGeneratorPage.tsx
<Card>
  <CardHeader>数据源配置</CardHeader>
  <CardContent>
    <div className="space-y-4">
      {/* 知识库数据源 */}
      <div>
        <Label>知识库存储</Label>
        <Select value={config.dataSource.knowledge}>
          <SelectItem value="local">本地文件</SelectItem>
          <SelectItem value="mongodb">MongoDB (推荐)</SelectItem>
        </Select>
        <p className="text-sm text-gray-500">MongoDB支持索引检索，性能更好</p>
      </div>

      {/* 热门问题数据源 */}
      <div>
        <Label>热门问题存储</Label>
        <Select value={config.dataSource.hotQuestions}>
          <SelectItem value="local">本地文件</SelectItem>
          <SelectItem value="mongodb">MongoDB (推荐)</SelectItem>
        </Select>
      </div>

      {/* 缓存配置 */}
      <div>
        <Label>缓存策略</Label>
        <Select value={config.cache.provider}>
          <SelectItem value="dragonfly">Dragonfly (推荐)</SelectItem>
          <SelectItem value="memory">内存缓存</SelectItem>
        </Select>
      </div>

      <div>
        <Label>缓存时长 (秒)</Label>
        <Input type="number" value={config.cache.ttl} placeholder="300" />
        <p className="text-sm text-gray-500">推荐: 300秒 (5分钟)</p>
      </div>
    </div>
  </CardContent>
</Card>
```

---

## 📊 性能对比

### 知识库查询

| 方案                | 首次查询 | 缓存命中 | 适用场景    |
| ------------------- | -------- | -------- | ----------- |
| 本地文件            | ~25ms    | ~25ms    | 开发环境    |
| MongoDB             | ~10ms    | ~10ms    | 小规模      |
| MongoDB + Dragonfly | ~10ms    | <1ms     | 生产环境 ⭐ |

### 并发能力

| 方案                | 并发支持 | 瓶颈    |
| ------------------- | -------- | ------- |
| 本地文件            | 10-20    | 文件 IO |
| MongoDB             | 50-100   | 数据库  |
| MongoDB + Dragonfly | 500-1000 | 网络    |

---

## 🎉 总结

### 推荐配置

**生产环境**: MongoDB + Dragonfly ⭐

```json
{
  "dataSource": {
    "knowledge": "mongodb",
    "hotQuestions": "mongodb",
    "config": "mongodb"
  },
  "cache": {
    "enabled": true,
    "ttl": 300,
    "provider": "dragonfly"
  }
}
```

**优势**:

- ✅ 性能最优 (缓存命中<1ms)
- ✅ 易于维护 (后台管理)
- ✅ 支持多实例
- ✅ 适配弱网环境

---

**创建时间**: 2026-01-16 17:48  
**维护者**: 开发团队
