# 📚 文档导航索引

> **目的**: 快速找到正确的、最新的文档  
> **更新时间**: 2026-01-16

---

## 🌟 必读文档 (最新)

| 文档                                                                | 用途               | 状态    |
| ------------------------------------------------------------------- | ------------------ | ------- |
| **[README.md](./README.md)**                                        | 项目介绍、快速开始 | ✅ 最新 |
| **[ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md)**            | 系统架构总结       | ✅ 最新 |
| **[PROJECT_HEALTH_CHECK.md](./PROJECT_HEALTH_CHECK.md)**            | 项目健康检查报告   | ✅ 最新 |
| **[数据流与 API 路由清单.md](./src/assets/数据流与API路由清单.md)** | API 和数据流详解   | ✅ 最新 |

---

## 📖 功能文档

### 开发相关

| 文档                                                     | 说明           | 状态 |
| -------------------------------------------------------- | -------------- | ---- |
| [AGENT_RESPONSIBILITIES.md](./AGENT_RESPONSIBILITIES.md) | Agent 职责说明 | ✅   |
| [TRACEID_DESIGN.md](./TRACEID_DESIGN.md)                 | TraceID 设计   | ✅   |
| [CODE_COMMENTS_REPORT.md](./CODE_COMMENTS_REPORT.md)     | 代码注释报告   | ✅   |

### 业务相关

| 文档                                                       | 说明         | 状态 |
| ---------------------------------------------------------- | ------------ | ---- |
| [不要删后台大概的功能.md](./不要删后台大概的功能.md)       | 后台功能需求 | ✅   |
| [CACHE_OPTIMIZATION_PLAN.md](./CACHE_OPTIMIZATION_PLAN.md) | 缓存优化方案 | ✅   |

---

## 📋 交付报告

| 文档                                                             | 说明         | 时间    |
| ---------------------------------------------------------------- | ------------ | ------- |
| [FINAL_DELIVERY_REPORT.md](./FINAL_DELIVERY_REPORT.md)           | 最终交付报告 | 2026-01 |
| [PROJECT_COMPLETION_SUMMARY.md](./PROJECT_COMPLETION_SUMMARY.md) | 项目完成总结 | 2026-01 |
| [MONITOR_COMPLETION_REPORT.md](./MONITOR_COMPLETION_REPORT.md)   | 监控完成报告 | 2026-01 |

---

## ⚠️ 过时文档 (仅供参考)

| 文档                             | 问题                        | 建议                         |
| -------------------------------- | --------------------------- | ---------------------------- |
| **系统架构修正版新！.md**        | 提到"待修复"问题已修复      | 参考 ARCHITECTURE_SUMMARY.md |
| **项目诊断 XRay.md**             | 提到已删除的文件            | 参考 PROJECT_HEALTH_CHECK.md |
| **千问集成完成说明 设计讨论.md** | 提到前端 qwen-api.ts 已删除 | 参考 ARCHITECTURE_SUMMARY.md |

---

## 🔍 快速查找

### 我想了解...

#### 项目是什么？

→ [README.md](./README.md)

#### 如何启动项目？

→ [README.md](./README.md) - 快速开始章节

#### 系统架构是什么样的？

→ [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md)

#### Agent 都在哪里？

→ [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md) - 目录结构  
→ 答案: `server/agents/` (所有 Agent 都在服务端)

#### API 路由有哪些？

→ [数据流与 API 路由清单.md](./src/assets/数据流与API路由清单.md)  
→ [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md) - API 路由清单

#### Context Pool 用什么存储？

→ [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md) - 数据持久化  
→ 答案: Redis (Dragonfly)

#### 数据库用什么？

→ [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md) - 数据持久化  
→ 答案: MongoDB + Redis

#### 如何访问后台？

→ [README.md](./README.md) - 访问地址  
→ 答案: http://localhost:5173/admin

#### 项目有哪些问题？

→ [PROJECT_HEALTH_CHECK.md](./PROJECT_HEALTH_CHECK.md)

#### 缓存策略是什么？

→ [CACHE_OPTIMIZATION_PLAN.md](./CACHE_OPTIMIZATION_PLAN.md)  
→ [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md) - Agent B 职责

#### TraceID 是什么？

→ [TRACEID_DESIGN.md](./TRACEID_DESIGN.md)

---

## 📁 文档分类

### 按类型分类

```
架构设计:
  ├── ARCHITECTURE_SUMMARY.md (最新)
  ├── 系统架构修正版新！.md (过时)
  └── 数据流与API路由清单.md (最新)

开发指南:
  ├── README.md
  ├── AGENT_RESPONSIBILITIES.md
  └── CODE_COMMENTS_REPORT.md

项目管理:
  ├── PROJECT_HEALTH_CHECK.md (最新)
  ├── PROJECT_COMPLETION_SUMMARY.md
  └── PROJECT_PROGRESS.md

交付报告:
  ├── FINAL_DELIVERY_REPORT.md
  ├── MONITOR_COMPLETION_REPORT.md
  └── P0_COMPLETION_REPORT.md

设计文档:
  ├── TRACEID_DESIGN.md
  ├── CACHE_OPTIMIZATION_PLAN.md
  └── DESIGN_PHILOSOPHY.md
```

---

## 🎯 推荐阅读顺序

### 新人入门

1. [README.md](./README.md) - 了解项目
2. [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md) - 理解架构
3. [数据流与 API 路由清单.md](./src/assets/数据流与API路由清单.md) - 掌握数据流
4. [AGENT_RESPONSIBILITIES.md](./AGENT_RESPONSIBILITIES.md) - 了解 Agent 职责

### 开发人员

1. [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md) - 架构总览
2. [CODE_COMMENTS_REPORT.md](./CODE_COMMENTS_REPORT.md) - 代码规范
3. [TRACEID_DESIGN.md](./TRACEID_DESIGN.md) - 调试工具
4. 查看 `server/agents/` 源码

### 运维人员

1. [README.md](./README.md) - 部署指南
2. [PROJECT_HEALTH_CHECK.md](./PROJECT_HEALTH_CHECK.md) - 健康检查
3. [MONITOR_COMPLETION_REPORT.md](./MONITOR_COMPLETION_REPORT.md) - 监控说明

---

## ✅ 文档维护规则

### 创建新文档时

1. 添加到本索引
2. 标注创建时间
3. 说明用途和状态

### 更新文档时

1. 更新"更新时间"
2. 如果大幅修改，考虑归档旧版本
3. 更新本索引的状态

### 归档文档时

1. 移动到 `docs/archived/`
2. 在本索引标注"已归档"
3. 说明替代文档

---

## 🔄 最近更新

| 日期       | 文档                     | 变更                    |
| ---------- | ------------------------ | ----------------------- |
| 2026-01-16 | ARCHITECTURE_SUMMARY.md  | 新建 - 最新架构总结     |
| 2026-01-16 | PROJECT_HEALTH_CHECK.md  | 新建 - 项目健康检查     |
| 2026-01-16 | 数据流与 API 路由清单.md | 新建 - API 和数据流详解 |
| 2026-01-16 | README.md                | 更新 - 补充后台路径     |

---

**维护者**: 开发团队  
**最后更新**: 2026-01-16
