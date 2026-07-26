# LifeInbox AI 与 Agent 学习地图

[English](05-ai-agent-learning-map.en.md)

## 1. 学习目标

LifeInbox 先构建可靠、可测试的 AI 组件，再允许模型在受限能力中选择下一步。聊天界面从 V1
开始存在，但真正的 Agent loop 到 V5 才引入。

```text
单一聊天界面 + 结构化模型调用
-> 固定的路由、提取、证据和澄清工作流
-> 异步文件处理
-> 可评测的检索与历史事项关联
-> 有边界的 Agent 工具循环
-> 持久化暂停、恢复和生产可观测性
```

每个阶段都必须保留同一条安全边界：

> 模型可以理解、解释和提出候选内容，但不能绕过 Backend Gate 把候选内容变成权威 Event
> 或外部副作用。

## 2. 本项目使用的术语

### 2.1 单一聊天界面

用户只看到一个按时间排序的 Agent 对话，不需要进入或切换 Case。

这不意味着把完整聊天历史发送给模型。Backend 会先判断消息用途，再只加载当前任务所需的
LifeCase、InboxItem、Event、PendingQuestion 和偏好：

```text
全局可见 Chat
!=
全局无边界 LLM context
```

`ChatMessage` 是可读对话记录。它可以引用一个内部 `caseId`、`eventId` 或
`replyToMessageId`，但查询、一般说明和尚未完成路由的消息可以暂时不属于任何 Case。

### 2.2 内部事项与权威状态

`LifeCase` 是领域对象的规范名称；文档在不引起歧义时会简称为 `Case`。

- `LifeCase` 是一件具体生活事项的内部上下文边界，用户不需要看见它。
- `InboxItem` 是外部原始材料，例如粘贴通知、邮件、PDF 或外部聊天记录；创建后不可静默覆盖。
- 用户与 LifeInbox Agent 的澄清回答是 `ChatMessage` evidence，不自动成为 InboxItem。
- 一个 LifeCase 可以没有 InboxItem，也可以积累多个 InboxItem，但最多拥有一个 Event；直接表达的事项只使用 ChatMessage evidence。
- `Event` 同时承载确认前候选和确认后事实，不引入独立 `EventDraft`。
- `Event.status` 使用 `COLLECTING`、`READY`、`CONFIRMED`、`IGNORED` 和 `CANCELLED`。
- `EventFieldEvidence` 保存重要字段来自 InboxItem、用户回答、显式编辑或已接受默认值的依据。

安排查询只读取 Event store 中的 `CONFIRMED`/`CANCELLED` 权威状态；Calendar 导出只读取
`CONFIRMED` Event。聊天文本、模型输出和 Preview Card 都不能成为第二份事实来源。

### 2.3 单次模型调用

程序将一份输入和严格 schema 交给模型，并校验结构化输出。程序已经决定调用目的和后续
步骤，所以这是 AI 功能，不是 Agent。

### 2.4 固定工作流

V1 的应用程序代码决定顺序：

```text
保存用户消息和外部来源
-> 路由到新事项、澄清回答、Event 查询或一般消息
-> 提取一个候选 Event
-> 校验证据和字段完整性
-> 有 blocker：展示 Draft Progress 并提出一个问题
-> 无 blocker：展示 Event Preview Card
-> 用户明确确认
-> Event 成为 CONFIRMED
```

模型可以生成候选字段和问题措辞，但不能自行选择任意工具、确认 Event 或导出 Calendar。

### 2.5 检索增强工作流

应用程序按固定顺序搜索相关 Event、LifeCase 和 InboxItem，再把带引用的结果提供给模型。
检索和生成存在并不自动等于 Agent。

### 2.6 Agent loop

模型观察当前状态和工具结果，在 allowlist 中选择下一步，接收执行结果后继续、暂停或停止。
LifeInbox 在 V5 中才首次引入这个机制。

## 3. V1 AI：可靠的路由、提取与确定性澄清

### 3.1 目标

从单一 Chat 接收自然语言或粘贴通知，把消息安全地路由到正确用途，并在一个 LifeCase 中形成
零个或一个 Event：

```text
NO_ACTION
EVENT
MULTIPLE_MATTERS
```

V1 不允许一个 Case 产生多个 Event。识别到多个独立事项时，Agent 要求用户选择当前处理的
一个事项，或由用户分开提交；V1 不自动创建多个 Case，更不能把多个 Event 塞进同一个 Case。

### 3.2 固定意图

V1 只需要以下有限意图：

