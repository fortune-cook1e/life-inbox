# LifeInbox Backend 学习地图

[English](04-backend-learning-map.en.md)

## 1. 学习目标

这份地图服务于同一个产品，而不是罗列互不相关的 Backend 技术。每项能力都必须回答：

- 它支持哪个用户可见行为？
- 它保护什么数据不变量？
- 怎样先复现没有它时的失败？
- 哪个自动化测试可以独立证明修复？

LifeInbox 通过垂直切片逐步增加能力。V1 先证明全局 Agent chat 到权威 Event 的确定性闭环；
Redis、pgvector、Queue 和模型选择工具都要等产品 Gate 需要时再引入。

## 2. 架构演进

### Canonical 产品与内部模型

普通用户只看到：

```text
Agent      # 一个全局 ChatMessage feed，主要交互
Events     # 只显示 authoritative CONFIRMED/CANCELLED Event
Settings   # 偏好与数据控制
```

内部数据边界：

```text
ChatMessage.caseId is nullable

LifeCase = 一件具体事项
LifeCase 1 -> 0..* immutable InboxItem
LifeCase 1 -> 0..1 Event
Event.caseId is NOT NULL + UNIQUE

Event.status =
  COLLECTING | READY | CONFIRMED | IGNORED | CANCELLED
```

全局 feed 与模型上下文是两个边界。ChatMessage 可以不关联 Case，但每次提取、澄清或 Agent run
都必须解析出一个明确 Case，并构建只包含该 Case 数据的 prompt。

两种创建语义必须分开：

```text
NEW_MATTER = 用户直接表达事项；ChatMessage 是证据，不创建 InboxItem
NEW_SOURCE = 用户提交外部原始材料；先解析一个明确 Case，再保存 immutable InboxItem
```

`InboxItem` 只代表外部材料，不能作为所有 LifeCase 都必须拥有的通用“输入记录”。

### V1

```text
Next.js Agent + Events + Settings
-> NestJS 全局消息与确定性 command 编排
-> internal LifeCase aggregate
   (0..* immutable InboxItem + 0..1 Event + EventHistory)
-> PostgreSQL + Drizzle
-> case-scoped structured LLM extraction
-> deterministic evidence gate + Event state machine + .ics
```

首次候选直接是同一个 Event：信息不足时为 `COLLECTING`，Gate 通过后为 `READY`，用户确认后为
`CONFIRMED`。不需要另一张 draft 表。Events tab 只查询 `CONFIRMED` 与 `CANCELLED`。

### V2

```text
V1
-> authentication + owner scope
-> cross-device global ChatMessage cursors
-> internal Case ownership
-> Event version optimistic concurrency
```

### V3

```text
V2
-> Object Storage
-> Redis Queue
-> same-repository Worker + Scheduler
-> SharedSource + user-confirmed SharedSourceReference
-> transactional Outbox
```

Redis 只承担异步协调，不是产品 Source of Truth。

### V4

```text
PostgreSQL full-text search + pgvector
-> retrieve candidate internal Cases
-> associate new InboxItem or ask one ambiguity question
-> stage Event pendingOperation/pendingChanges/pendingEvidence/pendingStatus
```

### V5

```text
reliable V1-V4 capabilities
-> model-selected bounded read/search/question/proposal tools
-> persisted Agent run, step, tool result, and checkpoint
```

系统保持模块化单体。进程分离不代表服务分离，也不代表独立数据库。

## 3. 能力地图

