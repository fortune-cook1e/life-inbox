# LifeInbox V1 路线图

[English](02-v1-roadmap.en.md)

## 1. V1 成果

LifeInbox V1 是一款以单一 Agent Chat 为入口的个人生活通知产品。

用户不需要先创建 Case、选择表格或理解内部数据模型。他们只需要在同一条全局聊天时间线中：

```text
直接描述一件事项，或粘贴一份外部通知
-> 查看 Agent 当前理解到的内容和证据
-> 每次回答一个阻塞问题
-> 查看 Event Preview Card
-> 明确确认、忽略、更新或取消
-> 在确认后显式导出 .ics
-> 之后通过聊天或 Events 查询权威 Event
```

V1 的产品边界：

- 用户界面最初只有一个全局 `Agent` Chat，以及低显著度的 `Settings` 入口。
- `Events` tab 在确认能力完成后加入。
- `Events` 只查询 `CONFIRMED` 和 `CANCELLED` 的权威 Event。
- `COLLECTING`、`READY`、待澄清问题和待确认更新不进入 Events 列表；它们作为 Chat 中的 resume card 继续处理。
- `LifeCase` 和 `InboxItem` 完全属于内部实现，用户不需要进入 Case 页面。
- 一个 LifeCase 只代表一件具体事项，最多拥有一个 Event。
- V1 每次输入最多处理一件具体事项。检测到多件事项时，系统要求用户拆分或选择，不会在一个 Case 中创建多个 Event。
- 所有外部副作用都需要用户明确操作。

V1 的 Agent 体验由固定、可测试的应用工作流实现：

```text
route intent
-> persist message/optional source/state
-> extract
-> validate evidence
-> run completeness gate
-> ask one question or show one card
-> wait for explicit command
```

模型不能自由选择任意工具、绕过状态机、确认 Event、导出日历或自动修改权威字段。动态 Agent loop 不属于 V1。

## 2. V1 用户界面

### 2.1 Agent：唯一主要工作区

Agent 是默认路由，也是 V1 的主要交互界面。

它包含：

- 一条按 `createdAt, id` 稳定排序的全局聊天时间线。
- 一个用于粘贴通知、回答问题、查询 Event 或提出一般问题的输入框。
- 来源已保存、正在分析、分析失败和可以重试等状态消息。
- `COLLECTING` Event 的 Draft Progress Card。
- `READY` Event 的可确认 Preview Card。
- `CONFIRMED`/`CANCELLED` Event 的只读权威摘要。
- confirmed update/cancel 的 before-after Preview Card。
- 尚未完成事项的 resume card。
- 通往 Settings 的低显著度入口。
- V1.3 之后通往 Events 的 tab。

用户看到的是一条连续聊天，不需要切换到某个 Case 对话。但全局 UI 不等于全局模型上下文：

> UI 按用户展示全局时间线；模型每次只接收当前 LifeCase 的来源、消息、Event、待处理问题和允许使用的偏好。

不同事项的日期、地点和澄清回答不能因为显示在同一页面而进入彼此的模型上下文。

硬性不变量：

```text
GLOBAL_CHAT_UI != GLOBAL_PROMPT_CONTEXT

领域提取、澄清、更新或取消的每次模型调用
=> 恰好绑定一个 target caseId
=> 只加载该 Case 的 InboxItem、相关 ChatMessage、Event、PendingQuestion 和允许的偏好

GENERAL / EVENT_QUERY routing
=> 可以没有 caseId
=> 不自动携带全局 transcript

禁止把整条全局 Chat 时间线直接发送给模型
```

### 2.2 Chat 中的卡片状态

同一个 Event 根据状态投影为不同卡片，不引入独立的 Event draft 实体：

```text
Event.COLLECTING
-> Draft Progress Card
-> 展示已有字段、证据、warning 和唯一活跃问题
-> 不允许 Confirm

Event.READY
-> Event Preview Card
-> 展示完整候选值、证据和非阻塞 warning
-> 允许 Edit、Ignore、Confirm

Event.CONFIRMED
-> Authoritative Event Card
-> 展示已经确认的正式字段
-> 允许 Export .ics、Propose update、Propose cancellation

Event.CONFIRMED + pendingOperation
-> Before-after Preview Card
-> 正式字段保持不变
-> 待变更内容只显示在 proposed 一侧

Event.IGNORED
-> 在聊天中显示已忽略结果

Event.CANCELLED
-> 在聊天和 Events 中显示已取消的权威 Event
```

自然语言消息只负责解释和引导。Card 的数据必须来自结构化 Event store，不能通过重新解析 Assistant 文本恢复。

### 2.3 Events：确认后的查询视图

Events tab 到 V1.3 才出现，因为在确认能力之前不存在可查询的权威 Event。

它只读取：

```text
Event.status IN (CONFIRMED, CANCELLED)
```

它不读取 Chat transcript 来猜测 Event，也不显示：

- `COLLECTING`。
- `READY`。
- `IGNORED`。
- 尚未确认的 `pendingChanges`。
- `NO_ACTION` 的内部 Case。

建议的 V1 Events 体验：

- 按日期或最近更新排序。
- 搜索标题、地点和日期。
- 筛选 `Confirmed` 与 `Cancelled`。
- 展示 Calendar export 状态。
- 当 confirmed Event 存在未完成的 pending operation 时，只显示 `Update pending` 或 `Cancellation pending` badge，并跳回 Chat 中对应 resume card；Events 中仍只展示正式字段。

Events 是查询视图，不是第二套权威状态，也不需要暴露数据库式表格。

### 2.4 Settings：低显著度偏好

V1 Settings 包含：

- 默认时区。
- 默认预约时长。
- 默认提醒提前量。
- Agent 回复的首选语言。

偏好只能提出候选值。补齐阻塞字段的默认值必须先在 Chat/Card 中展示，用户接受后才能标记为 `DEFAULT_ACCEPTED`。

## 3. 固定 Intent Router

V1 Router 只识别五种顶层 intent：

