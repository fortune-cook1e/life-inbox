# LifeInbox 里程碑方法

[English](06-milestone-method.en.md)

## 1. 目的

这份文档规定如何通过 LifeInbox 学习和交付，而不让生成代码或庞大路线图代替工程判断。
进度由一个可证明正确的产品能力衡量，而不是由周数、章节或框架数量衡量。

产品交互基线是：

```text
一个 Agent Chat
-> 证据完整时展示 Event Preview Card
-> 用户明确确认
-> Chat 查询或后续 Events tab 展示权威 Event
```

LifeCase 和 InboxItem 是内部模型，不是要求用户学习的导航概念。
`LifeCase` 是领域对象的规范名称；文档在不引起歧义时简称为 `Case`。

## 2. 固定的里程碑循环

```text
定义需求
-> 定义不变量
-> 实现最小 happy path
-> 注入一个真实失败
-> 观察错误行为
-> 定向阅读文档
-> 改进设计
-> 增加自动化测试
-> 不看代码解释结果
```

不要在开始时要求 Codex 实现完整产品。每个切片都应产生用户可观察结果和独立证据。

## 3. 五行功能卡

实现前创建：

```markdown
## 功能卡

目标：

数据流：

必须始终成立的规则：

可能的失败点：

如何证明正确性：
```

功能卡应能在一个屏幕内读完。如果不能，里程碑通常过大。

## 4. 编码前的设计问题

只回答与当前切片有关的问题：

- 用户在唯一 Agent Chat 中会看到什么变化？
- 这条消息是直接表达的新事项、外部新来源、澄清回答、Event 查询还是普通消息？
- 消息是否必须关联 LifeCase；如果无法唯一确定，系统如何询问？
- 哪一个 LifeCase 拥有当前事项？
- 哪些内容是 immutable InboxItem，哪些只是 ChatMessage？
- LifeCase 是否允许 `0..* InboxItem`，并且只在存在外部材料时创建 InboxItem？
- 一份来源包含多个独立事项时，V1 是否要求用户选择一个事项或分开提交，而不是自动拆分 Case？
- 一个 Case 最多一个 Event 的约束如何证明？
- Event 当前是 `COLLECTING`、`READY`、`CONFIRMED`、`IGNORED` 还是 `CANCELLED`？
- blocker 存在时是否只显示 Draft Progress，Gate 通过后才显示 Preview Card？
- 哪些字段是 `BLOCKING`、`NON_BLOCKING` 或 `OPTIONAL`？
- 每个重要字段是 `SUPPORTED_BY_SOURCE`、`PROVIDED_BY_USER`、
  `DEFAULT_ACCEPTED`、`MISSING` 还是 `CONFLICTING`？
- 确认绑定哪个 `eventId + expectedVersion`？
- 已确认 Event 的候选操作是否只进入内嵌 pending 区域而没有覆盖正式字段？更新是否使用 `pendingChanges` 保存字段差异，而取消保持它为空？
- 哪些写入必须原子完成？
- 哪些事情可能重复、乱序或在成功后丢失响应？
- 哪些错误可以安全重试？
- 谁可以读取或修改这些记录？
- 哪些证据能够证明行为正确？

当前里程碑不需要 queue、cache、Agent state、pgvector 或微服务时，不要提前设计。

## 5. 完成定义

只有满足以下条件，里程碑才算完成：

- 用户可见路径能从唯一 Chat 完成，不要求用户进入 Case 或表格。
- 产品与数据不变量已经写下。
- 页面刷新后可以从结构化记录重建消息、Draft Progress、Preview Card 或 confirmed Event，
  不需要重新解析 Assistant 文本。
- Event 查询只读取权威 Event store。
- Case 上下文隔离经过测试；全局 Chat 不会导致模型读取无关 Case。
- 至少复现了一个真实失败。
- 自动化测试证明重要行为。
- 用户或运维人员能够看到错误和重试状态。
- 日志有用且不泄露私人来源内容。
- 有意义的选择记录为简短 ADR。
- 开发者无需看代码即可解释数据流与 trade-off。
- 延期工作有明确记录。

只通过 happy path 不代表完成。

## 6. 必需的证据包

每个里程碑至少留下：

1. 可运行代码。
2. 自动化测试。
3. 一个记录完整的失败实验。
4. 更新后的功能卡。
5. 对真实决策的简短 ADR。
6. 更新后的数据流或状态说明。
7. 一段 60 至 120 秒技术解释。
8. 一条简洁的作品集或面试陈述。

对话式里程碑的数据流必须明确分支，而不是把 InboxItem 或 Event 当作所有消息的必经节点：