| Backend 主题         | 产品需求                                                  | 首次引入 | 学习证明                                 |
| -------------------- | --------------------------------------------------------- | -------- | ---------------------------------------- |
| HTTP 语义            | NEW_MATTER/NEW_SOURCE、回答、确认 Event、查询 Events      | V1       | Status code、DTO 与 API Integration Test |
| 全局消息顺序         | 多设备看到同一稳定 Agent feed                             | V1/V2    | 并发插入、Cursor 与重连测试              |
| Case 路由            | ChatMessage 可不关联，但模型调用必须绑定一个内部 Case     | V1       | Case prompt isolation Test               |
| Validation           | blocker 存在时拒绝确认                                    | V1       | 状态依赖的 command 测试                  |
| PostgreSQL Schema    | 具体事项、不可变来源、单一 Event 与历史审计               | V1       | FK、CHECK、UNIQUE(event.caseId)          |
| Drizzle ORM          | 显式表达 Schema、Query 与 Transaction                     | V1.0     | 空库 Migration + 真实 Query Test         |
| Migration            | 不同环境复现 Schema                                       | V1.0     | 全新数据库到达当前版本                   |
| Event 状态机         | `COLLECTING/READY/CONFIRMED/IGNORED/CANCELLED`            | V1       | Transition Table Unit Test               |
| Evidence Gate        | 选择 Draft Progress 或 READY Card                         | V1       | Policy 与 provenance Test                |
| Pending change       | 确认后修改不污染权威 Event                                | V1       | apply/reject 与 snapshot Test            |
| Transaction          | 原子确认、应用 pending change 与写 EventHistory           | V1       | 故障注入后无部分状态                     |
| Concurrency          | 两设备编辑或应用同一 Event                                | V1/V2    | stale Event version 返回 `409`           |
| Idempotency          | 重试来源、回答、确认、apply、导出、Job、提醒              | V1 起    | 重复 command 只有一个逻辑结果            |
| 时间建模             | 预约、date-only deadline 与 DST                           | V1       | 固定时钟和时区切换用例                   |
| Authentication       | 跨设备访问私人数据                                        | V2       | 过期/伪造 Session 安全失败               |
| Authorization        | 用户只能访问自己的消息、内部 Case、来源与 Event           | V2       | Cross-user Integration Test              |
| 文件处理             | 接收截图与 PDF                                            | V3       | 文件类型、大小、内容与 orphan recovery   |
| Queue/Worker         | HTTP 生命周期外解析与提取                                 | V3       | 崩溃、重复投递、用户确认拆分测试         |
| Scheduled Job        | 对权威 Event 提醒                                         | V3       | 重复 scheduler 与 missed-window Test     |
| Transactional Outbox | 可靠触发外部通知                                          | V3       | Commit/dispatch 间崩溃后恢复             |
| Search/Index         | 查找可能属于同一事项的来源                                | V4       | Query plan 与 association evaluation     |
| pgvector             | 语义检索候选内部 Case                                     | V4       | User-scoped vector query 与 recall test  |
| Agent state          | 暂停/恢复受限工具流程                                     | V5       | Restart 与 duplicate-resume Test         |
| Tool authorization   | Agent 只能读、搜索、提问或提议 pending Event change       | V5       | 未知、越权和副作用 Tool 被拒绝           |
| EventKit approval    | 绑定准确 Event version/snapshot 的原生写入                | V7       | Stale approval 与 reconciliation Test    |
| Observability        | 解释 request、message、Case、Event、job、retrieval、Agent | V1 起    | 随异步边界增加 correlation ID            |

## 4. Drizzle 学习路线

### V1.0：配置与 Migration

学习：

- 单一 Drizzle config、PostgreSQL connection 与 pgvector readiness。
- generate、migrate、check 与 test database lifecycle。
- 为什么提交 migration SQL，而不是只依赖 runtime push。

验收：

- 一个配置文件已经足够。
- Migration 可以初始化空数据库。
- 测试使用已提交的 Migration。
- 执行前审查生成 SQL。

### V1.1：核心 Schema 与 Constraint

学习：

- `LifeCase` 只表示一件具体事项，不表示页面、聊天线程或一条来源。
- `InboxItem` 只保存不可变外部材料；直接自然语言事项的 Case 可以拥有零个 InboxItem。
- `ChatMessage` 属于全局 feed，`caseId` 可空；关联后必须引用合法且同 owner 的 Case。
- `Event.caseId` 必须非空且唯一；Case 没有候选行动时通过“不存在 Event row”表达，因此每个
  Case 最多一个 Event。
- Event status 使用受控 enum 和合法 transition。
- Foreign Key、删除行为、`NOT NULL`、`CHECK` 与 evidence-driven index。
- Drizzle relation 与真实数据库 constraint 的区别。

重要原则：

> TypeScript relation 改善 Query 体验；PostgreSQL constraint 保护数据正确性。

- `NEW_MATTER` 在一个短事务中创建 `LifeCase + initiating ChatMessage`；该消息是直接意图的
  evidence，不创建 InboxItem。
- `NEW_SOURCE` 在用户选择一个明确事项后，用一个短事务创建 LifeCase 并保存
  `immutable InboxItem + source ChatMessage`；InboxItem 必须在模型调用前提交。
- 输入类型不明确时先询问，不能静默选择语义。

### V1.1b：同一 Event 的候选状态