```text
NEW_MATTER
NEW_SOURCE
CLARIFICATION_ANSWER
EVENT_QUERY
GENERAL
```

### NEW_MATTER

用户直接表达一件生活事项，例如“提醒我后天洗衣”。系统创建内部 LifeCase，并把用户 ChatMessage 作为 `PROVIDED_BY_USER` evidence；它不创建 InboxItem。

### NEW_SOURCE

用户提交一份新的外部通知。系统创建或明确选择内部 LifeCase，保存不可变 InboxItem，然后执行提取。

### CLARIFICATION_ANSWER

用户回答一个结构化 `PendingQuestion`。该消息必须通过 `replyToMessageId` 绑定问题对应的 Assistant message；Backend 再验证该问题仍处于 `OPEN`。

### EVENT_QUERY

用户查询已经确认或取消的 Event。系统可以把自然语言解析成受限 Query DTO，但最终只查询 Event store：

```text
status IN (CONFIRMED, CANCELLED)
```

禁止通过搜索或重新解释 Chat 文本构造权威结果。

### GENERAL

帮助、产品说明或不需要修改领域状态的一般对话。它可以保存为 `caseId = null` 的 ChatMessage，但不能创建 InboxItem、Event 或外部副作用。

### Router 不确定时

- 不在两个写入 intent 之间猜测。
- 优先询问用户是在直接创建事项、提交外部通知、回答当前问题，还是查询已有 Event。
- 只有显式 `replyToMessageId` 能把消息作为某个 PendingQuestion 的回答消费。
- 自动把任意新来源匹配为历史 Event 的更新或取消，可以延后；V1 不得因相似文本静默修改历史 Event。

## 4. V1 架构

```text
Next.js Web
    |-- Agent
    |-- Events       # V1.3 起
    `-- Settings
          |
          | HTTP
          v
NestJS 模块化单体
    |-- chat
    |-- routing
    |-- cases        # internal
    |-- inbox        # internal immutable sources
    |-- extraction
    |-- events
    |-- calendar-export
    `-- preferences
          |
          |-- PostgreSQL through Drizzle ORM
          |-- one LLM provider
          `-- deterministic gates and .ics generator
```

这些模块名称和后文 API 都是候选实现边界，不表示 Backend 已经存在对应接口。

V1 在运行时不依赖 Redis、Object Storage、pgvector 或 Agent framework。LLM 调用不得放在长时间数据库事务中。

### 4.1 整体数据流图

```text
                         GLOBAL CHAT UI
                               |
                               v
                         ChatMessage input
                               |
                               v
                      Fixed Intent Router
          +--------------------+--------------------+
          |                    |                    |
 NEW_MATTER / NEW_SOURCE  CLARIFICATION_ANSWER     EVENT_QUERY / GENERAL
          |                    |                    |
          v                    v                    +--> Event store query
   Internal LifeCase     PendingQuestion                 status in
          |              replyTo binding             CONFIRMED/CANCELLED
          +-- NEW_SOURCE only                         |
          |      `--> immutable InboxItem             +--> Chat result
          |                    |                      +--> Events tab
          v                    v
   ExtractionRun       same internal Event
          |                    |
          +---------+----------+
                    |
                    v
             Event (0..1 / Case)
          COLLECTING <-> READY
                    |
              explicit Confirm
                    |
                    v
               CONFIRMED
                    |
           +--------+---------+
           |                  |
   Chat cards/resume     Events authoritative query

Model context builder
  -> receives one explicit target caseId
  -> loads only that Case aggregate
  -> never receives the global Chat transcript by default
```

这张图描述两个独立维度：

- Chat timeline 是用户级的全局读取模型。
- Domain mutation 与模型上下文始终绑定一个内部 LifeCase。

## 5. V1 领域模型

只有在对应里程碑开始时才创建实体和字段。

### 5.1 LifeCase：内部事项边界

`LifeCase` 表示一件具体生活事项，不是用户界面中的页面或对话频道。`LifeCase` 是领域与实现中的正式名称，本文在语义明确时简称 `Case`：

```text
id
status: OPEN | CLOSED
resolution:
  EVENT_CONFIRMED
  EVENT_IGNORED
  NO_ACTION
  EVENT_CANCELLED
  null
createdAt
updatedAt
version
```

聚合基数：

```text
User-global timeline
  |
  `-- 0..* ChatMessage
        `-- caseId? ---------------------------+
                                                  |
                                                  v
LifeCase (internal, one concrete matter) <---------+
  |-- 0..* immutable InboxItem
  |-- 0..* case-bound ChatMessage
  |-- 0..* PendingQuestion
  |-- 0..* ExtractionRun
  `-- 0..1 Event
        |-- 0..* EventFieldEvidence
        |-- 0..* EventHistory
        `-- 0..* CalendarExport

Event pendingOperation
  |-- pendingChanges
  |-- pendingEvidence
  `-- pendingStatus

UserPreference
  `-- user-scoped, read-only candidate input to a Case workflow
```

数据库必须具有：

```text
UNIQUE(event.caseId)
```

Case 规则：

- 直接表达的事项可以没有 InboxItem；其用户 ChatMessage 是结构化 evidence 的来源。
- 新事项在提取与澄清期间为 `OPEN`。
- 初始 Event 被确认、忽略，或结果被确定为 `NO_ACTION` 后，Case 变为 `CLOSED` 并保存 resolution。
- 对已确认 Event 开始显式 update/cancel 时，可在同一事务中将 Case 重新设为 `OPEN` 并清空 resolution。
- pending update 应用或丢弃后，Case 回到 `CLOSED + EVENT_CONFIRMED`。
- cancellation 确认后，Case 进入 `CLOSED + EVENT_CANCELLED`。
- Case status 不替代 Event status，也不在 UI 中作为用户筛选项。

### 5.2 InboxItem：不可变外部来源

`InboxItem` 表示从产品外部进入的来源，不代表每一条用户聊天消息：

```text
id
caseId
submittedByMessageId
rawText
contentHash
sourceType: PASTED_TEXT
sourceReceivedAt
referenceDate
referenceDateSource:
  NOTICE_METADATA
  USER_PROVIDED
  SUBMISSION_TIME
createdAt
```

