# LifeInbox 文档

[English](README.en.md)

| 项目     | 内容                                                   |
| -------- | ------------------------------------------------------ |
| 状态     | 设计进行中                                             |
| 产品     | LifeInbox                                              |
| 主要用户 | 一位管理日常通知的个人用户                             |
| V1 成果  | 粘贴通知 -> 审核 AI 草稿 -> 导出 Apple Calendar `.ics` |
| 后端     | Next.js、NestJS、PostgreSQL、Drizzle ORM               |
| 交付方式 | 模块化单体，每次完成一个垂直切片                       |

## 产品陈述

LifeInbox 将日常通知转化为可审核的行动事项。它保留原始来源，提取日期和下一步行动，在需要时请求澄清，并帮助用户把已确认事项安排到 Apple Calendar 中。

产品范围保持聚焦：

> 生活通知 -> 已确认行动 -> Apple Calendar -> 后续更新。

它不是通用个人助理。

## 阅读和审查顺序

每次审查一份文档。后面的文档可以依赖前面已经作出的决定，但不能在未说明的情况下改变这些决定。

1. [产品范围与原则](01-product-scope.md)
2. [简单的首个版本：V1 路线图](02-v1-roadmap.md)
3. [进阶版本](03-advanced-roadmap.md)
4. [后端学习地图](04-backend-learning-map.md)
5. [AI 与 Agent 学习地图](05-ai-agent-learning-map.md)
6. [里程碑工作流与完成定义](06-milestone-method.md)
7. [ADR 0001：使用 Drizzle，而不是 TypeORM](adr/0001-use-drizzle.md)

## 已锁定的决定

以下决定已经作出。如无新的 ADR，不应重新讨论：

- Drizzle ORM 是唯一的应用 ORM。
- TypeORM 不属于本项目，也不得安装。
- PostgreSQL 是事实来源。
- 后端从 NestJS 模块化单体开始。
- V1 接受粘贴文本，并导出 Apple Calendar `.ics` 文件。
- 仅在需要后台任务时引入 Redis。
- 只有在普通搜索和检索调试已经存在后，才引入 pgvector。
- 原生 Apple EventKit companion 是可选项，并且要等 Web 产品证明有用之后再做。
- AI 输出是草稿；由用户确认的产品状态才具有权威性。

## 版本概览

| 版本    | 产品成果                              | 主要学习成果                                   |
| ------- | ------------------------------------- | ---------------------------------------------- |
| V1      | 文本通知 -> 已审核行动 -> 导出 `.ics` | HTTP、Drizzle、PostgreSQL、测试、AI 结构化输出 |
| V2      | 安全的个人账户与澄清工作流            | 身份认证、授权、并发、持久化工作流状态         |
| V3      | 截图/PDF、后台处理、提醒              | 文件、对象存储、队列、worker、重试、幂等       |
| V4      | 将新通知与个人历史关联                | 搜索、pgvector、RAG、检索评估                  |
| V5      | 有边界的有状态 LifeInbox Agent        | 工具、checkpoint、暂停/恢复、预算、审批        |
| V6      | 安全且可诊断的生产系统                | 日志、指标、trace、部署、备份、隐私            |
| 可选 V7 | 直接集成 Apple Calendar               | 原生 EventKit、外部副作用、最终一致性          |

## 如何使用这套文档

开始一个里程碑之前：

1. 只审查该里程碑及其前置条件。
2. 写出它的五行 feature card。
3. 决定不变量和故障实验。
4. 实现最小 happy path。
5. 在验收测试通过之前，不开始下一个里程碑。

这套文档是规划产物，有意不包含应用脚手架或具体实现。