学习：

- 首次提取直接插入 Event，并根据 Gate 设置 `COLLECTING` 或 `READY`。
- `COLLECTING` 的 Event 只在 Agent 中投影为 Draft Progress。
- `READY` 的 Event 只在 Agent 中投影为可确认 Card。
- Events query 必须过滤为 `CONFIRMED` 或 `CANCELLED`。
- `READY -> CONFIRMED` 需要显式 command、expected Event version 和再次运行 Gate。
- `COLLECTING/READY -> IGNORED` 是显式放弃，不进入 Events。

### V1.3：Pending change、Transaction 与 Concurrency

确认后的 Event 修改：

```text
authoritative fields remain unchanged
pendingOperation = UPDATE | CANCEL
pendingChanges = validated candidate diff for UPDATE; null for CANCEL
pendingEvidence = candidate field evidence
pendingStatus = COLLECTING | READY
```

学习：

- 写 pending 数据不能覆盖 `CONFIRMED` Event 的权威字段。
- Agent Card 展示 authoritative 与 pending diff；Events 仍只读取权威字段。
- Apply command 校验 `expectedEventVersion` 和当前 pending payload/hash。
- Apply update 在同一事务中写入 apply 前 `EventHistory` snapshot/transition、更新字段、递增
  version、清除 pending 数据。
- Apply cancel 在同一事务中写 snapshot/transition、设置 `CANCELLED`、递增 version 并清除
  pending 数据。
- Reject command 清除 pending 数据并追加 `PENDING_DISCARDED` transition，不改变权威字段。
- 影响零行的 optimistic update 是 conflict，不是成功。
- LLM 和文件 provider 调用不能放入长事务。

### V1.4：准确 Event 的 Calendar 投影

学习：

- `.ics` 只读取准确的 authoritative Event version 或不可变 EventHistory snapshot。
- pendingChanges 不能静默进入导出。
- 历史导出保留它使用的 Event version/snapshot hash。
- Event 后续修改后需要新的显式导出 command。

### V2：Ownership 与全局 Feed

学习：

- ownerId 如何约束 ChatMessage、LifeCase、InboxItem、Event 与 preference query。
- `(createdAt, id)` 或其他稳定 Cursor 如何处理并发插入。
- idempotent message submission 与 cross-device catch-up。
- caseId 关联 command 如何验证 owner 与 expected Case/Event version。
- 构建 prompt 时如何强制只加载一个 Case。

### V3：对 Worker 安全的 Idempotency

学习稳定业务 key、upsert、unique constraint、claim/lease、retry state 和 Outbox。V1 不共享
InboxItem：多事项来源要求用户选择一件事项或分开提交。V3 引入显式 `SharedSource`/
`SharedSourceReference` 后，系统才可提出拆分；只有用户确认后才创建多个 Cases，每个 Case
获得自己的 InboxItem reference，并继续受 `UNIQUE(event.caseId)` 保护。原始 SharedSource
必须在 parser/OCR/model 前持久化；InboxItem 只在 Case 关联明确后创建。SharedSourceReference
记录它对应的 shared file 与准确 page/region。

### V4：Search、Index 与 pgvector

学习 GIN/full-text index、vector column、metadata filter、query plan、`EXPLAIN`、关联候选评测、
embedding version 和 re-index strategy。相似度只产生候选；关联新 InboxItem 需要 policy、
证据、幂等 command，歧义时必须提问。

### V5：Agent proposal 与 Version

Agent tools 可以读取 case-scoped context、搜索用户内部 Cases、写一个问题或提议 Event change。
`propose_event_change` 记录 base Event version 与证据引用；它不能确认 Event、应用 pending 数据
或执行外部副作用。

### V7：EventKit 审批

Approval 必须绑定 Event ID/version、EventHistory snapshot hash、参数 hash、批准人和过期时间。
执行前重新校验，stale approval 失败并要求重新预览。

## 5. 建议的模块边界

随着里程碑逐步引入：

```text
apps/api/src/
├── database/
├── messages/              # global ChatMessage feed, cursor, optional case link
├── cases/                 # internal concrete-matter boundary and prompt scope
├── inbox/                 # NEW_SOURCE only; immutable external raw material
├── events/                # Event state, pending data, EventHistory
├── extraction/            # case-scoped structured extraction + evidence gate
├── calendar/              # authoritative Event -> .ics; V7 EventKit proposals
├── preferences/           # Settings values and accepted defaults
├── auth/                  # V2
├── files/                 # V3 Attachment, SharedSource, SharedSourceReference
├── jobs/                  # V3
├── reminders/             # V3
├── retrieval/             # V4 association/search
└── agent/                 # V5
```

