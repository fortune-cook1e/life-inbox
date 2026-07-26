# LifeInbox 高级路线图

[English](03-advanced-roadmap.en.md)

## 1. 演进规则

只有 V1 的核心闭环通过真实验收后，才进入后续版本：

```text
全局 Agent chat
-> 区分 NEW_MATTER 与 NEW_SOURCE
-> 解析一个明确的具体事项
   -> NEW_MATTER：原子保存 LifeCase + 作为证据的 ChatMessage，不创建 InboxItem
   -> NEW_SOURCE：必要时先让用户选择一件事项，再原子保存 LifeCase + InboxItem + ChatMessage
-> 提取并校验证据
-> 缺信息时一次只问一个问题
-> 展示可确认 Event Card
-> 用户确认
-> Events 中出现权威 Event
-> 导出 .ics
```

后续版本可以增加账户、文件、检索、Agent loop 和原生日历写入，但不能绕过证据 Gate、显式
确认、幂等、事务边界或审计历史。

### 跨版本产品模型

普通用户只看到三个一级区域：

- **Agent：** 一个全局可见、持续增长的聊天，是输入通知、回答问题、查看 Draft Progress 和确认
  Event Card 的主要界面。
- **Events：** 只查询权威的 `CONFIRMED` 与 `CANCELLED` Event。`COLLECTING`、`READY`、
  `IGNORED` 和尚未批准的变更不作为权威事件混入该列表。
- **Settings：** 管理时区、语言、默认时长、提醒和数据偏好。

`LifeCase` 与 `InboxItem` 是内部模型，不是用户导航：

```text
LifeCase = 一件具体事项
LifeCase 1 -> 0..* immutable InboxItem
LifeCase 1 -> 0..1 Event
Event.caseId is NOT NULL + UNIQUE
```

`NEW_MATTER` 表示用户直接用自然语言表达一个新事项，例如“提醒我周五给房东打电话”。发起消息
本身就是证据，创建 LifeCase 时可以没有 InboxItem。`NEW_SOURCE` 表示用户提交外部原始材料，
例如粘贴的通知、文件或后续更新；只有该路径创建不可变 `InboxItem`。输入类型不明确时先询问，
不能把普通意图伪装成外部来源。

全局 `ChatMessage.caseId` 可以为空：普通对话可以不关联事项，`NEW_MATTER` 发起消息、
`NEW_SOURCE` 提交消息、澄清回答、Draft Progress 和 Event Card 可以关联一个内部 Case。消息
属于同一个全局 feed；它们不会形成用户可见的“每 Case 独立聊天”。

V1 不支持一个 InboxItem 被多个 Case 共享。一份 `NEW_SOURCE` 同时包含多个事项时，不自动拆分；
Agent 要求用户选择当前处理的一件事项，或把材料分开提交。V3 只有在引入显式 shared-source
reference 后，才允许用户确认拆成多个 Cases。

全局 feed 不代表模型可以混用上下文。每次提取、澄清或 Agent tool call 都必须在后端解析出一个
明确 Case，并只把该 Case 的 InboxItems、相关 ChatMessages、Event 和允许使用的偏好放入 prompt。
无法确定 Case 时先提问，不能把多个事项的事实放进同一个 prompt。

### Event 状态与确认边界

V1 只有一个 Event 实体。首次候选内容直接写入同一个 Event：

```text
COLLECTING <-> READY
COLLECTING | READY -> IGNORED
READY -> CONFIRMED
CONFIRMED -> CANCELLED
```

- `COLLECTING` 表示仍有 blocking `MISSING` 或 `CONFLICTING` 字段，只能在 Agent 中展示 Draft
  Progress 和一个问题。
- `READY` 表示证据 Gate 已通过，可以在 Agent 中展示可确认 Event Card。
- `CONFIRMED` 与 `CANCELLED` 是 Events 中的权威状态。
- `IGNORED` 表示候选事项被明确放弃，不进入 Events。

确认后的 Event 不能被候选修改直接覆盖。更新使用全部四个 pending 字段，其中
`pendingChanges` 只保存拟议字段差异；取消没有字段差异，因此只使用 `pendingOperation`、
`pendingEvidence` 和 `pendingStatus`。Events 仍读取原权威字段；Agent 显示待确认差异。用户应用
变更时，后端校验准确 Event version，在同一事务中写入 `EventHistory` snapshot/transition、
更新权威字段或状态、递增 version，并清除 pending 数据。拒绝待处理变更也要追加
`PENDING_DISCARDED` transition 审计。

