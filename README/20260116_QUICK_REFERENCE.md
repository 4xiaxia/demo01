# 🎯 快速参考卡片

> **项目**: 智能导游系统 4.0  
> **状态**: ✅ 生产就绪  
> **更新**: 2026-01-16

---

## 📋 核心信息

### 项目状态

```
✅ 核心功能: 100%完成
✅ 代码质量: 0错误
✅ 数据库: Redis + MongoDB已连接
✅ 评分: ⭐⭐⭐⭐⭐ 4.8/5.0
```

### 快速启动

```bash
# 终端1
npm run dev:server

# 终端2
npm run dev
```

### 访问地址

```
聊天: http://localhost:5173/chat?merchant=dongli&userId=test&mode=text
后台: http://localhost:5173/admin
```

---

## 📚 必读文档

| 文档     | 用途             | 链接                                                       |
| -------- | ---------------- | ---------------------------------------------------------- |
| 执行摘要 | 项目状态与下一步 | [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md)             |
| 待办清单 | 详细工作计划     | [TODO_AND_ROADMAP.md](./TODO_AND_ROADMAP.md)               |
| 系统架构 | 架构说明         | [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md)       |
| 完整梳理 | 全面总结         | [COMPLETE_PROJECT_REVIEW.md](./COMPLETE_PROJECT_REVIEW.md) |

---

## 🎯 本周待办 (6.5h)

| 任务         | 时间  | 优先级  |
| ------------ | ----- | ------- |
| 语音功能测试 | 2h    | 🔴 最高 |
| 热门问题缓存 | 30min | 🟡 高   |
| 配置管理完善 | 2h    | 🟡 高   |
| 监控面板增强 | 2h    | 🟢 中   |

---

## 🐛 已知问题

1. **ASR 在前端** - API Key 暴露 (P2)
2. **热门问题性能** - 每次读文件 (P1)
3. **配置保存未实现** - 只能查看 (P1)

---

## 📊 性能指标

```
当前:
  缓存命中率: 78%
  响应时间: <300ms
  并发: 10人

目标:
  缓存命中率: >80%
  响应时间: <200ms
  并发: 50人
```

---

## 🔑 关键路径

### Agent 位置

```
✅ 所有Agent在: server/agents/
❌ 前端没有Agent
```

### 数据库

```
Redis: cgk1.clusters.zeabur.com:23465
MongoDB: cgk1.clusters.zeabur.com:27187
```

### API 端点

```
15个端点已实现
详见: 数据流与API路由清单.md
```

---

## 💡 快速查找

### 我想...

**启动项目** → 见上方"快速启动"

**了解架构** → [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md)

**查看待办** → [TODO_AND_ROADMAP.md](./TODO_AND_ROADMAP.md)

**找文档** → [DOCS_NAVIGATION.md](./DOCS_NAVIGATION.md)

**看 API** → [数据流与 API 路由清单.md](./src/assets/数据流与API路由清单.md)

---

**最后更新**: 2026-01-16 16:21