```text
ChatMessage
-> 路由决定
   -> NEW_MATTER
      -> internal LifeCase + ChatMessage evidence
      -> Event | NO_ACTION | MULTIPLE_MATTERS
   -> NEW_SOURCE
      -> internal LifeCase + immutable InboxItem
      -> Event | NO_ACTION | MULTIPLE_MATTERS
   -> CLARIFICATION_ANSWER
      -> exact PendingQuestion
      -> Event + EventFieldEvidence
   -> EVENT_QUERY
      -> authoritative Event query
   -> GENERAL
      -> ChatMessage only

Event COLLECTING/READY
-> Draft Progress / Preview Card
-> confirm(eventId, expectedVersion)
-> authoritative Event
```

建议的技术解释结构：

```text
用户需求是……
系统必须保证……
我最初的方法是……
它在以下情况下失败……
我通过以下方式修改了设计……
我使用以下方法完成验证……
主要权衡是……
```

## 7. 失败实验模板

```markdown
## 失败实验

预期不变量：

注入的失败：

修复前观察到的行为：

根本原因：

设计变更：

修复后的自动化证明：

剩余限制：
```

实验应针对真实正确性边界，例如重复提交、stale version、错误 Case 关联或 LLM 超时，而不是
随意制造异常。

## 8. ADR 模板

```markdown
# ADR NNNN：决策标题

## 状态

Proposed | Accepted | Superseded

## 背景

存在哪些产品需求和约束？

## 选项

考虑了哪些现实可行的选项？

## 决策

选择了什么？为什么？

## 后果

哪些事情变得更容易、更困难，或被推迟？

## 验证

哪项测试、指标或实验能够证明这个决策有效？
```

ADR 用于记录决策，不是某项技术的教程。被新决定替代的 ADR 应标记 `Superseded` 并链接新
ADR，不能删除历史理由。

## 9. 审查流程

### 9.1 产品审查

- 用户是否只需通过 Agent Chat 完成主要任务？
- UI 是否泄露 LifeCase、InboxItem 等内部概念？
- blocker 存在时是否只有 Draft Progress 和一个问题？
- Preview Card 是否只展示已通过 Gate 的 `READY` Event？
- Confirm 是否是候选内容成为权威事实的唯一入口？
- 未完成事项能否通过 Chat 中的 resume card 恢复？
- Events tab 是否只读取 confirmed/cancelled authoritative data？
- 不确定和错误状态是否容易理解？
- 是否有额外功能偷偷进入范围？

### 9.2 数据审查

- 哪些表和 constraint 改变？
- ChatMessage 的全局顺序、optional caseId 和 reply target 是否明确？
- LifeCase 是否确实表示一件具体事项？
- InboxItem 是否只保存外部原始材料并保持 immutable？
- `UNIQUE(event.caseId)` 是否证明一 Case 最多一 Event？
- Event 正式字段和 pending 区域是否清楚分离？`pendingChanges` 是否只保存更新的拟议字段差异，并在取消时为空？
- 每个重要字段的 evidence 和来源是否可检查？
- Event version、状态转换、确认 snapshot 和 Calendar export 是否绑定准确？
- 时间语义、忽略、取消和删除语义是否明确？

### 9.3 失败审查

- 同一 `clientMessageId` 重放会发生什么？
- “18:00”无法唯一绑定问题时会发生什么？
- LLM 超时后原始 InboxItem 是否仍存在？
- 两个客户端同时回答或确认时会发生什么？
- stale `expectedVersion` 是否被拒绝？
- 任一 pending 字段是否可能提前污染 confirmed Event 查询？
- Calendar export 是否可能读取错误版本？
- 哪些失败在真实 PostgreSQL 或 worker 上验证？

### 9.4 安全审查

- 全局 Chat 是否可能把另一个用户或另一个 Case 的内容送入 prompt？
- 用户或 Agent 工具是否可以越过 ownership？
- 日志和错误是否泄露来源全文？
- 外部副作用是否经过明确确认、准确版本绑定和幂等保护？

### 9.5 学习审查

- 开发者能否说明目的、失败、修复、测试和 trade-off？
- 开发者能否在没有逐步指导的情况下完成相邻改动？

## 10. Codex 协作边界

Codex 可以：

- 解释概念和错误。
- 比较设计选项。
- 提出不变量、边界用例和失败实验。
- 在设计确定后搭建重复性脚手架。
- 生成或审查 tests、migrations 和 SQL。
- 检查中英文文档一致性。

开发者应当亲自掌握并最终决定：