| Intent                 | 含义                                 | Case 处理                                   |
| ---------------------- | ------------------------------------ | ------------------------------------------- |
| `NEW_MATTER`           | 用户直接表达一个新事项               | 创建 LifeCase，以 ChatMessage 作为 evidence |
| `NEW_SOURCE`           | 用户提交一份外部原始材料             | 创建 LifeCase、InboxItem 和 ExtractionRun   |
| `CLARIFICATION_ANSWER` | 回答当前结构化问题                   | 绑定准确 PendingQuestion 和 LifeCase        |
| `EVENT_QUERY`          | 查询越过确认边界的安排               | 不创建 InboxItem；读取 Event store          |
| `GENERAL`              | 产品说明或无法归入以上类型的普通消息 | 默认不绑定 Case                             |

自动识别历史 Event 更新和取消属于后续版本。V1 若无法确定消息目标，必须提出澄清问题，不得静默
关联。

### 3.3 提取输入

- 当前用户消息，以及存在外部材料时的 immutable InboxItem 内容。
- 可信时提供源语言。
- 用户默认时区。
- 出现相对日期时提供固定 `referenceDate` 及来源。
- 仅在相关时提供默认时长和提醒偏好。
- 当前 LifeCase 中明确允许的澄清证据。

如果没有可信参考日期，`tomorrow` 等相对日期保持未解析并要求用户确认。评测使用固定时钟。

### 3.4 结构化输出

```text
outcome: NO_ACTION | EVENT | MULTIPLE_MATTERS

event:
  type: APPOINTMENT | DEADLINE | REMINDER
  title
  temporalData
  location
  nextAction
  proposedFieldEvidence

warnings
multipleMatterSummaries
```

约束：

```text
NO_ACTION        => event == null
EVENT            => event != null
MULTIPLE_MATTERS => event == null，等待用户选择一个事项或分开提交
```

模型只提出候选值和引用。Backend adapter 校验 schema、InboxItem 标识、原文引用和位置，不能
因为模型声称“有证据”就直接接受。

### 3.5 字段证据

每个重要字段使用以下状态：

```text
SUPPORTED_BY_SOURCE  外部原始材料支持该值
PROVIDED_BY_USER     用户通过澄清或显式编辑提供该值
DEFAULT_ACCEPTED     默认值已展示并由用户明确接受
MISSING              当前没有可用值
CONFLICTING          存在互相冲突的值
```

`SUPPORTED_BY_SOURCE` 必须引用具体 InboxItem；`PROVIDED_BY_USER` 必须引用用户 ChatMessage；
显式 Card edit 先在同一事务中追加 `EVENT_EDIT` 用户 ChatMessage，再让 evidence 引用它；
`DEFAULT_ACCEPTED` 必须引用用户已明确接受的 UserPreference。模型 confidence 只用于调试或排序，
不能把 `MISSING` 或 `CONFLICTING` 提升为有依据的事实。

### 3.6 确定性完整性 Gate

应用程序按 Event 类型维护版本化字段规则：

- `BLOCKING`：缺失或冲突时不能确认。
- `NON_BLOCKING`：可以确认，但 Preview Card 必须显示 warning。
- `OPTIONAL`：可以保持缺失。

默认值是否可提出是另一项策略，不是第四种 requirement。只有用户明确接受，字段才能变为
`DEFAULT_ACCEPTED`。

有多个 blocker 时，程序按照固定优先级选择一个。模型或模板只负责把已选问题表达清楚。
`PendingQuestion` 记录：

```text
caseId
eventId?
assistantMessageId
kind: FIELD_CLARIFICATION | MATTER_SELECTION
fieldKey?
status: OPEN | ANSWERED | SUPERSEDED | CANCELLED
```

`MATTER_SELECTION` 可以在 Event 尚不存在时使用空 `eventId`。用户回答通过
`replyToMessageId -> assistantMessageId` 或显式 resume action 绑定准确问题。不能仅凭“18:00”
这样的文本猜测它属于哪个 Case；新信息使旧问题失效时将其标记为 `SUPERSEDED`。

### 3.7 数据流

新外部来源使用两个短事务，LLM 调用不放在事务中：

```text
事务 A：
保存 ChatMessage
+ 创建 LifeCase
+ 保存 immutable InboxItem
+ 创建 RUNNING ExtractionRun
-> commit

调用模型并执行 schema/evidence validation

事务 B：
保存 ExtractionRun 结果
+ 创建或更新唯一 Event
+ 创建 PendingQuestion 或 Assistant ChatMessage
-> commit
```