聊天式 UI 不等于自主 Agent。V1–V4 使用确定性的对话编排；只有 V5 才允许模型在受限工具中选择
下一步。

## 2. V2：安全账户与跨设备全局对话

### 产品成果

用户可以在多台设备登录，并在同一个全局 Agent feed 中继续回答问题或确认 Event Card。Events
只显示该用户已经确认或取消的权威 Event，Settings 在设备之间保持一致。

### 功能

- 账户创建、登录、退出和 session 过期。
- 仅限所有者访问 ChatMessages、内部 Cases、InboxItems、Events、EventHistory 和 exports。
- 用户时区、语言、默认时长与提醒偏好。
- 全局 ChatMessage 的稳定 Cursor 顺序和跨设备增量同步。
- `ChatMessage.caseId` 的可选关联，以及后端强制的 case-scoped prompt。
- 保持“一次只问一个阻塞问题”的确定性策略。
- Event version、澄清 command 和确认 command 的 optimistic concurrency 与幂等消费。
- 账户数据导出和删除。

### 澄清流程

```text
从全局 ChatMessage 解析内部 caseId
-> 加载该 LifeCase、InboxItems、Event version 与未回答问题
-> 确定性 Gate 选择最高优先级 blocking field
-> 在全局 feed 持久化一条关联该 Case 的问题
-> 用户以 idempotency key + expectedEventVersion 回答
-> 更新同一个 COLLECTING Event，并保留 field provenance
-> 再次执行 Gate
   -> 有 blocker：在 Agent 显示 Draft Progress
   -> 无 blocker：把 Event 设为 READY，并显示可确认 Event Card
```

模型可以帮助表达已经选定的问题，但不能自行扩大 prompt 范围，也不能自由选择工具。

### 后端学习

- 身份认证、session 生命周期、Cookie 安全和 CSRF。
- owner-scoped Drizzle query 与不泄露资源存在性的授权错误。
- 全局消息 feed 的稳定分页、重复消息和乱序同步。
- LifeCase 作为具体事项的聚合边界，以及 InboxItem、Event 和 EventHistory 的所有权。
- `UNIQUE(event.caseId)`、Event version 和 stale-write 冲突。
- 澄清与确认 command 的幂等消费。
- 数据删除和隐私边界。

### AI 学习

- 全局 UI 与 case-scoped prompt 的分离。
- 从来源、用户回答、显式编辑和偏好记录 FieldProvenance。
- Draft Progress 与 READY Event Card 的证据边界。
- 没有自主循环的多轮上下文。
- 版本化 prompt 和可重放的提取尝试。

### 故障实验

- 用户 A 请求用户 B 的内部 identifier。
- 两个设备同时回答同一个问题。
- 丢失响应后重试相同 command。
- 全局 feed 中两个事项的消息交错到达。
- 客户端携带 stale Event version 确认或编辑。
- 构造 prompt 时意外混入另一个 Case 的来源。

### 验收

- 每个私有 query 都受当前用户约束。
- 全局消息在并发插入和重连后仍具有稳定顺序。
- 未关联消息不会被错误附加到某个 Case。
- 每次模型调用只包含目标 Case 的上下文。
- 相同澄清或确认 command 最多产生一个逻辑结果。
- stale Event version 返回冲突，不能覆盖较新的状态。
- 重新登录后，Agent feed、Draft Progress、READY Card 和 Events 权威数据都能从持久化状态恢复。

## 3. V3：文件、后台处理与提醒

### 产品成果

用户在全局 Agent chat 中提交真实截图或文档，离开页面后处理仍会继续；权威 Event 可以产生可靠
提醒。

### 功能

- 上传图片和文本 PDF；文本路径可靠后再增加扫描 PDF/OCR。
- 原始文件存入兼容 S3 的 Object Storage。
- 全局 feed 展示上传、处理和失败状态。
- 先保存原始文件为 SharedSource/Attachment，再异步解析和调用模型；只有关联到一个明确 Case，
  或用户确认拆分后，才创建各自的 immutable InboxItem。
- V1 的多事项来源仍要求用户选择一件事项或分开提交；V3 在引入显式 shared-source reference
  后，才允许系统提出拆分方案，并由用户确认创建多个内部 LifeCase。
