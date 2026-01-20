# 商家隔离架构修复报告

## 修复日期：2026-01-20

## 核心设计理念

您的项目采用"物理隔离"设计：

- **商家编码 = 文件夹名 = 登录账号 = URL后缀 = 数据隔离边界**
- 每个商家是一个独立的"房间"
- Agent 是"临时工"，进入不同房间穿上不同的配置

## 修复内容

### 1. 路由结构修改 (src/App.tsx)

**修改前：**

```
/admin/dashboard
/admin/knowledge
/admin/config
/admin/monitor
```

**修改后：**

```
/merchant/{merchantId}/dashboard
/merchant/{merchantId}/knowledge
/merchant/{merchantId}/config
/merchant/{merchantId}/monitor
```

### 2. 登录逻辑修改 (src/views/auth/LoginPage.tsx)

**修改前：**

- 账号密码：admin / admin
- 跳转目标：/admin

**修改后：**

- 账号密码：{商家编码} / {商家编码}
- 从 URL 参数获取商家编码：/login?merchant=dongli
- 跳转目标：/merchant/{merchantId}

### 3. 鉴权守卫增强 (src/components/guard/RequireAuth.tsx)

新增功能：

- 验证登录的商家编码与访问的商家是否匹配
- 防止 dongli 登录后访问 xicun 的后台

### 4. 布局组件修改 (src/layouts/AdminLayout.tsx)

- 从路由参数获取 merchantId
- 在头部显示当前商家编码
- 通过 Outlet context 传递 merchantId 给子页面

### 5. 侧边栏修改 (src/components/admin/Sidebar.tsx)

- 接收 merchantId 参数
- 所有导航链接基于 /merchant/{merchantId}/ 前缀
- 返回前台链接带上商家编码

### 6. 用户导航修改 (src/components/admin/UserNav.tsx)

- 显示商家编码首字母
- 退出时跳转回该商家的登录页

### 7. 仪表盘修改 (src/views/admin/DashboardPage.tsx)

- 使用 useMerchantId Hook 获取商家编码
- 所有链接使用动态路径

### 8. 配置管理器增强 (src/core/config-manager.ts)

更新 getMerchantId() 优先级：

1. URL 查询参数 ?merchant=xxx（前台聊天页面）
2. 路由路径 /merchant/{id}/（后台管理页面）
3. localStorage 存储的 merchantId（登录时保存）
4. 已加载的配置
5. 环境变量兜底

### 9. 新增 Hook (src/hooks/useMerchantId.ts)

提供便捷的商家编码获取方法。

## 使用方式

### 前台访问

```
/chat?merchant=dongli&userId=user123&mode=text
/chat?merchant=xicun&userId=user456&mode=voice
```

### 后台登录

```
/login?merchant=dongli  → 账号: dongli / dongli → 进入 /merchant/dongli
/login?merchant=xicun   → 账号: xicun / xicun   → 进入 /merchant/xicun
```

### 后台页面

```
/merchant/dongli/dashboard    → dongli 商家仪表盘
/merchant/dongli/knowledge    → dongli 商家知识库
/merchant/dongli/config       → dongli 商家配置
/merchant/dongli/monitor      → dongli 商家监控
```

## 文件夹对应关系

| 维度       | dongli 商家             | xicun 商家             |
| ---------- | ----------------------- | ---------------------- |
| 商家编码   | dongli                  | xicun                  |
| 前台URL    | /chat?merchant=dongli   | /chat?merchant=xicun   |
| 后台URL    | /merchant/dongli        | /merchant/xicun        |
| 配置文件夹 | public/data/dongli/     | public/data/xicun/     |
| 后端文件夹 | server/merchant/dongli/ | server/merchant/xicun/ |
| 登录账号   | dongli / dongli         | xicun / xicun          |
| API路径    | /api/merchant/dongli/\* | /api/merchant/xicun/\* |

## 已有的正确隔离（无需修改）

以下部分已经正确实现了商家隔离：