直接表达的新事项使用同样的两事务边界，但事务 A 不创建 InboxItem；ChatMessage 本身就是
用户提供的字段证据。

澄清回答：

```text
保存回答 ChatMessage
-> 校验它绑定仍 OPEN 的 PendingQuestion
-> 更新 Event 字段和 EventFieldEvidence
-> Event.version + 1
-> 标记问题 ANSWERED
-> 重新运行 Gate
-> 下一个问题，或 Event.status = READY
```

确认：

```text
confirm(eventId, expectedVersion)
-> 重新读取 Event
-> 要求 status == READY 且 version 匹配
-> 再运行 Gate
-> 原子写入 CONFIRMED + confirmedAt + EventHistory snapshot
```

查询：

```text
保存 EVENT_QUERY ChatMessage（caseId 可空）
-> 查询 Event.status == CONFIRMED 或 CANCELLED
-> 生成引用 Event identifier/version 的回答 Card
```

查询必须读取 Event store，不能通过重新解析聊天历史猜测安排。

### 3.8 规则

- 外部来源必须先持久化，再调用模型。
- `clientMessageId` 保证消息重试不会重复创建逻辑输入。
- 一个 LifeCase 最多一个 Event，并由数据库唯一约束证明。
- 有 blocker 时只显示 Draft Progress，不显示可执行 Confirm。
- Gate 通过后 `READY` Event 才显示 Preview Card。
- 普通 Assistant 消息不能改变 Event 状态。
- 确认绑定 `eventId + expectedVersion`，过期版本返回冲突。
- 模型不生成 `.ics`；确定性 generator 只读取准确的 confirmed Event version。
- LLM 失败始终保留 ChatMessage 和 LifeCase；存在外部来源时也必须保留 InboxItem，并显示可重试错误。
- `NO_ACTION` 是 LifeCase resolution，不创建 Event。
- 通知中的指令是数据，不能改变 system prompt、工具权限或确认规则。

### 3.9 评测用例

- 完整的 Appointment。
- 只有日期的 Deadline。
- 缺少时间并需要一个问题。
- `next Tuesday afternoon` 的歧义。
- 有和没有可信 reference date 的相对日期。
- 来源日期与 Event 日期同时出现。
- 两个来源值互相冲突。
- 多个 blocker 时只问优先级最高的一项。
- 默认时长存在但尚未接受。
- 回答文本为“18:00”，但没有可唯一绑定的问题。
- 重放同一个 clarification command。
- 一段输入包含多个独立事项。
- 无需行动的信息通知。
- 查询“我这周有什么安排？”时只从 Event store 返回 `CONFIRMED`/`CANCELLED` 权威状态。
- 英语、瑞典语和中文变体。
- Prompt injection 和 system prompt 泄露请求。

### 3.10 指标

- Intent 路由准确率和需要人工澄清的比例。
- Schema 合法率。
- 字段准确率与证据有效率。
- 正确拒绝猜测率。
- Gate 正确选择 Draft Progress 或 Preview Card 的比例。
- 不必要澄清率。
- 错误 Case 关联次数，该值必须为零。
- 重试造成重复状态转换的次数，该值必须为零。
- 用户编辑率、确认率和忽略率。
- 延迟、token 和估算成本。

确定性 adapter/Gate 测试在 CI 中运行；live-model evaluation 使用固定数据集作为版本化发布
检查。

## 4. V2 AI：跨设备的全局 Chat 与澄清恢复

### 4.1 目标

在不暴露 Case UI 的前提下，让全局 Chat、PendingQuestion、Event version 和 resume card
跨设备安全恢复。

### 4.2 工作流

```text
加载用户全局 Chat cursor
-> 加载可见时间线和未完成 resume cards
-> 用户回答一个明确问题
-> 使用 replyToMessageId + expectedEventVersion 幂等消费
-> 更新 Event/evidence
-> 重新运行 Gate
-> 在同一全局时间线追加问题或 Preview Card
```

每个设备看到相同的权威 Event 状态。对话顺序不能决定状态；PostgreSQL 中的
PendingQuestion、Event 和证据才决定状态。

### 4.3 验收

- 同一用户只能读取自己的 Message、Case、InboxItem 和 Event。
- 全局 Chat 使用稳定 cursor 顺序。
- 两台设备回答同一问题时，最多一个 command 成功。
- stale `expectedEventVersion` 返回冲突，不覆盖较新证据。
- 刷新后能从持久化状态重建 Draft Progress、Preview Card 和 resume cards。

多轮聊天和跨设备恢复仍是固定工作流，不构成 Agent loop。

