# LifeInbox 文档

[English](README.en.md)

| 项目     | 内容                                                                     |
| -------- | ------------------------------------------------------------------------ |
| 状态     | 设计进行中                                                               |
| 产品     | LifeInbox                                                                |
| 主要用户 | 一位管理日常通知的个人用户                                               |
| V1 成果  | 与 Agent 对话 -> 补全证据 -> 确认 Event Card -> 显式导出 Calendar `.ics` |
| 技术栈   | Next.js、NestJS、PostgreSQL、Drizzle ORM                                 |
| 交付方式 | 模块化单体，每次完成一个垂直切片                                         |

## 产品陈述

LifeInbox 将日常通知转化为有证据、可确认的 Event。用户始终在同一个 Agent chat 中表达意图、粘贴外部材料、回答澄清问题并审核 Event Preview Card；系统在后台保留原始来源、内部 `LifeCase` 和结构化状态，并帮助用户把已确认 Event 导出到 Apple Calendar。`LifeCase` 是领域与实现中的正式名称，文档在语义明确时简称 `Case`。

产品范围保持聚焦：

> 生活通知 -> 已确认 Event -> Apple Calendar -> 后续更新。

它不是无边界的通用个人助理。

## 交互模型

V1 采用以下三个互相约束的原则：

- **Single-chat**：`Agent` 是唯一对话入口。用户不查看或切换 Case；未完成事项通过全局 chat 中的 resume card 恢复。
- **Card-confirmed**：聊天总结不是最终事实。阻塞项在 Draft Progress 中解决；确定性完整性 Gate 通过后，重要字段、证据、warning 和已接受默认值进入可确认的 Event Preview Card。只有用户确认准确 Event version 后，正式字段才成为权威状态。
- **Internally case-scoped**：单一可见聊天不等于单一 LLM context。Backend 仍按内部 Case 隔离来源、消息证据、Event 和模型上下文，不允许不同事项静默串用日期、地点或回答。

聊天是控制界面，而不是数据模型。`ChatMessage` 构成用户可见的全局时间线；`LifeCase`、`InboxItem`、`Event`、字段证据、用户修改和导出记录仍然以结构化状态保存。

界面分阶段交付：初期只有 `Agent` 和 `Settings`；确认流程可靠后增加 `Events` tab，只展示越过确认边界的 Event，即当前为 `CONFIRMED`，或确认后又被取消而当前为 `CANCELLED`。用户始终不会看到、创建、选择或切换 `LifeCase`、`InboxItem`。

V1 的“Agent”是有固定边界的编排流程：提取、校验、澄清、提议、确认和导出。它不会自行选择任意工具或产生未经批准的外部副作用；动态、有预算和审批边界的工具循环属于 V5。

## 阅读和审查顺序

每次审查一份文档。后面的文档可以依赖前面已经作出的决定，但不能在未说明的情况下改变这些决定。

1. [产品范围与原则](01-product-scope.md)
2. [ADR 0003：采用单一 Agent Chat、内部 Case 与单 Event 模型](adr/0003-single-chat-internal-cases.md)
3. [ADR 0002：旧的 Conversation-first、Card-confirmed、Case-organized 模型（历史，已被 ADR 0003 取代）](adr/0002-conversation-first-interaction.md)
4. [ADR 0001：使用 Drizzle，而不是 TypeORM](adr/0001-use-drizzle.md)
5. [简单的首个版本：V1 路线图](02-v1-roadmap.md)
6. [进阶版本](03-advanced-roadmap.md)
7. [后端学习地图](04-backend-learning-map.md)
8. [AI 与 Agent 学习地图](05-ai-agent-learning-map.md)
9. [里程碑工作流与完成定义](06-milestone-method.md)

## 已锁定的决定

以下决定已经作出。如无新的 ADR，不应重新讨论：

- Drizzle ORM 是唯一的应用 ORM。
- TypeORM 不属于本项目，也不得安装。
- PostgreSQL 是事实来源。
- 后端从 NestJS 模块化单体开始。
- V1 接受粘贴文本，并导出 Apple Calendar `.ics` 文件。
- 初期界面只有 `Agent` 与 `Settings`；随后增加 `Events` tab，只展示当前为 `CONFIRMED` 或确认后变为 `CANCELLED` 的 Event。
- 用户不会看到、创建、选择或切换 `Case`、`InboxItem`；未完成事项通过 chat 内的 resume card 恢复。
- `LifeCase`（简称 `Case`）是后台的一件具体事项，拥有零个或多个不可变 `InboxItem`、零个或多个相关 `ChatMessage`，以及零个或一个 `Event`；直接表达的事项可以只使用 ChatMessage evidence。
- `ChatMessage` 构成全局时间线且 `caseId` 可空；模型调用仍只获得目标 Case 的受限上下文。
- `InboxItem` 只表示外部原始材料；用户对澄清问题的回答保存为 `ChatMessage` evidence。
- 对话不会替代结构化状态或字段级来源证据。
- 信息不完整时，系统每次只询问一个阻塞确认的问题。
- Event 合并候选和权威状态，不创建独立 `EventDraft`；状态为 `COLLECTING`、`READY`、`CONFIRMED`、`IGNORED` 或 `CANCELLED`。
- 只有通过阻塞项 Gate 的准确 Event version 才显示为可确认的 Event Preview Card，并由用户明确确认。
- 已确认 Event 的候选操作进入内嵌 pending 区域：更新使用 `pendingChanges` 保存拟议字段差异；取消不写入字段差异，只使用 `pendingOperation`、`pendingEvidence` 和 `pendingStatus`。接受前不得覆盖正式字段。
- 确认 Event 与导出日历是两个独立操作；系统不会自动导出或写入日历。
- 仅在需要后台任务时引入 Redis。
- 只有在普通搜索和检索调试已经存在后，才引入 pgvector。
- 原生 Apple EventKit companion 是可选项，并且要等 Web 产品证明有用之后再做。
- AI 输出是草稿；由用户确认的产品状态才具有权威性。
- V1 使用固定工作流编排，而不是自主 Agent loop；动态工具选择推迟到 V5。
- 当前交互和领域边界由 ADR 0003 锁定；ADR 0002 只保留为设计历史。

## 版本概览

| 版本    | 产品成果                                       | 主要学习成果                                   |
| ------- | ---------------------------------------------- | ---------------------------------------------- |
| V1      | 单一 Agent chat -> 已确认 Event -> 导出 `.ics` | HTTP、Drizzle、PostgreSQL、测试、AI 结构化输出 |
| V2      | 安全的个人账户与澄清工作流                     | 身份认证、授权、并发、持久化工作流状态         |
| V3      | 截图/PDF、后台处理、提醒                       | 文件、对象存储、队列、worker、重试、幂等       |
| V4      | 将新通知与个人历史关联                         | 搜索、pgvector、RAG、检索评估                  |
| V5      | 有边界的有状态 LifeInbox Agent                 | 工具、checkpoint、暂停/恢复、预算、审批        |
| V6      | 安全且可诊断的生产系统                         | 日志、指标、trace、部署、备份、隐私            |
| 可选 V7 | 直接集成 Apple Calendar                        | 原生 EventKit、外部副作用、最终一致性          |

## 如何使用这套文档

开始一个里程碑之前：

1. 只审查该里程碑及其前置条件。
2. 写出它的五行 feature card。
3. 决定不变量和故障实验。
4. 实现最小 happy path。
5. 在验收测试通过之前，不开始下一个里程碑。

这套文档是规划产物，有意不包含应用脚手架或具体实现。