- 原始文件只保存一次；每个确认后的 Case 获得自己的 immutable InboxItem 与
  SharedSourceReference，InboxItem 仍只属于一个 Case，且每个 Case 最多一个 Event。
- SharedSourceReference 把 Case-owned InboxItem 绑定到共享原文件及准确 page/region，保证
  provenance 可审计。
- 同一事项的多个来源保存为多个不可变 InboxItem，不覆盖旧来源。
- 对临时故障重试，对永久故障提供可见结果。
- 发送应用内提醒和未来七天摘要。
- `.ics` 只从准确的权威 Event version 或 EventHistory snapshot 确定性生成。

### 新增架构

```text
Object Storage
Redis + Queue
同一仓库中的 worker
Scheduler
Outbox dispatcher
```

API、worker 与 scheduler 仍属于一个模块化单体；进程分离不等于微服务。

### 建议新增的数据

```text
Attachment
SharedSource
SharedSourceReference
ProcessingJob
JobAttempt
ReminderSchedule
ReminderDelivery
OutboxEvent
```

### 后端学习

- 上传验证、Signed URL 和敏感元数据。
- Queue、worker、at-least-once delivery 与 exponential backoff。
- 业务 job key、幂等 consumer 和数据库 unique constraint。
- scheduled job、distributed lock 与 missed-window recovery。
- 数据库状态与外部投递之间的 transactional outbox。

### AI 学习

- 将 OCR 和文档解析视为上游组件。
- 识别材料中的具体事项边界并提出拆分建议；由用户确认，而不是自动创建多个 Case。
- 页面/区域级证据。
- 把文档内容视为不可信数据。

### 故障实验

- 上传伪装成 PDF 的可执行文件或超过硬限制的文件。
- 对象上传成功，但数据库写入失败。
- worker 在模型完成后、持久化前崩溃。
- 同一 job 被两个 worker 消费。
- 用户尚未确认时，worker 自动拆分多事项来源。
- 用户确认多事项拆分后，重试生成重复 Case 或重复 SharedSourceReference。
- 一个 worker 试图为同一 caseId 插入第二个 Event。
- 通知已发送但 acknowledgement 丢失。

### 验收

- 无效文件在处理前被拒绝，孤立对象有清理路径。
- 原始 SharedSource/Attachment 在任何模型调用前持久化；InboxItem 只在明确 Case 关联或用户确认
  拆分后创建。
- 重复 job 不会产生重复 Case、InboxItem 或 Event。
- 数据库约束拒绝同一个 Case 的第二个 Event。
- V1 对多事项来源要求用户选择一件事项或分开提交，不自动共享 InboxItem。
- V3 的拆分必须有显式 shared-source reference 和用户确认；不确定边界时在 Agent 中提问。
- worker 重启后恢复未完成任务。
- 提醒只基于权威 Event，不读取未批准的 pendingChanges。
- 日志不暴露文档正文或 signed URL。

## 4. V4：安全关联来源与个人检索

### 产品成果

LifeInbox 可以判断一条新 InboxItem 是否属于已有具体事项。可靠匹配时把来源附加到已有
LifeCase；存在歧义时在全局 Agent chat 中展示候选证据并提问，绝不静默关联。

### 产品示例

```text
已有内部 Case：8 月 5 日住房检查
已有权威 Event：8 月 5 日，CONFIRMED
新 InboxItem：检查改到 8 月 8 日

LifeInbox:
-> 检索候选 Case，并比较事项身份与来源证据
-> 高置信且规则允许：把 InboxItem 附加到同一个 Case，并在 Agent 说明关联结果
-> 有歧义：在 Agent 中询问“这是之前住房检查的改期吗？”
-> 关联后生成 pendingOperation=UPDATE 与 pendingChanges={date: Aug 8}
-> pendingEvidence 指向新来源，pendingStatus 由独立 Gate 决定
-> Events 继续显示 8 月 5 日的权威值
-> Agent 展示差异 Card
-> 用户应用后写 EventHistory，Event version + 1，Events 显示 8 月 8 日
```

取消通知采用相同边界：批准前 Event 保持 `CONFIRMED`，`pendingOperation=CANCEL`；批准后才转为
`CANCELLED`。真正不同但相关的事项可以使用 `CaseRelation`，不能用它替代同一事项的来源追加。

### V4 内部演进顺序