规则：

- `rawText` 保存后不可修改。
- 一个 Case 可以拥有多份 InboxItem，用于以后显式附加同一事项的更新或取消通知。
- 只有 `NEW_SOURCE` 创建 InboxItem。
- `NEW_MATTER`、`CLARIFICATION_ANSWER`、`EVENT_QUERY` 和 `GENERAL` 不创建 InboxItem。
- 例如“提醒我后天洗衣”只创建 Case、ChatMessage 和后续 Event；该 ChatMessage 是 `PROVIDED_BY_USER` evidence。
- `contentHash` 用于 duplicate warning，不是 Idempotency Key，也默认不唯一。
- 相同文本可能是两条真实来源；网络重试由 command/client identifier 处理。
- 先持久化来源，之后才能调用模型。
- `NEW_MATTER` 中的相对日期可以使用用户时区下的 `ChatMessage.createdAt` 作为请求锚点；`NEW_SOURCE` 中的相对日期必须使用 InboxItem 的可信 referenceDate，不能把粘贴时间假装成旧通知的接收时间。

### 5.3 ChatMessage：全局时间线

```text
id
caseId?                 # nullable
role: USER | ASSISTANT | SYSTEM
kind:
  USER_TEXT
  SOURCE_SUBMITTED
  CLARIFICATION_QUESTION
  CLARIFICATION_ANSWER
  EVENT_EDIT
  DRAFT_PROGRESS
  EVENT_PREVIEW
  EVENT_CONFIRMED
  EVENT_UPDATE_PREVIEW
  EVENT_CANCELLATION_PREVIEW
  EVENT_QUERY_RESULT
  STATUS
content
replyToMessageId?
clientMessageId?
referenceType:
  INBOX_ITEM
  PENDING_QUESTION
  EXTRACTION_RUN
  EVENT
  EVENT_HISTORY
  CALENDAR_EXPORT
  null
referenceId?
referenceVersion?
createdAt
```

规则：

- UI 按用户读取全局 ChatMessage，而不是进入 Case-specific transcript。
- `caseId = null` 适用于 GENERAL、未绑定具体 Event 的 EVENT_QUERY 和全局系统消息。
- 与来源、澄清、Event mutation 有关的 message 必须绑定内部 caseId。
- Card 的结构化数据来自所引用的 Event/EventHistory，不复制进 message 文本作为第二份权威数据。
- Message 不保存隐藏 chain-of-thought。
- Assistant message 不能单独改变领域状态；状态变化必须来自 Backend command。
- 全局时间线分页使用稳定 cursor，例如 `(createdAt, id)`。

### 5.4 PendingQuestion：唯一活跃阻塞问题

```text
id
caseId
eventId?
assistantMessageId
kind: FIELD_CLARIFICATION | MATTER_SELECTION
fieldKey?
status: OPEN | ANSWERED | SUPERSEDED | CANCELLED
expectedEventVersion?
answeredByMessageId?
createdAt
answeredAt?
```

约束与规则：

- 每个 Case 同一时刻最多一个 `OPEN` PendingQuestion。
- 字段问题必须指出目标 Event 和 field。
- 用户回答必须通过 `replyToMessageId` 对应到 `assistantMessageId`。
- Backend 验证问题仍为 `OPEN`，并在适用时验证 `expectedEventVersion`。
- 一个回答 command 最多消费一次。
- Gate 重新运行后，旧问题应变为 `ANSWERED` 或 `SUPERSEDED`，然后才能创建下一个问题。

### 5.5 ExtractionRun：一次模型尝试

```text
id
caseId
inboxItemId?
triggerMessageId
purpose:
  MATTER_EXTRACTION
  SOURCE_EXTRACTION
  CLARIFICATION_NORMALIZATION
  UPDATE_EXTRACTION
  CANCELLATION_EXTRACTION
model
promptVersion
status: RUNNING | SUCCEEDED | FAILED | ABANDONED
structuredOutput
errorCode?
latencyMs?
inputTokens?
outputTokens?
estimatedCost?
startedAt
completedAt?
```

规则：

- 每次 Retry 创建新的 ExtractionRun。
- 过期 `RUNNING` 可以被标为 `ABANDONED` 后重试。
- Run 失败不能删除 ChatMessage、InboxItem、Case、Event 或用户回答。
- Prompt/model version 和成本信息必须可追踪。

### 5.6 Event：唯一当前工作对象

`Event` 同时承载未确认候选和已确认权威数据，不创建独立 EventDraft：

```text
id
caseId
type: APPOINTMENT | DEADLINE | REMINDER
status:
  COLLECTING
  READY
  CONFIRMED
  IGNORED
  CANCELLED
title
temporalData
location?
nextAction?
version
confirmedAt?
cancelledAt?

pendingOperation: UPDATE | CANCEL | null
pendingChanges?
pendingEvidence?
pendingStatus: COLLECTING | READY | null

createdAt
updatedAt

UNIQUE(caseId)
```

时间语义：

```text
APPOINTMENT:
  startAt
  endAt
  timeZone

DEADLINE:
  dueDate
  dueAt?
  timeZone?

REMINDER:
  remindOn
  remindAt?
  timeZone?
```

`startAt`、`endAt` 和 `dueAt` 是 instant；`dueDate` 和 `remindOn` 是 date-only。不得用午夜 UTC 假装两者相同。

初始候选规则：

- 提取产生一个 Event，状态由 gate 决定为 `COLLECTING` 或 `READY`。
- 在 `COLLECTING`/`READY` 时，用户或澄清流程直接编辑同一条 Event，并执行 `version++`。
- 编辑后重新运行 gate，状态可以在 `COLLECTING` 与 `READY` 之间转换。
- 不为每次编辑创建活跃 revision 对象。
- `READY -> CONFIRMED` 必须由显式确认 command 完成。
- `COLLECTING` 或 `READY` 可以显式进入 `IGNORED`。

已确认变更规则：