- 用户可见 Chat/Events/Settings 边界。
- LifeCase、InboxItem、ChatMessage 和 Event 的职责。
- 消息路由和歧义处理规则。
- 一 Case 最多一 Event 的约束。
- 完整性 Gate、字段 requirement 和默认值接受规则。
- EventFieldEvidence 与 provenance。
- Event 状态、version、四个 pending 字段和确认边界。
- Drizzle schema、migration 与 transaction。
- 时间语义。
- Authentication/authorization。
- 重试、幂等与冲突处理。
- Agent 工具权限。
- 评测集、发布阈值和最终验收。

## 11. 紧接着要做的里程碑：V1.0

暂时不要开始 AI 提取。

### 11.1 功能卡草案

```text
目标：
使用 Drizzle 启动连接 PostgreSQL 的 NestJS API，确保 migrations 可复现，并提供一个真实
integration test。

数据流：
环境配置 -> pg Pool -> Drizzle client -> PostgreSQL -> 测试断言。

必须始终成立的规则：
Drizzle 是唯一 ORM；空数据库可通过已提交 migrations 达到当前 schema；测试绝不指向开发
数据库。

可能的失败点：
URL 无效、数据库不可用、migration 缺失、测试 schema 过期、pool 未关闭、意外安装 TypeORM。

如何证明正确性：
初始化空测试数据库，应用 migrations，执行真实 Drizzle 查询（例如 SELECT 1），并确认没有
TypeORM package 或 import。第一个产品表在 V1.1 引入。
```

### 11.2 实现前需要决定

- Node 和 pnpm 的准确版本。
- 依据官方文档验证的 Drizzle 和 PostgreSQL driver 版本。
- Schema 和 migration 目录。
- 开发与测试数据库命名。
- 测试隔离方法。
- 开发和生产 migration 命令。
- PostgreSQL 不可用时的 health/readiness 行为。

只有 V1.0 通过后，V1.1 才引入 LifeCase、InboxItem 和 ChatMessage。

## 12. 第一个产品里程碑：V1.1

### 12.1 功能卡草案

```text
目标：
用户在唯一 Agent Chat 中直接描述一件事项或粘贴一条生活通知；刷新后仍能在同一时间线看到
完全相同的消息和保存结果，而不出现 Cases 页面。

数据流：
Next.js Chat input
-> POST /messages with clientMessageId
-> NestJS validation
-> transaction
-> NEW_MATTER: ChatMessage + internal LifeCase
-> NEW_SOURCE: ChatMessage + internal LifeCase + immutable InboxItem
-> Drizzle -> PostgreSQL
-> deterministic Assistant acknowledgement
-> reload global Chat timeline。

必须始终成立的规则：
LifeCase 是内部具体事项并拥有 `0..* InboxItem`；只有外部材料创建 InboxItem，其原文非空、
有大小上限且 immutable；直接事项只使用 ChatMessage evidence；用户不需要知道 caseId；同一
clientMessageId 只创建一次逻辑输入。

可能的失败点：
payload 无效、事务只写入部分记录、数据库不可用、重复请求、全局 Message 顺序不稳定、
Case identifier 泄露到 UI、来源内容在日志中泄露。

如何证明正确性：
真实 PostgreSQL integration tests 分别证明：NEW_MATTER 原子写入 Message + Case 且没有
InboxItem；NEW_SOURCE 原子写入 Message + Case + InboxItem。重放 clientMessageId 不会重复；
最小浏览器流程创建并刷新 Chat 后逐字验证消息/来源不变，且页面不存在 Cases 导航。
```

V1.1 不包含 LLM、Event、Draft Progress、Preview Card、Redis、文件、authentication、vector
search、Events tab 或 Calendar export。确定性 Assistant 回复只提供聊天外观，不构成 Agent。

从 V1.2 开始，如果一份来源包含多个独立事项，固定工作流必须要求用户选择当前事项或分开
提交。V1 不自动创建多个 Case，也不共享一个 InboxItem 给多个 Case。

V1-V4 继续使用应用代码控制的固定工作流；只有 V5 证明动态工具选择具有可评测价值后，才引入
有预算、checkpoint 和审批边界的 Agent loop。

## 13. 进度台账

```markdown
| 里程碑                   | 状态        | 已复现失败 | 自动化证明 | 已完成解释 |
| ------------------------ | ----------- | ---------- | ---------- | ---------- |
| V1.0 Drizzle baseline    | Not started | No         | No         | No         |
| V1.1 Global Chat capture | Not started | No         | No         | No         |
| V1.1b Manual Event/Card  | Not started | No         | No         | No         |
| V1.2 AI fixed workflow   | Not started | No         | No         | No         |
| V1.3 Confirm/Events view | Not started | No         | No         | No         |
```

允许状态：

- `Not started`
- `Design review`
- `Happy path`
- `Failure reproduced`
- `Fix under test`
- `Complete`

这样可以防止一个只完成了部分功能的切片仅因为代码已经存在就被标记为完成。