1. Metadata filter 与 exact/keyword search。
2. 保存可检查的 retrieval run、候选与分数。
3. 建立事项关联和拒绝关联的 evaluation set。
4. 使用 pgvector 在 PostgreSQL 中保存 embedding。
5. 只有评测证明有用时才引入 hybrid retrieval。
6. 让模型基于检索证据分类，但让应用规则决定是否可以自动关联。

### 功能

- 搜索内部 LifeCase、InboxItem 与权威 Event。
- 区分“同一事项的新来源”与“不同但相关的事项”。
- 记录关联决策、证据、model/prompt/index version 和 actor。
- 在 Agent 中展示已完成的自动关联并允许用户纠正，不能在用户不可见的情况下静默改变事项。
- 对歧义结果提出一个明确问题。
- 为确认后的 Event 提议 pending update/cancel，不直接修改权威字段。
- 在 Agent Card 中展示来源证据；普通用户不浏览内部 Case 列表或 identifier。

### 建议新增的数据

```text
CaseAssociationRun
CaseAssociationCandidate
CaseRelation
Document
Chunk
EmbeddingVersion
RetrievalRun
RetrievalEvalCase
```

### 后端学习

- 全文索引、pgvector、query planning 和 `EXPLAIN`。
- similarity search 前后的用户与状态过滤。
- 关联决策的 concurrency、idempotency 和 audit。
- append InboxItem 与生成 Event pending change 的事务边界。
- re-indexing/version lifecycle；只有测量到瓶颈后才增加 cache。

### AI 学习

- Chunking 与 retrieval evaluation。
- 区分 retrieval failure、association ambiguity 与 generation failure。
- 基于证据判断事项身份，而不是只看语义相似度。
- 时效性和权威来源优先级。
- 没有可靠结果时拒绝自动关联。

### 故障实验

- 语义相似但属于另一地址的通知排名第一。
- 同一事项存在两个合理候选 Case。
- 旧来源比新来源更相似。
- 检索 query 遗漏用户过滤。
- 两个设备同时处理同一更新通知。
- 关联完成前 Event 已被修改。

### 验收

- 检索不跨用户边界。
- 新 InboxItem 只能关联一个明确 Case；歧义必须询问。
- 关联 command 重试不会重复追加来源。
- pendingChanges 不污染 Events 中的权威值。
- stale Event version 不能应用 update/cancel。
- evaluation set 分别测量正确关联、错误关联和应当询问的比例。

## 5. V5：有边界的有状态 LifeInbox Agent

### 产品成果

系统可以在明确 Case 范围内决定读取上下文、搜索历史、提出问题、提议 Event 变更，或在无需
Event 时结束。它可以暂停并恢复同一个 run。这是第一个由模型选择下一工具的版本。

### 初始工具

```text
get_user_preferences
read_case_context
search_cases
ask_clarification
propose_event_change
finish_without_event
```

工具只读或提出 proposal：

- `read_case_context` 只返回 run 绑定 Case 的 InboxItems、相关 ChatMessages 和 Event。
- `search_cases` 强制限定用户范围，并返回带证据的候选。
- `ask_clarification` 在全局 feed 中写入一个关联内部 Case 的问题并暂停。
- `propose_event_change` 可以更新 `COLLECTING/READY` 候选，或为 `CONFIRMED` Event 写
  适用于目标操作的 pending 字段；它不能确认、应用、取消或执行外部副作用。

确认、应用 pending change、Calendar export、通知发送和 EventKit 写入始终是经过校验的显式
应用 command。

### Agent run 状态

```text
QUEUED
-> RUNNING
-> WAITING_FOR_USER | PROPOSAL_READY
-> RUNNING
-> COMPLETED | FAILED | CANCELLED | BUDGET_EXCEEDED
```

### 建议新增的数据

```text
AgentRun
AgentStep
ToolCall
Checkpoint
EventChangeProposal
AuditEvent
```

Proposal 记录 base Event version 与所依据的 InboxItem/ChatMessage。应用前必须重新读取 Event；
version 已变化时冲突失败。Agent 自己不能把 proposal 变成权威 Event。

### 后端学习

- 持久化 run、step、tool result 与 checkpoint。
- checkpoint 保存 caseId、Event version、预算和允许使用的工具。
- 幂等 resume event 与单个活跃 worker 的 lease。
- Agent 暂停期间的并发用户编辑。
- Tool authorization、schema validation 和 append-only audit。

### Agent 学习

- Model-selected tool use 和 observation-action loop。
- Step、时间、token、工具调用和成本预算。
- Stop condition、人工升级和 prompt injection 防护。
- 解释为什么采取某个工具步骤，但不保存隐藏 chain-of-thought。