1. ✅ Agent A/B/C/D - 处理时传入 merchantId 参数
2. ✅ Context Pool - Key 包含 merchantId
3. ✅ 知识库 API - /api/merchant/:id/knowledge
4. ✅ 热门问题 API - /api/merchant/:id/hot-questions
5. ✅ 文件存储 - 按商家文件夹隔离

## 待优化项目（P1）

1. ~~监控统计按商家隔离~~ ✅ 已完成
   - ~~Agent D 的统计目前是全局的~~
   - ~~需要改为按商家维度统计~~

2. ~~日志查询按商家过滤~~ ✅ 已完成
   - ~~确保日志 API 支持 merchantId 参数~~

---

## 后端商家隔离修复（2026-01-20）

### 10. Agent D 重构 (server/agents/agent-d.ts)

**修改前：**

- `dailyStats` 是单个对象，所有商家共用
- `missingQuestions` 是单个 Map，所有商家共用

**修改后：**

- `dailyStatsByMerchant: Map<string, DailyStats>` - 按商家存储统计
- `missingQuestionsByMerchant: Map<string, Map<...>>` - 按商家存储报缺
- `agentHealth` 保持全局（因为 Agent 是共享的临时工）
- `getStats(merchantId?)` - 支持按商家获取，不传则返回汇总
- `ignoreMissingQuestion(merchantId, question)` - 需要传入商家编码

### 11. 监控路由更新 (server/routes/monitor.ts)

新增/修改的 API：

| 方法   | 路径                                                  | 说明             |
| ------ | ----------------------------------------------------- | ---------------- |
| GET    | `/api/monitor/stats?merchantId=xxx`                   | 获取指定商家统计 |
| GET    | `/api/merchant/:merchantId/monitor/stats`             | RESTful 风格     |
| GET    | `/api/monitor/logs?merchantId=xxx`                    | 获取指定商家日志 |
| GET    | `/api/merchant/:merchantId/monitor/logs`              | RESTful 风格     |
| DELETE | `/api/merchant/:merchantId/monitor/missing/:question` | 按商家忽略报缺   |

### 12. 报缺服务更新 (server/services/missing-question-service.ts)

- `getStats(merchantId?)` - 支持按商家获取
- `convertToKnowledge(merchantId, ...)` - 传入商家编码
- `getClusteringSuggestions(merchantId)` - 按商家聚类

### 13. 热门问题路由更新 (server/routes/hot-questions.ts)

- `/api/merchant/:id/missing-questions` - 按商家获取报缺
- `/api/merchant/:id/missing-questions/ignore` - 按商家忽略报缺

### 14. 前端监控页面更新 (src/views/admin/MonitorPage.tsx)

- 使用 `useMerchantId()` Hook 获取商家编码
- API 调用时传入 `merchantId` 参数
- 页面显示当前商家名称

---

## 完整的商家隔离验证清单

| 层级 | 组件         | 隔离状态                             |
| ---- | ------------ | ------------------------------------ |
| 前端 | 聊天页面     | ✅ URL 参数 `?merchant=xxx`          |
| 前端 | 后台路由     | ✅ `/merchant/:merchantId/*`         |
| 前端 | 登录验证     | ✅ 商家编码 = 账号密码               |
| 前端 | 监控页面     | ✅ 使用 `useMerchantId()`            |
| 后端 | Agent A      | ✅ 传入 merchantId                   |
| 后端 | Agent B      | ✅ 传入 merchantId                   |
| 后端 | Agent C      | ✅ 传入 merchantId                   |
| 后端 | Agent D      | ✅ 按商家存储统计                    |
| 后端 | Context Pool | ✅ Key 包含 merchantId               |
| 后端 | 知识库 API   | ✅ `/api/merchant/:id/knowledge`     |
| 后端 | 热门问题 API | ✅ `/api/merchant/:id/hot-questions` |
| 后端 | 监控 API     | ✅ 支持 merchantId 参数              |
| 存储 | 配置文件     | ✅ `public/data/{merchantId}/`       |
| 存储 | 服务端文件   | ✅ `server/merchant/{merchantId}/`   |