- `CONFIRMED` Event 的正式字段不能被提议直接覆盖。
- update 候选写入全部四个 pending 字段；cancel 候选没有拟议字段差异，只写 `pendingOperation`、`pendingEvidence` 和 `pendingStatus`，并保持 `pendingChanges` 为空。
- 存在 pending operation 时，`Event.status` 仍保持 `CONFIRMED`。
- 查询和 `.ics` 只读取正式字段，不读取 pendingChanges。
- pending update 通过 gate 后，Chat 展示 before-after Preview。
- 用户确认 update 时，在一个事务中应用 pendingChanges、替换对应正式 evidence、清空全部 pending 字段并执行 `version++`；Event 仍为 `CONFIRMED`。
- 用户确认 cancellation 时，在一个事务中把状态改为 `CANCELLED`、清空 pending 字段并执行 `version++`。
- 用户丢弃 pending operation 时，只清空 pending 字段，正式 Event 保持不变。
- `CANCELLED` 在 V1 中是权威终止状态；重新启用需要未来显式设计。

pending 字段一致性：

```text
pendingOperation IS NULL
<=> pendingChanges IS NULL
    AND pendingEvidence IS NULL
    AND pendingStatus IS NULL

pendingOperation == UPDATE
=> pendingChanges 保存拟议字段差异

pendingOperation == CANCEL
=> pendingChanges IS NULL

pendingStatus == READY
=> pending operation 的 blocking gate 已通过

Event.status == CANCELLED
=> 不存在 pending operation
```

### 5.7 EventFieldEvidence：当前正式/候选字段依据

```text
id
eventId
eventVersion
fieldKey
fieldValueHash
requirement: BLOCKING | NON_BLOCKING | OPTIONAL
evidenceState:
  SUPPORTED_BY_SOURCE
  PROVIDED_BY_USER
  DEFAULT_ACCEPTED
  MISSING
  CONFLICTING
sourceType:
  INBOX_ITEM
  CHAT_MESSAGE
  USER_PREFERENCE
  null
sourceId?
startOffset?
endOffset?
quote?
createdAt
```

规则：

- `SUPPORTED_BY_SOURCE` 必须定位到 immutable InboxItem。
- `PROVIDED_BY_USER` 必须定位到用户 ChatMessage。
- 显式 Card edit command 必须在同一事务中追加一条绑定当前 Case 的 `EVENT_EDIT` 用户 ChatMessage，字段证据引用该消息。
- `DEFAULT_ACCEPTED` 必须定位到用户已明确接受的 UserPreference 值。
- `MISSING` 和 `CONFLICTING` 不能通过 blocking gate。
- 模型 confidence 不是 evidence state。
- 初始未确认 Event 可以直接更新当前 evidence。
- confirmed Event 的正式 evidence 保持不变；update 的候选字段 evidence，或 cancel 的操作级证据与原因，先放在 `pendingEvidence`。
- update 确认时，把 pendingEvidence 原子地物化为新 eventVersion 的 EventFieldEvidence。
- EventHistory 保存应用前后的 evidence snapshot，供审计使用。

### 5.8 EventHistory：重要转换的 append-only snapshot

`EventHistory` 记录确认、已应用更新、丢弃 pending operation、忽略和取消等重要转换，但不作为活跃 draft：

```text
id
eventId
eventVersion
operation:
  CONFIRMED
  IGNORED
  UPDATE_APPLIED
  PENDING_DISCARDED
  CANCELLED
fromStatus
toStatus
beforeSnapshot?
afterSnapshot?
pendingSnapshot?
evidenceSnapshot?
actor: USER | SYSTEM
commandId
idempotencyKey?
createdAt
```

规则：

- Event 当前行是当前状态的权威来源。
- History 是 append-only 的 transition snapshot。
- Confirm、ignore、update apply、pending discard 和 cancellation 必须在同一事务中同时更新 Event、写入 EventHistory 和追加状态 ChatMessage。
- History 不能被当成当前 draft 继续编辑。
- `beforeSnapshot`/`afterSnapshot` 使用户可以解释“确认了什么”和“更新前后改变了什么”。

### 5.9 CalendarExport：明确且幂等的文件导出

V1 不需要中间 CalendarDraft：

```text
id
eventId
eventVersion
stableUid
sequence
eventSnapshot
contentHash
idempotencyKey
exportedAt

UNIQUE(idempotencyKey)
```

规则：

- 普通 `.ics` 导出只允许 `Event.status == CONFIRMED`。
- 导出读取当前正式 Event 和正式 evidence，不读取 pendingChanges。
- `.ics` 由确定性 application code 生成，不由模型生成。
- 同一个 idempotency key 重试时返回同一记录和相同 bytes。
- 同一个 Event 的后续已确认更新复用 stable UID，并一致增加 sequence。
- `CANCELLED` 仍可在 Events 中查询；生成 Calendar cancellation 文件不自动包含在 V1，除非单独定义并验证 Apple Calendar 行为。
- LifeInbox 只能证明文件已生成，不能声称 Apple Calendar 已导入。

### 5.10 UserPreference

```text
id
ownerKey
defaultTimeZone
defaultAppointmentDurationMinutes
defaultReminderLeadMinutes
preferredLanguage
createdAt
updatedAt
version
```

V1 可以使用单一本地 ownerKey。偏好是候选来源，不会自动成为已确认 Event 字段。

## 6. 确定性完整性 Gate

Backend 在以下时点运行同一套 gate：

- 初始提取后。
- 每次澄清或直接编辑后。
- 将 Event 显示为 READY Preview 前。
- 接受初始 Confirm command 时。
- pending update/cancel 进入 READY 前。
- 接受 pending operation Confirm command 时。
- 导出 `.ics` 前。

Frontend 按钮不是安全边界。

### 6.1 通用规则

- Event type 与非空 title 必须存在。
- 所有 blocking 字段必须是 `SUPPORTED_BY_SOURCE`、`PROVIDED_BY_USER` 或 `DEFAULT_ACCEPTED`。
- blocking `MISSING` 或 `CONFLICTING` 不能通过。
- 字段通过类型、范围、时区和跨字段 Validation。
- pending operation 使用独立 gate，不会借用正式字段掩盖待变更中的 blocker。
- Confirm 时必须重新读取当前 Event 并重新计算，不信任客户端提交的 `ready=true`。