### 第一个 Agent 的硬限制

- 每个 run 绑定一个明确 Case。
- 每个 Case 最多一个活跃 run。
- 最多五个步骤。
- 每轮最多一个问题。
- 只有 allowlist tools。
- 不自动确认 Event，不应用 pending change，不执行外部副作用。

### 故障实验

- 等待回答时进程重启。
- 同一回答提交两次。
- 暂停期间 Case 新增 InboxItem 或 Event version 变化。
- Tool call 重复、参数非法或访问其他用户。
- 检索内容包含 prompt injection。
- 预算耗尽或工具超时。

### 验收

- Run 可以跨重启恢复，不依赖进程内内存。
- 同一逻辑步骤不会产生重复业务结果。
- Tool 不能跨越 run 的 Case 与用户范围。
- Agent proposal 不修改权威 Event 字段。
- stale base Event version 无法应用。
- 没有 Agent 路径产生未经用户批准的副作用。

## 6. V6：生产环境加固

### 产品成果

系统可以安全部署、观测、备份、恢复和升级，并为真实用户提供明确的失败状态。

### 功能与学习

- 容器镜像、环境配置验证与 non-root runtime。
- HTTPS、secret management、CORS、CSRF、CSP 和安全 header。
- Migration release strategy、向后兼容 deploy 与 rollback。
- Managed PostgreSQL、备份和 restore drill。
- Object Storage、Redis 与 Queue 的安全配置。
- Structured log、metric、trace、dashboard、alert 和 SLO。
- Request、ChatMessage、Case、Event、Job、Retrieval 与 Agent correlation。
- Provider cost、retention、redaction 和 data deletion。
- Dependency、container 与 static-analysis scanning。

### 故障实验

- 不完整环境配置、失败 migration 与不兼容滚动部署。
- PostgreSQL、Redis、Object Storage 或模型 provider 不可用。
- Queue backlog、worker crash loop 与 retry storm。
- Event apply transaction 在 snapshot 和更新之间失败。
- 备份存在但 restore 失败。
- 日志意外包含私人来源文本。

### 验收

- Release 使用已提交 migration，并有测试过的恢复路径。
- PostgreSQL 权威数据不因 Redis 故障损坏。
- Dashboard 可以解释 global feed、Event、worker、retrieval 和 Agent 故障。
- Alert 覆盖 queue age、retry storm、错误率与模型成本。
- 删除流程覆盖原始、派生、embedding 和按规则保留的审计数据。

## 7. 可选 V7：原生 Apple Calendar companion

### 产品成果

用户明确批准后，macOS/iOS companion 可以通过 EventKit 创建、更新或取消 Apple Calendar
事件。

### 流程

```text
backend 从准确的 authoritative Event version 与 EventHistory snapshot 创建 proposal
-> companion 接收 proposal
-> 用户授予 Calendar permission
-> 用户批准准确参数
-> 再次校验 Event version/snapshot
-> EventKit 执行
-> companion 报告 external identifier 与结果
-> backend 记录同步状态和审计
```

批准必须绑定 proposal ID/version、Event ID/version、snapshot hash、参数 hash、批准人和过期时间。
它不是通用 consent boolean，也不能自动采用之后出现的 pendingChanges。

### 建议新增的数据

```text
Approval
ExternalCalendarCommand
CalendarSyncAttempt
```

### 故障实验

- Calendar permission 被拒绝或撤销。
- 用户重复批准。
- 外部事件已创建，但 acknowledgement 丢失。
- 批准后 Event version 或 snapshot 变化。
- 用户直接在 Apple Calendar 修改或删除事件。
- 离线设备收到过期 proposal。

### 验收

- 没有明确批准就不能写 EventKit。
- 重放 command 不会盲目创建重复事件。
- 过期 Event version/snapshot 必须重新预览和批准。
- 外部状态可以 reconciliation。
- 权威 PostgreSQL Event 与 Apple Calendar 不会被假装成强一致。

## 8. 路线图明确排除的内容

除非真实使用和证据改变优先级，否则不提前加入：

- Multi-Agent swarm 与 GraphRAG。
- Fine-tuning、自定义模型训练或多个 vector database。
- 多个 Calendar provider。
- 自动读取用户完整邮箱。
- 没有明确同步协议的原生移动应用。
- 在测量瓶颈前引入 microservices 或 cache。