## 5. V3 AI：异步文件与提取流水线

### 5.1 目标

把 PDF、截图和图片转换为有证据支持的候选 Event，同时不让长任务占用 HTTP 请求。

```text
校验上传
-> 保存文件元数据和 InboxItem
-> queue
-> worker 解析/OCR
-> 保存规范化文本和页码/区域证据
-> 运行结构化提取
-> 更新唯一 Event
-> Draft Progress 或 Preview Card
```

文件解析失败、OCR 不确定、模型失败和 queue 失败是不同状态，不能混为一类。

一份文件如果包含多个独立事项，不能在一个 Case 中创建多个 Event。V3 必须先显示拆分建议，
由用户确认后创建多个内部 Case；共享文件内容应通过明确的 source reference 复用，而不是复制
并悄悄产生多个权威事项。

### 5.2 安全与评测

- 文件文本是不可信数据。
- 重试同一个 job 不得创建重复 InboxItem 或 Event。
- 评测 OCR/解析质量、证据页码/区域、拒绝不可读内容和 prompt injection。
- 分开衡量“发现多个事项”和“正确拆分 Case”，不能使用一 Case 多 Event 的 recall 指标。

## 6. V4 AI：检索、更新识别与安全关联

### 6.1 目标

判断一份新来源是在创建新事项，还是更新或取消某个已有 Event。用户仍然只在全局 Chat 中完成
确认。

```text
新 InboxItem 候选
-> metadata / keyword / full-text search
-> 必要时 pgvector
-> 返回候选 LifeCase/Event 与证据
-> 关系判断
   -> NEW_CASE
   -> UPDATE_EXISTING
   -> CANCEL_EXISTING
   -> NO_MATCH
   -> INSUFFICIENT_EVIDENCE
-> 有歧义时询问用户
```

只有目标被唯一、可解释地确定后，新 InboxItem 才能关联到已有 LifeCase。

### 6.2 Confirmed Event 的候选变更

更新已有 Event 时，正式字段和 `CONFIRMED` 状态保持不变：

```text
pendingOperation: UPDATE | CANCEL
pendingChanges? # 仅 UPDATE；CANCEL 时为空
pendingEvidence
pendingStatus: COLLECTING | READY
```

Agent 展示 before/after Preview。用户确认后，Backend 才原子应用变更、递增 Event version、
清空 pending 字段并追加 EventHistory。取消确认后才把 Event 设为 `CANCELLED`；用户拒绝 update
或 cancel 时清空四个 pending 字段、保持正式 Event 不变，并追加 `PENDING_DISCARDED` history。

`pendingChanges` 是 Event 内 pending 区域中的 update 字段差异，不是第二个 Event，也不是独立 EventDraft。

### 6.3 检索评测

- 正确找到同一具体事项。
- 区分相似但不相关的 Event。
- 旧来源与新来源冲突时优先保留明确的新证据，同时展示变化。
- 没有可靠匹配时返回 `NO_MATCH`。
- 有候选但证据不足时返回 `INSUFFICIENT_EVIDENCE`。
- 跨用户结果必须为零。
- 错误静默关联必须为零。

检索到的内容仍是不可信数据；RAG 只能提出关联和变更候选，不能确认或执行。

## 7. V5 AI：有边界的 Agent loop

### 7.1 进入门槛

在 Agent 成为默认路径前：

- 保存至少三个确实需要动态分支的任务。
- 以固定工作流为 baseline。
- 比较完成率、安全性、步骤、延迟和成本。
- 记录 go/no-go 决策。

如果动态工具选择没有稳定价值，继续使用固定工作流。

### 7.2 初始工具

| 工具                         | 类型           | 允许的结果                                   |
| ---------------------------- | -------------- | -------------------------------------------- |
| `get_user_preferences`       | Read           | 读取允许的设置                               |
| `get_current_case`           | Read           | 读取当前内部事项                             |
| `get_current_event`          | Read           | 读取准确 Event version                       |
| `search_related_events`      | Read           | 返回带来源的候选                             |
| `retrieve_personal_sources`  | Read           | 返回带引用的 InboxItem/chunk                 |
| `ask_clarification`          | Pause/proposal | 创建 PendingQuestion                         |
| `propose_new_event`          | Proposal       | 填充或更新未确认 Event，不确认               |
| `propose_event_update`       | Proposal       | 写入 pendingChanges，不覆盖 confirmed fields |
| `propose_event_cancellation` | Proposal       | 写入 pendingOperation，不取消正式 Event      |
| `propose_calendar_export`    | Proposal       | 返回预览，不生成外部副作用                   |
| `finish_without_action`      | Terminal       | 无外部副作用                                 |