### 6.2 类型规则

```text
APPOINTMENT
  blocking:
    date + start time
    timeZone
    end time 或用户接受的 default duration
  normally non-blocking:
    location
    nextAction

DEADLINE
  blocking:
    dueDate
  if precise time is present:
    dueAt + timeZone must be valid
  normally non-blocking:
    nextAction

REMINDER
  blocking:
    remindOn
  normally non-blocking:
    remindAt
    location
```

当 location 冲突或没有 location 就无法执行事项时，策略可以把它提升为 blocking，但该规则必须确定性且可测试。

### 6.3 一次只问一个问题

固定优先级：

```text
可信 referenceDate
-> matter selection
-> Event type conflict
-> date / dueDate / remindOn
-> start time
-> end time or default-duration acceptance
-> timeZone
-> 其他 blocking conflict
```

每次 gate 运行后：

- 没有 blocker：Event 或 pendingStatus 进入 `READY`。
- 有 blocker：只创建一个 OPEN PendingQuestion。
- 非阻塞缺失只显示 warning，不继续追问。
- 新答案使问题失效时，旧问题标记 `SUPERSEDED`。

## 7. 一次输入只处理一件事项

模型输出不是 `events[]`，而是单一结果：

```text
outcome:
  EVENT
  NO_ACTION
  MULTIPLE_MATTERS

operationHint:
  CREATE
  UPDATE
  CANCEL
  null

event?
noActionReason?
noActionEvidence?
mattersSummary?
relatedEventHint?
warnings
```

硬性不变量：

```text
EVENT
=> event 存在
=> 当前 Case 不得已经拥有另一条 Event

NO_ACTION
=> event 为空
=> reason 与可验证 evidence 存在

MULTIPLE_MATTERS
=> event 为空
=> mattersSummary 至少包含两个可区分事项
```

遇到 `MULTIPLE_MATTERS`：

- 不创建多个 Event。
- 不把多个事项压缩成一个 Event。
- 创建 `MATTER_SELECTION` PendingQuestion。
- 请用户选择当前 Case 要继续处理的一个事项，或把通知拆成多次输入。
- 选择后当前 Case 最多创建一个 Event；其余事项需要独立提交。

`operationHint` 和 `relatedEventHint` 为未来自动识别历史更新/取消预留结构。V1 可以展示提示或要求用户显式选择 Event，但不能自动修改匹配到的历史 Event。

## 8. 完整数据流

### 8.1 新事项或新来源：先保存，再调用模型

最终 V1 流程：

```text
POST ChatMessage(intent=NEW_MATTER | NEW_SOURCE, clientMessageId)
-> validate size and input
-> short transaction:
   - idempotently save USER ChatMessage
   - create or explicitly reopen/select one internal LifeCase
   - NEW_SOURCE only: save immutable InboxItem
   - create RUNNING ExtractionRun
   - link all identifiers
-> commit
-> call LLM with timeout outside transaction
-> validate structured schema and source/message evidence
-> short transaction:
   - mark ExtractionRun SUCCEEDED
   - EVENT:
       create the Case's only Event as COLLECTING or READY
       save EventFieldEvidence
       create one PendingQuestion or EVENT_PREVIEW Assistant ChatMessage
   - NO_ACTION:
       close Case with NO_ACTION
       append result Assistant ChatMessage
   - MULTIPLE_MATTERS:
       create MATTER_SELECTION PendingQuestion
       append one Assistant question
-> commit
```

如果 provider、schema 或 evidence validation 失败：

```text
-> mark ExtractionRun FAILED in a short transaction
-> keep case, user message, and optional source
-> append recoverable error + Retry message
```

直接事项和首个外部来源通常创建新 Case；用户从某个 confirmed Event 的显式 Update/Cancel 操作进入时，新的外部来源附加到该 Event 已有的 Case，并在事务中把 Case 重新打开。

### 8.2 澄清回答：replyTo 绑定 PendingQuestion

```text
POST ChatMessage(
  intent=CLARIFICATION_ANSWER,
  replyToMessageId,
  clientMessageId,
  expectedEventVersion
)
-> resolve replyToMessageId -> OPEN PendingQuestion
-> reject if question is answered/superseded or Case mismatch
-> idempotently save user answer
-> if normalization needs LLM:
   create ExtractionRun and commit before provider call
-> normalize and validate answer outside long transaction
-> short transaction:
   - recheck PendingQuestion and expected Event version
   - update the same Event or its pending fields
   - version++
   - save evidence
   - mark question ANSWERED
   - rerun gate
   - create at most one next PendingQuestion
   - append Draft Progress or Preview Assistant message
-> commit
```

过期回答返回 `409`，不得应用到新的 Event version。

### 8.3 未确认 Event 编辑

```text
PATCH Event(eventId, expectedVersion, changes)
-> require status COLLECTING or READY
-> require expectedVersion == Event.version
-> validate command and user evidence
-> in the same transaction append case-bound EVENT_EDIT user ChatMessage
-> conditional update same Event row
-> replace affected EventFieldEvidence
-> version++
-> rerun gate
-> COLLECTING or READY
-> supersede obsolete question
-> append progress/preview ChatMessage
```

不存在独立 draft/revision 记录。

`EVENT_EDIT` ChatMessage、Event mutation、受影响的 EventFieldEvidence 和新的 version 必须在同一事务中提交。

### 8.4 初始确认

```text
POST Confirm(eventId, expectedVersion, idempotencyKey)
-> short transaction
-> load Event and Case
-> require Event.status == READY
-> require expectedVersion == Event.version
-> rerun completeness and evidence gate
-> conditional READY -> CONFIRMED
-> version++
-> close Case with EVENT_CONFIRMED
-> append EventHistory before/after snapshot
-> append EVENT_CONFIRMED ChatMessage
-> commit
```