模块负责有意义的产品能力，而不是只对应 class type。不要第一天创建所有目录。

## 6. 错误模型

| 错误类型                | 示例                              | 预期行为                         |
| ----------------------- | --------------------------------- | -------------------------------- |
| Validation              | 不可能日期或非法 pendingOperation | `400`，不写数据                  |
| Not Found               | 内部 Case/Event 不存在            | `404`                            |
| Conflict                | expected Event version 已过期     | `409`，不得覆盖或应用            |
| Idempotency Conflict    | 同一 key 携带不同 payload         | `409`，保留首次结果              |
| Ambiguous Association   | 新来源可能属于两个 Case           | 不关联，在 Agent 提问            |
| Unauthorized            | Session 缺失或过期                | `401`                            |
| Forbidden               | 请求其他用户资源                  | 按防泄漏策略返回 `404` 或 `403`  |
| Temporary Dependency    | Model timeout                     | 保存来源并展示可重试失败         |
| Permanent Input         | 不支持的加密 PDF                  | 展示终止性失败                   |
| Unknown External Result | Calendar/notification 可能已成功  | 重试前 reconciliation            |
| Internal Invariant      | 第二个 Event 使用同一 caseId      | 拒绝、记录 correlation ID 并调查 |

不要把所有错误压成 `500`，也不要自动重试永久错误或业务冲突。

## 7. 测试策略

### Unit Test

- Evidence requirement、FieldProvenance 与 Blocking Gate。
- `COLLECTING/READY/CONFIRMED/IGNORED/CANCELLED` transition table。
- Draft Progress、READY Card 与 Events authoritative projection。
- pending diff validation、apply/reject 规则和 cancellation 规则。
- Case prompt builder 只接收一个 Case 的来源、相关消息、Event 和允许的偏好。
- 时间、时区与 `.ics` escaping。
- Idempotency key 推导和 prompt-independent schema guard。

### PostgreSQL Integration Test

- Drizzle query、FK、relation、CHECK 与 migration。
- `UNIQUE(event.caseId)` 拒绝同一 Case 的第二个 Event。
- `NEW_MATTER` 的 `LifeCase + initiating ChatMessage` 原子创建，且不产生 InboxItem。
- `NEW_SOURCE` 的 `LifeCase + InboxItem + source ChatMessage` 原子创建。
- InboxItem 不可变；global ChatMessage.caseId 可空且 owner 一致。
- 写 pendingChanges 后 authoritative Event 字段完全不变。
- Apply/reject 与 EventHistory snapshot/transition 的原子性。
- stale Event version 的 optimistic update 影响零行。
- Idempotent insert、worker claim 和 Outbox 行为。

Mock Repository 不能替代这些测试。

### API Integration/E2E Test

- 用户在 Agent 写入消息，刷新后 global feed 顺序稳定。
- 两设备并发插入后 Cursor 不漏不重。
- `NEW_MATTER` 先保存 ChatMessage evidence；模型失败不删除该消息或 Case。
- `NEW_SOURCE` 先保存 InboxItem；模型失败不删除来源。
- V1 遇到多事项来源时要求用户选择一件或分开提交，不自动拆 Cases 或共享 InboxItem。
- Case 关联消息触发的模型 prompt 不包含其他 Case 数据。
- blocker 存在时不能确认，Gate 通过后同一个 Event 成为 `READY`。
- 确认后 Events 出现 `CONFIRMED` Event；`COLLECTING/READY/IGNORED` 不出现。
- pending change 只在 Agent review Card 可见，Events 仍显示权威值。
- stale version 的确认或 apply 返回 `409`。
- 取消批准后 Events 显示 authoritative `CANCELLED`。
- Settings preference 的使用保留明确 provenance。

### Worker Integration Test

- 文件 job 从真实 queue 被消费。
- V3 只有在 shared-source reference 存在且用户确认后，才把一个文件拆成多个 Case；每个
  Case 最多一个 Event。
- 原始 SharedSource 先于 parser/OCR/model 持久化；确认拆分前不生成 Case-owned InboxItem。
- Duplicate delivery、worker crash、retry classification 和 terminal failure。
- Reminder 只读取权威 Event，不读取 pendingChanges。