确认 Event、应用 pendingChanges、生成 `.ics`、发送通知和写入 EventKit 都不是第一个 Agent 的
工具。它们仍然需要显式用户 command 和 Backend validation。

### 7.3 概念循环

```text
加载 run、checkpoint、内部 Case、Event version 和预算
-> 暴露 allowlisted tools
-> 模型选择一步
-> Backend 校验参数、ownership、version 和预算
-> 执行
-> 持久化 step 与 observation
-> 继续、暂停、完成或停止
```

AgentRun 状态：

```text
QUEUED
RUNNING
WAITING_FOR_USER
PROPOSAL_READY
COMPLETED
FAILED
CANCELLED
BUDGET_EXCEEDED
```

第一个 Agent 最多五步，并设置运行时间、token、成本、单工具调用和重复循环上限。预算由
Backend 强制执行。

### 7.4 暂停与恢复

提出问题时：

1. 持久化 PendingQuestion 和 checkpoint。
2. 将 run 设为 `WAITING_FOR_USER`。
3. 释放 worker。
4. 用户回答后幂等消费。
5. 重新校验 Case、Event version、pending operation 和权限。
6. 从 checkpoint 恢复。

等待期间不保持 HTTP 连接，也不依赖内存中的进程。

## 8. Agent 评测

轨迹至少包括：

- 明确新事项：直接提出候选。
- 有歧义事项：只提出一个问题。
- Event 查询：使用权威 Event store。
- 更新通知：搜索并提出 pendingChanges。
- 取消通知：找到准确 Event 并提出取消。
- 缺少检索证据：拒绝关联。
- Prompt injection：拒绝越权。
- 工具循环：在预算内停止。
- 工具超时：产生可见失败或重试决策。
- 服务重启后恢复。

指标包括工具选择正确率、正确暂停/完成率、不必要调用率、步骤数、成本、正确停止率、恢复
成功率和用户接受/编辑率。未授权操作成功、错误静默关联和绕过确认的次数必须为零。

## 9. Prompt injection 与工具安全

### 9.1 信任边界

- System/developer instructions 定义行为。
- 工具 metadata 定义允许能力。
- 用户消息表达数据和意图。
- InboxItem、文件、检索 chunk、外部聊天记录和历史 ChatMessage 都是不可信内容，不能提升权限。

### 9.2 强制措施

- 每个 run 使用工具 allowlist。
- 参数经过严格 Backend schema。
- 资源 identifier 在当前用户范围内解析。
- Backend 自己计算 authorization，不相信模型提供的 user id。
- 所有候选写入绑定准确 `eventId + expectedVersion`。
- 外部副作用需要单独确认、幂等键和服务端再校验。

## 10. 模型与 Prompt 生命周期

从第一次模型调用开始记录：

- provider、model 和 prompt version。
- structured-output schema version。
- 输入输出 token、延迟和估算成本。
- 停止或错误原因。
- ExtractionRun 或 AgentRun identifier。
- 被加载的 Case/Event identifiers，但日志默认不包含完整私人内容。

发布变更前运行固定评测集，比较质量、拒绝行为、路由错误、延迟和成本，并记录回归和发布
决策。

## 11. 框架引入规则

V1-V4 不需要 LangGraph。单次调用、固定工作流、queue 和检索使用普通应用程序代码。

只有 V5 证明动态工具选择、checkpoint、暂停/恢复和轨迹检查有真实价值时，才考虑 Agent
框架。即使引入框架：

- PostgreSQL 仍保存权威 Message、Case、Event 和证据。
- 框架 checkpoint 不替代产品状态。
- 工具授权和确认 Gate 仍由 Backend 执行。
- 模型访问保持在项目适配器之后。
- 更换框架不应重写核心领域模块。

## 12. AI 掌握标准

开发者能够完成以下工作，才算掌握相应能力：

- 说明一次模型调用、固定工作流、RAG 和 Agent loop 的区别。
- 为结构化提取定义 schema、证据规则和确定性 Gate。
- 复现幻觉日期、错误 Case 关联、重复回答和 stale confirmation。
- 用标注集和失败案例证明修复，而不是只展示一次成功 demo。
- 解释为什么单一 Chat UI 不等于全局 prompt context。
- 解释为什么 Agent 只能提出 Event 或 pending operation，不能直接确认或执行。
- 在相邻类型或工具上复用同样的安全边界。