确认不导出 `.ics`，也不创建外部日历事件。

重复 command 返回原结果；相同 Idempotency Key 携带不同 payload 时返回冲突。

### 8.5 忽略

```text
POST Ignore(eventId, expectedVersion)
-> require COLLECTING or READY
-> require expectedVersion == Event.version
-> conditional -> IGNORED
-> version++
-> close Case with EVENT_IGNORED
-> append EventHistory + ChatMessage
```

`IGNORED` 不进入 Events tab。

### 8.6 Event 查询

```text
Chat intent EVENT_QUERY
-> parse bounded filters
-> validate filter schema
-> query Event table only
-> WHERE status IN (CONFIRMED, CANCELLED)
-> append EVENT_QUERY_RESULT ChatMessage
```

Query 不读取 InboxItem、Assistant prose 或 pendingChanges 来重新推断当前权威 Event。

### 8.7 Confirmed update：before-after，再应用

V1 可以先支持从 Event Card 明确发起 update。任意新来源自动匹配历史 Event 的路由可以延后。

```text
Start update(eventId, expectedVersion, optional new source)
-> require Event.status == CONFIRMED
-> require expectedVersion == Event.version
-> if source exists, append immutable InboxItem to same Case
-> reopen Case
-> set:
   pendingOperation = UPDATE
   pendingChanges
   pendingEvidence
   pendingStatus = COLLECTING or READY
-> when values come from a Card edit, append case-bound EVENT_EDIT user ChatMessage in the same transaction
-> version++
-> ask one question or show before-after Preview in Chat
```

Before-after Card：

```text
Before = Event authoritative fields
After  = authoritative fields overlaid with pendingChanges
```

确认：

```text
POST ConfirmPending(eventId, expectedVersion, idempotencyKey)
-> require status CONFIRMED
-> require expectedVersion == Event.version
-> require pendingOperation UPDATE
-> require pendingStatus READY
-> rerun pending gate
-> atomically:
   capture before snapshot
   apply pendingChanges to official fields
   materialize pendingEvidence
   clear all pending fields
   version++
   close Case with EVENT_CONFIRMED
   append UPDATE_APPLIED EventHistory before/after
   append Assistant ChatMessage
```

正式字段在最后事务提交前保持不变。

### 8.8 Confirmed cancellation：before-after，再取消

```text
Start cancellation(eventId, expectedVersion, optional new source)
-> require status CONFIRMED
-> require expectedVersion == Event.version
-> attach source to same Case when present
-> reopen Case
-> pendingOperation = CANCEL
-> pendingChanges = null
-> pendingEvidence = source or explicit user evidence, including cancellation reason when present
-> pendingStatus = COLLECTING or READY
-> when cancellation is stated directly, append case-bound EVENT_EDIT user ChatMessage in the same transaction
-> version++
-> show cancellation Preview
```

确认：

```text
POST ConfirmPending(eventId, expectedVersion, idempotencyKey)
-> require expectedVersion == Event.version
-> require pendingOperation CANCEL and pendingStatus READY
-> rerun pending gate
-> atomically:
   capture before snapshot
   Event.status = CANCELLED
   clear pending fields
   version++
   close Case with EVENT_CANCELLED
   append CANCELLED EventHistory
   append Assistant ChatMessage
```

取消 LifeInbox Event 不等于删除或取消 Apple Calendar 中已经导入的 Event。V1 必须如实说明这一外部边界。
取消原因显示自 `pendingEvidence`，但不作为不存在于正式 Event schema 的拟议字段写入 `pendingChanges`。

### 8.9 丢弃候选更新或取消

用户拒绝候选更新或取消时，两个操作走同一个通用命令：

```text
POST DiscardPending(eventId, expectedVersion, idempotencyKey)
-> require Event.status == CONFIRMED
-> require pendingOperation != null
-> require expectedVersion == Event.version
-> atomically:
   capture pendingOperation, pendingChanges, and pendingEvidence snapshot
   clear all pending fields
   version++
   close Case with EVENT_CONFIRMED
   append PENDING_DISCARDED EventHistory with pending snapshot
   append Assistant ChatMessage
```

丢弃不会应用任何候选值，也不会把 cancellation 误记为已经发生；重复 command 返回第一次的结果。

### 8.10 显式且幂等的 `.ics` 导出

```text
POST ExportIcs(eventId, expectedVersion, idempotencyKey)
-> require Event.status == CONFIRMED
-> require expectedVersion == Event.version
-> require no unaccepted official-field mutation
-> validate current authoritative event
-> deterministically generate bytes
-> insert CalendarExport(eventVersion, snapshot, hash, UID, sequence)
-> return text/calendar
```

同一 command 的重试返回相同文件。confirmed update 应用后可以主动再次导出，新导出使用新 eventVersion 和递增 sequence。

### 8.11 Retry 与恢复

- Capture transaction 失败：message、case、optional inbox、run 全部不留下部分状态。
- LLM 失败：来源和用户消息保留，run 标为 `FAILED`。
- Retry：创建新 run，不创建第二个 Event；`UNIQUE(event.caseId)` 是最后保护。
- 进程崩溃：过期 `RUNNING` 标为 `ABANDONED` 后再 retry。
- 重复 Chat submit：用 clientMessageId 返回原结果。
- 重复 command：用 idempotency key 返回原结果。
- 旧 Event version：返回 `409` 和当前 version。
- 旧 PendingQuestion：拒绝消费，不把回答应用到其他字段。
- 日志默认不包含完整来源、聊天内容、secret 或 `.ics` 正文。

## 9. 里程碑 V1.0：工程基线与 Drizzle

### 产品成果

Web 和 API 能连接 PostgreSQL 启动，Migration 可复现，并且真实数据库测试能够通过。

### 实现

- 核实现有 Next.js 与 NestJS 应用。
- 使用 `drizzle-orm`、`drizzle-kit` 和 `pg`。
- 只维护一个 `drizzle.config.ts`。
- 在 API 内建立 `src/database` 边界。
- 提交版本化 Migration。
- 分离开发和测试数据库。
- 添加真实 PostgreSQL Integration Test。
- 为 lint、test 和 build 添加 CI。