### Failure-injection Test

V1 的最低故障集合：

- `NEW_MATTER` 错误创建 InboxItem，或 `NEW_SOURCE` 未保存外部材料。
- V1 在没有 shared-source model 和用户确认时自动拆分多事项来源。
- 并发插入导致 global feed 顺序不稳定。
- Prompt builder 混入另一个 Case 的 InboxItem。
- 两个事务同时为同一 Case 创建 Event。
- 写 pendingChanges 时错误覆盖 confirmed 字段。
- EventHistory snapshot 写入后、Event update 前事务失败。
- stale Event version 成功确认或应用。
- `.ics` 读取未批准的 pending value。

每个修复都需要能让旧实现失败、让新实现通过的自动化证明。

## 8. 安全演进

### V1：仅限本地

- Secret 不进入 Source Control。
- 日志 Redact 来源、ChatMessage 和 pending data。
- 使用严格输入上限。
- 明确披露通知会发送到配置的模型 provider。
- 审查 provider retention，并隔离开发 credential。

### V2：远程个人产品

- Secure session、CSRF、HTTPS 与 production secret storage。
- 所有 message/Case/Inbox/Event/preference query 强制 owner scope。
- Rate/cost limit、账户删除、显式 migration release 和基础 backup。

### V3：文件

- 校验文件内容而不只看扩展名。
- 私有 Object Storage、短期 Signed URL 和 orphan cleanup。
- 按格式审查 malware/parser risk。

### V4/V5：Retrieval 与 Agent

- InboxItem、文件、retrieved chunk 和 ChatMessage 都是不可信内容。
- Backend tool 强制用户与 case scope。
- Tool allowlist 和严格 parameter schema。
- Agent 只能提议 pending Event change；权威确认、apply 与所有外部副作用需要显式 command。

### V7：EventKit

- Approval 绑定准确 Event version/snapshot 与参数 hash。
- 执行前重新校验授权、版本和过期时间。
- External identifier、idempotency 和 reconciliation 不依赖模型判断。

## 9. Observability 演进

- **V1：** Request ID、ChatMessage ID、internal Case ID、Event ID/version、Extraction Run、latency、
  token、cost、redaction 和 state transition。
- **V2：** User/session、Cursor、sync lag、stale-version conflict。
- **V3：** Job ID、attempt、queue age、retry count、terminal failure 与 scheduler lag。
- **V4：** Association/Retrieval Run、candidate、score、decision、index version。
- **V5：** Agent Run/Step、tool result、stop reason 与 budget。
- **V7：** Approval、External Command、snapshot hash 与 reconciliation outcome。

不要把理解早期故障所需的 ID 和 transition log 推迟到生产加固阶段。

## 10. Performance 演进

1. 记录 baseline。
2. 检查 global feed、Events 和 retrieval query pattern。
3. 使用 `EXPLAIN` 验证 schema/index/query 调整。
4. 检查 connection pool 和 worker concurrency。
5. 只有测量后仍有瓶颈时才增加 cache。
6. 启用 cache 前定义 TTL、invalidation 和 fallback。

PostgreSQL 是权威状态。Redis 故障可以降低吞吐量，但不能改变 ChatMessage、Case、InboxItem、
Event 或 EventHistory 的正确性。

## 11. 应由开发者亲自决定的事项

- Identifier 与 global feed Cursor 策略。
- `NEW_MATTER` 与 `NEW_SOURCE` command 的判定和歧义处理。
- LifeCase 的“具体事项”判断边界和 Case association policy。
- ChatMessage 可选 case 关联以及 case-scoped prompt invariant。
- `0..* InboxItem` 生命周期、外部材料限定、不可变性和删除策略。
- `0..1 Event`、`UNIQUE(event.caseId)` 与 Event status transition。
- `BLOCKING/NON_BLOCKING/OPTIONAL` 和 FieldProvenance 规则。
- pending 区域四个字段的 schema、各操作适用字段、apply/reject 与 EventHistory snapshot 语义。
- Event version optimistic locking 与 idempotency key scope。
- Transaction boundary 和 time semantics。
- Authentication/authorization、retry、file lifecycle 与 reminder guarantee。
- Agent tool permission、retrieval evaluation 和 release threshold。
- EventKit approval 与 reconciliation。

Codex 可以提出选项、失败实验和测试，但这些决定是核心学习证据，不能被悄悄委托。