### 验收标准

- Migration 能初始化空数据库。
- 测试与开发使用同一 Migration 历史。
- 数据库不可用时错误清楚可见。
- 至少一项测试通过真实 Drizzle 连接执行 `SELECT 1`。
- 没有 TypeORM dependency/import。
- 启动 V1 不需要 Redis。

## 10. 里程碑 V1.1：Global Chat Capture 与内部 Case

### 产品成果

用户在单一 Agent Chat 中直接描述事项或提交一份外部来源；刷新后仍能在同一全局时间线看到原消息和已保存状态，但不会看到 Case 页面或 Cases tab。

### 实现

- 建立全局 Chat 时间线与稳定分页。
- 创建内部 LifeCase、绑定 Case 的 ChatMessage，并只为外部材料创建 immutable InboxItem。
- 在一个短事务中原子保存 capture 数据。
- GENERAL message 使用 nullable caseId。
- 添加 duplicate-content warning。
- 建立低显著度 Settings 入口。
- 此阶段不显示 Events tab，也不调用 LLM。

候选 API：

```text
POST /chat/messages
GET  /chat/messages
GET  /settings
PATCH /settings
```

### 故障实验

- 空白或超限来源。
- 事务在 message/case/optional inbox 之间失败。
- 相同 clientMessageId 重试。
- 两份相同来源文本。
- 多条消息具有相同 createdAt。

### 验收标准

- 非法输入返回 `400` 且没有部分写入。
- 直接事项 capture 创建一个内部 Case 和一个 ChatMessage，不创建 InboxItem。
- 外部来源 capture 额外创建一个 InboxItem，且其原文与输入逐字一致。
- UI 不出现 Case/Cases 导航。
- 全局时间线排序确定。
- Refresh 不需要解析 Assistant prose 恢复来源状态。
- 真实 PostgreSQL Integration Test 覆盖 capture 和 timeline。

## 11. 里程碑 V1.1b：手工 Event Progress 与 Preview

### 产品成果

在没有模型的情况下，开发者可以在 Chat 中手工创建一个 Event；不完整时显示 Draft Progress，完整时同一 Event 变为 READY Preview。

### 实现

- 为每个 Case 最多创建一个 Event。
- 添加 `UNIQUE(event.caseId)`。
- 实现 `COLLECTING <-> READY`。
- 直接编辑同一 Event 并 version++。
- 添加 EventFieldEvidence。
- 实现 deterministic completeness gate。
- 添加 PendingQuestion 和每 Case 一个 OPEN 问题约束。
- Card 只是 Event 投影。
- 此阶段不实现 Confirm，也不显示 Events tab。

### 故障实验

- 同一 Case 创建第二个 Event。
- 不完整 Event 被错误标为 READY。
- 旧 expectedVersion 编辑。
- 无效时区或 `endAt <= startAt`。
- blocking evidence 为 MISSING 但出现 Confirm。

### 验收标准

- 数据库拒绝一 Case 多 Event。
- COLLECTING 无 Confirm。
- Gate 通过后同一行转为 READY。
- 编辑不创建独立 draft/revision。
- 每次最多一个 OPEN PendingQuestion。
- Gate 和状态转换有 Unit Test。

## 12. 里程碑 V1.2：AI、Router、Evidence 与澄清

### 产品成果

Agent 能在全局 Chat 中区分五种 intent，把直接事项或新来源转换成最多一个 Event，并在信息不足时一次只问一个问题。

### 实现

- 实现固定 intent router。
- NEW_MATTER 事务中创建 message/case/run，以 ChatMessage 作为 evidence。
- NEW_SOURCE 事务中额外创建 immutable inbox。
- Provider 调用位于事务外。
- 实现 `EVENT | NO_ACTION | MULTIPLE_MATTERS` schema。
- 校验 quote/offset 和 evidence state。
- 实现 ExtractionRun timeout、failure、abandon 和 retry。
- CLARIFICATION_ANSWER 必须 replyTo PendingQuestion。
- 模型上下文只加载目标 Case。
- EVENT_QUERY 只查询 Event store。
- 预留 `operationHint`、`relatedEventHint` 和 pending 字段。
- 历史 Event 自动 update/cancel routing 延后；没有显式 target 时不修改历史。

### 故障实验

- 非法 JSON 或 schema-valid 但语义无效的输出。
- Provider timeout。
- 相对日期缺少可信 referenceDate。
- Evidence quote/offset 不存在。
- Prompt injection。
- 输出多个 matters。
- 模型尝试返回多个 Event。
- 澄清回答没有 replyTo、绑定旧问题或旧 Event version。
- Router 把 GENERAL 当作 NEW_MATTER/NEW_SOURCE。
- 模型上下文意外包含另一个 Case 的消息。

### 验收标准

- 模型失败不丢失 message/case 或已经存在的 source。
- 一个输入最多创建一个 Event。
- MULTIPLE_MATTERS 不创建多个 Event，并要求拆分或选择。
- 每个 blocking 字段有可信 evidence。
- 每轮最多一个 OPEN question。
- non-blocking missing 只显示 warning。
- Case 隔离有自动化测试。
- Query 不通过解析 Chat 恢复权威 Event。
- UI 披露来源会发送给配置的 model provider。

## 13. 里程碑 V1.3：确认、Pending Operation 与 Events

### 产品成果

用户可以确认或忽略 Event。确认后 Events tab 出现，并只查询 confirmed/cancelled 权威状态。用户还可以对 confirmed Event 审查并确认 update/cancel 的 before-after 变化。

### 实现

- 实现 READY -> CONFIRMED 与 COLLECTING/READY -> IGNORED。
- Confirm 使用 `eventId + expectedVersion + idempotencyKey` 并重跑 gate。
- 添加 EventHistory snapshot。
- 添加 Events tab 与 authoritative Event query。
- Events query 限定 `CONFIRMED/CANCELLED`。
- 实现显式 Start update/cancel。
- pending operation 只写 pending 字段，正式字段不变。
- 实现 pendingStatus COLLECTING/READY。
- 实现 ConfirmPending 和 DiscardPending。
- DiscardPending 对 update/cancel 都追加 `PENDING_DISCARDED` history，正式字段保持不变。
- update/cancel 显示 before-after Preview。
- 自动从任意新通知匹配历史 Event 仍可延后。

### 故障实验

- 双击 Confirm。
- 两个 tab 确认相同 Event version。
- Frontend 篡改 READY 状态。
- Confirm 与 EventHistory 写入之间失败。
- pending update 覆盖正式字段。
- 查询结果意外展示 pendingChanges。
- update/cancel 使用过期 version。
- cancellation 在 Event 更新后重试旧 command。

### 验收标准

- 未通过 gate 的 Event 不能确认。
- 确认最多应用一次。
- 过期写返回 `409`。
- Event 与 History 原子写入。
- Events 不展示 COLLECTING、READY 或 IGNORED。
- Query 只返回正式字段。
- update 在确认前不改变正式字段。
- cancellation 确认后变为 CANCELLED。
- discard pending 后 confirmed Event 正式字段完全保持原值，并留下 `PENDING_DISCARDED` audit snapshot。
- 未完成工作可从 Chat resume card 恢复。

## 14. 里程碑 V1.4：显式 `.ics` 导出

### 产品成果

用户可以从 CONFIRMED Event 明确导出 Apple Calendar 能导入的 `.ics`。

### 实现

- 直接从 Event authoritative snapshot 生成文件。
- 添加 CalendarExport。
- 使用 stable UID、sequence 和 eventVersion。
- 正确处理 timed Appointment、date-only/timed Deadline、Reminder、DST 和文本转义。
- 返回 `text/calendar`。
- 使用 Idempotency Key 返回确定性重试结果。
- update 确认后的下一次导出增加 sequence。
- 不自动生成 cancellation 文件。

### 故障实验

- 重复导出。
- pending update 存在时导出。
- confirmed update 后再次导出。
- DST 切换点和跨午夜。
- Unicode、逗号、分号、反斜杠和换行。
- date-only Deadline。

### 验收标准

- 代表性文件可人工导入 Apple Calendar。
- 相同 command 返回相同 bytes。
- pendingChanges 不进入导出。
- 同一 Event 保持 stable UID。
- 已应用更新后 sequence 单调递增。
- 只有用户显式操作才导出。
- 产品不虚报 provider-confirmed import。

## 15. 里程碑 V1.5：Evaluation 与发布加固

### 产品成果

V1 足够安全，可用于开发者自己的低风险生活通知，并拥有可复现的路由、提取、澄清、确认、查询和 Calendar 基线。

### 实现

- 版本化 intent-router Evaluation。
- 版本化 extraction/evidence dataset。
- completeness gate 与 question priority 测试矩阵。
- global chat / Case context-isolation 测试。
- MULTIPLE_MATTERS Evaluation。
- confirmed update/cancel before-after 测试。
- Event query authoritative-store 测试。
- deterministic ICS 测试。
- Provider、validation、concurrency 和 export error UI。
- 不含完整私人内容的 Structured Log。
- 本地数据删除流程。
- README 中记录启动、Migration、测试和 provider 数据边界。

最低 Evaluation 类别：

- 单一明确 Appointment。
- 单一 date-only Deadline。
- 单一 Reminder。
- 模糊或冲突日期。
- 缺少地点但可确认。
- 需要接受默认时长。
- 一份输入包含多个 matters。
- NO_ACTION。
- 明确的 historical update/cancellation hint。
- 英语、瑞典语和中文。
- Prompt injection 和 unsupported evidence。
- NEW_MATTER、GENERAL 与 EVENT_QUERY 不产生 InboxItem。

### 验收标准

- 从干净数据库可完成 Chat -> Progress -> Preview -> Confirm -> Events -> Export。
- Global Chat 刷新后稳定恢复。
- 模型上下文不会跨 Case 泄漏。
- 每个 Case 最多一个 Event。
- 每轮最多一个 OPEN PendingQuestion。
- confirmed update 在确认前不改变正式字段。
- Events/query 永不依赖重新解析 Chat。
- Safety case 不会静默创建或修改 CONFIRMED Event。
- 默认日志不含完整 source/chat/secret/ICS content。
- Evaluation 记录 model、prompt 和 policy version。

## 16. V1 发布定义

只有满足以下条件，V1 才能发布：

- 默认界面是单一 Agent Chat；没有用户可见 Cases center。
- Settings 保持低显著度。
- Events 只在确认能力存在后出现，并且只查询 CONFIRMED/CANCELLED。
- LifeCase 与 InboxItem 是内部实现。
- 每个 Case 有 0..* immutable InboxItem 和最多一个 Event。
- InboxItem 只代表外部来源，不代表普通 ChatMessage。
- ChatMessage 可以不属于 Case，但模型上下文始终按 Case 隔离。
- Event 使用 `COLLECTING/READY/CONFIRMED/IGNORED/CANCELLED`。
- 未确认编辑直接更新同一 Event 并 version++。
- confirmed update/cancel 使用 pending 字段和 before-after confirmation。
- 确认、忽略、应用更新、丢弃 pending operation 和确认取消都有 append-only EventHistory snapshot；普通 `COLLECTING <-> READY` 不要求 history。
- 一次输入最多处理一个 matter；MULTIPLE_MATTERS 要求用户选择一个事项或分开提交，V1 不自动拆分。
- Confirm 在 Backend 重跑 gate，并使用 optimistic concurrency 与 idempotency。
- Event query 只读取 Event store。
- `.ics` 由用户显式、幂等地导出。
- Migration、Integration Test、failure experiment 和 Evaluation baseline 已完成。
- V1 不依赖 Redis、pgvector 或 Agent framework。

一句话定义：

> LifeInbox V1 在一条全局聊天中，把每件独立生活事项安全地收敛为最多一个有证据、可确认、可查询的 Event。
