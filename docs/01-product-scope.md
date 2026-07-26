# LifeInbox 产品范围与原则

[English](01-product-scope.en.md)

当前交互与领域边界由 [ADR 0003](adr/0003-single-chat-internal-cases.md) 锁定。

`LifeCase` 是领域与实现中的正式名称；本文在语义明确时简称 `Case`。

## 1. 产品概述

LifeInbox 是一个以单一对话为主要交互的个人生活通知 Agent。

用户可以直接告诉 Agent 一件事，或粘贴住房检查、大学截止日期、医疗预约、包裹取件、退货截止日期、订阅续费等外部通知。LifeInbox 会先保留原始材料，再提取结构化信息、核对字段证据、逐步补全阻塞信息，并把结果整理为可确认的 Event Preview Card。用户确认后，Event 才成为权威产品状态，并可由用户另行导出到 Apple Calendar。

它的核心承诺是：

> 在三十秒内理解一条重要生活通知，清楚说明还缺什么，并且不暗自编造日期、不跨事项混用证据、不在未经确认的情况下采取行动。

产品范围保持聚焦：

```text
生活通知
-> 证据完整的 Event Preview
-> 用户明确确认
-> 可选的 Calendar .ics 导出
-> 后续更新或取消
```

LifeInbox 不是通用聊天机器人，也不是把数据库表格包装成 AI 的任务管理后台。

## 2. 主要用户与初始场景

第一位用户是产品开发者本人。初始场景是一位居住在瑞典、会收到英语、瑞典语或中文通知的个人用户。默认时区为 `Europe/Stockholm`。

V1 是 local-first、单用户产品。只有在 V2 加入身份认证和 owner-only 授权后，它才会成为可跨设备远程使用的产品。

## 3. 问题陈述

日常通知经常把背景、日期、要求、更新和无关文本混在一起。用户必须判断：

- 这是否需要进入日历？
- 它是预约、截止日期，还是时间灵活的提醒？
- 哪个日期是实际发生日期，而不是消息发送日期？
- 时间、地点、时区或下一步行动是否明确？
- 新通知是在创建新事项，还是更新或取消已有事项？
- 哪一段来源或哪一次用户回答支持每个重要字段？

复制这些信息到日历虽然是小事，却会反复发生。漏掉日期、使用错误时区，或把一件事的回答应用到另一件事，都可能带来实际损失。

## 4. 核心交互模型

LifeInbox 遵循三个互相约束的原则：

> Single-chat，Card-confirmed，Internally case-scoped。

### 4.1 Single-chat

用户始终看到一条全局、按时间排序的 Agent chat，不需要创建、命名、选择或切换内部工作流对象。

对话负责：

- 接收自然语言意图和外部通知。
- 简短说明系统理解到的事项。
- 展示 Draft Progress、唯一活跃 blocker 和 resume card。
- 展示 Event Preview、候选更新和确认结果。
- 接收修改、忽略、取消、查询和导出指令。

未完成事项不会放进用户可见的 Cases 页面。Agent 在 chat 中使用 resume card 提示，例如“公寓检查还缺开始时间”，用户可以直接继续回答。

### 4.2 Card-confirmed

自然语言总结不是最终事实。只要仍有阻塞字段，chat 就展示 Draft Progress 和一个问题，不把不完整结果伪装成可确认 Card。

确定性完整性 Gate 通过后，当前准确 Event version 才显示为 Event Preview Card。Card 至少展示：

- Event 类型和标题。
- 日期、时间、时区、地点、提醒和下一步行动等相关字段。
- 每个重要字段的证据来源或用户补充。
- 已接受的偏好默认值、非阻塞 warning 和已解决冲突。
- `Edit`、`Ignore` 和 `Confirm` 操作。

用户必须确认 Card 所引用的准确 Event version。聊天中的“看起来没问题”只有在产品将其解释为对这张 Card 的明确 Confirm 并再次展示确认目标时才有效；不得把模糊肯定当作确认。

### 4.3 Internally case-scoped

单一可见聊天不等于把整段聊天作为每次 LLM 输入。

Backend 会识别目标内部 Case，并只向模型提供：

- 该 Case 的 `InboxItem`。
- 与该 Case 关联的 `ChatMessage`。
- 明确允许使用的 Settings 偏好。
- 该 Case 的当前 Event，以及 `pendingOperation`、`pendingChanges`、`pendingEvidence`、`pendingStatus`。

如果一句话可能属于多个事项，Agent 必须先询问用户。不同 Case 的日期、地点、证据或回答不得静默串用。

## 5. 分阶段产品界面

### 阶段 A：Agent + Settings

初期导航只有：

- **Agent**：唯一对话入口和默认首页。
- **Settings**：保存默认时区、默认预约时长、提醒提前量、首选语言等偏好。

设置项不是无条件事实。若偏好用于填补会阻塞确认的字段，Preview 必须显示它来自默认值，并要求用户明确接受。

### 阶段 B：增加 Events

当 V1 能可靠地产生已确认 Event 后，增加：

- **Events**：查询、搜索和查看越过确认边界的 Event，即当前为 `CONFIRMED`，或确认后又被取消而当前为 `CANCELLED`。

Events tab 不展示 `COLLECTING`、`READY` 或 `IGNORED` 候选。已经确认后又取消的 Event 可以作为历史记录保留，但必须清楚标记为 `CANCELLED`。

未完成候选仍只通过 Agent chat 中的 Draft Progress 和 resume card 恢复。Events 不是另一个审批收件箱，也不是 Case 管理页面。

### 用户永远不可见的对象

用户不会看到、创建、选择或切换：

- `LifeCase`（简称 `Case`）
- `InboxItem`
- `ExtractionRun`
- 内部 evidence 或 audit 记录

这些对象服务于证据、状态、隔离和可诊断性，而不是导航结构。

## 6. 内部领域模型

### 6.1 ChatMessage：全局时间线

所有用户与 Agent 消息形成一条全局时间线：

```text
ChatMessage
  id
  role: USER | ASSISTANT | SYSTEM
  kind
  content
  caseId?
  referenceType?
  referenceId?
  clientMessageId?
  createdAt
```

`caseId` 可以为空。例如，系统尚未判断第一条消息属于哪件事，或消息只是通用界面提示。一旦某条消息被用于某件事的提取、澄清、确认、更新或取消，它必须关联对应 Case。

用户对 Agent 澄清问题的回答是带 Case 引用的 `ChatMessage` evidence，不是新的 `InboxItem`。

### 6.2 LifeCase（Case）：一件具体事项

`LifeCase` 是后台中一件具体的现实事项，例如“一次公寓检查”或“一次商品退货”：

```text
Case
  -> zero or more immutable InboxItems
  -> zero or more linked ChatMessages
  -> zero or one Event
  -> zero or more ExtractionRuns
```

Case 不是一条消息或一份来源的别名。用户直接表达的事项可以只依赖 `ChatMessage` evidence，不需要伪造 InboxItem；如果存在外部材料，同一事项又可以先后收到原通知、时间更新和取消通知，因此一个 Case 可以拥有多个 `InboxItem`。所有来源都必须保留，新的来源不得覆盖旧来源。

如果一份材料包含多件互相独立的事项，V1 先提示用户选择一个事项或分开提交；在事项边界明确前不创建 Event。V1 不共享同一个 InboxItem 给多个 Case，也不在一个 Case 中创建多个 Event。后续版本只有在引入明确的共享来源引用后，才可以经用户确认把一份材料拆成多个内部 Case。

### 6.3 InboxItem：外部原始材料

`InboxItem` 只表示用户带入系统的外部原始材料。V1 是粘贴文本；后续版本可以支持邮件、截图或 PDF。

不变量：

- 外部内容必须先持久化，再调用模型。
- 保存后的内容不得静默修改。
- 一个 Case 可以没有 InboxItem，也可以关联一个或多个 InboxItem；只有存在外部材料时才创建。
- `SUPPORTED_BY_SOURCE` 必须定位到具体 InboxItem；`PROVIDED_BY_USER` 必须定位到带 Case 引用的用户 ChatMessage；`DEFAULT_ACCEPTED` 必须定位到用户已明确接受的 UserPreference。
- Card edit command 必须在同一事务中追加一条 `EVENT_EDIT` 用户 ChatMessage，字段证据引用该消息，而不是引用不可审计的瞬时命令。
- Agent 的回复和用户的澄清回答都不是 InboxItem。

### 6.4 Event：候选与权威状态

一个 Case 在 V1 中最多拥有一个 Event：

```text
Case.event = zero or one Event
```

V1 不创建独立 `EventDraft` 或 Proposal 表。Event 本身同时承载确认前候选状态和确认后权威状态：

```text
Event
  id
  caseId
  type: APPOINTMENT | DEADLINE | REMINDER
  title
  temporalData
  location
  nextAction
  fieldStates
  status:
    COLLECTING
    READY
    CONFIRMED
    IGNORED
    CANCELLED
  pendingOperation: UPDATE | CANCEL | null
  pendingChanges?
  pendingEvidence?
  pendingStatus: COLLECTING | READY | null
  version
  createdAt
  updatedAt
```

`NO_ACTION` 是 Case 的合法结果：保留来源和审计记录，但不创建 Event。

## 7. Event 生命周期

### 7.1 状态语义

- `COLLECTING`：至少一个必要字段为 `MISSING` 或 `CONFLICTING`；chat 展示 Draft Progress 和唯一活跃问题。
- `READY`：确定性完整性 Gate 已通过；chat 展示可确认的 Event Preview Card。
- `CONFIRMED`：用户确认了当前准确 version；正式字段成为权威产品状态。
- `IGNORED`：用户在确认前明确放弃候选 Event。
- `CANCELLED`：已经确认的 Event 后来被用户明确确认取消。

主要转换：

```text
COLLECTING -> READY
READY -> COLLECTING
READY -> CONFIRMED
COLLECTING | READY -> IGNORED
CONFIRMED -> CANCELLED
```

每次状态修改与 Event version 必须在同一事务中提交。确认、忽略、应用或丢弃 pending operation、取消等重要权威转换还必须在该事务中追加 `EventHistory`；普通 `COLLECTING <-> READY` 变化不要求单独历史快照。

### 7.2 字段证据与完整性 Gate

每个重要字段使用以下状态：

```text
SUPPORTED_BY_SOURCE
PROVIDED_BY_USER
DEFAULT_ACCEPTED
MISSING
CONFLICTING
```

Backend 的确定性规则决定 Event 是否可以从 `COLLECTING` 进入 `READY`。模型 confidence 不能替代证据，也不能直接授予确认资格。

共同 Gate 要求 Event type 与非空 title 必须存在，并且每个 blocking 字段都具有允许的 evidence state。下面只列各类型额外的最低要求：

- `APPOINTMENT`：日期、开始时间和时区是 blocker；还需要结束时间，或用户明确接受默认时长。地点通常是非阻塞字段，只有确定性产品规则判断“没有地点就无法执行”时才提升为 blocker。
- `DEADLINE`：截止日期是 blocker；只有存在精确时间时，`dueAt` 与时区才必须同时有效。
- `REMINDER`：提醒日期是 blocker；提醒时间和地点通常不阻塞确认，不得把灵活提醒伪装成精确预约。

### 7.3 每次只问一个 blocker

若多个字段缺失或冲突，Backend 按确定性优先级选择一个最阻塞确认的问题。每一轮只问一个问题：

1. 保存用户回答为关联当前 Case 的 ChatMessage evidence。
2. 更新相关字段和 evidence。
3. 重新运行 Gate。
4. 继续问下一个 blocker，或展示 Event Preview Card。

用户可以随时说“稍后处理”。Event 保持 `COLLECTING`，并由 chat 中的 resume card 恢复。

### 7.4 明确确认与导出分离

只有绑定准确 Event version 的明确 Confirm 才能执行 `READY -> CONFIRMED`。

确认 Event 与导出 `.ics` 是两个独立操作：

1. 用户确认 Event。
2. 产品展示 Calendar Preview。
3. 用户再次明确选择导出。
4. Backend 使用已确认正式字段生成 `.ics`。

系统可以记录“文件已生成”或“用户报告已经导入”，但不能把用户报告描述为 Apple Calendar provider 已确认导入。

## 8. 已确认 Event 的后续更新

当新来源或用户消息提出更新或取消时，已经确认的正式字段和 `CONFIRMED` 状态保持不变。候选操作使用四个内嵌 pending 字段：

```text
pendingOperation: UPDATE | CANCEL
pendingChanges?      # 仅 UPDATE：拟议字段差异
pendingEvidence      # 候选字段或取消提议的证据
pendingStatus: COLLECTING | READY
```

取消原因来自 `pendingEvidence` 所指向的来源或用户消息，并显示在 Preview 中；除非未来正式 Event schema 增加对应字段，否则它不进入 `pendingChanges`。

Agent 在 chat 中展示旧值、新值、证据和影响：

- **接受更新**：重新运行 pending Gate，并在一个原子操作中应用 `pendingChanges`、物化 `pendingEvidence`、增加 Event version、清空全部 pending 字段并追加 `UPDATE_APPLIED` history。
- **接受取消**：重新运行 pending Gate，并在一个原子操作中把 Event 置为 `CANCELLED`、增加 version、清空全部 pending 字段并追加 `CANCELLED` history。
- **拒绝**：清空全部 pending 字段，不改变正式字段，并追加 `PENDING_DISCARDED` history。
- **仍有 blocker**：每轮只问一个问题，回答继续保存为 ChatMessage evidence。

未经确认的 pending operation：

- 不得覆盖 Events tab 中的权威字段。
- 不得用于 `.ics` 导出。
- 不得让 Event 暂时离开 `CONFIRMED`。

如果来源表明已确认事项被取消，Agent 必须展示取消证据并请求明确确认；只有确认后才进入 `CANCELLED`。

## 9. V1 固定编排流程

```text
receive message
-> identify or create internal Case
-> preserve InboxItem or ChatMessage evidence
-> extract candidate Event fields
-> validate schema, evidence, and completeness
-> ask one blocker or show Event Preview Card
-> explicit Confirm
-> optionally export .ics
```

应用代码决定每一步允许的转换、重试和副作用。单一 chat 的体验不意味着 V1 使用自主 Agent loop。

V1 不允许模型：

- 自由选择任意工具。
- 跳过 Gate 或确认边界。
- 自动导出或写入 Calendar。
- 静默把一件事的上下文用于另一件事。

动态工具选择、checkpoint、暂停/恢复、预算和审批边界属于 V5。

## 10. Event 类型

### Appointment

发生在特定时间段的事项，例如医生预约或住房检查。需要开始时间，以及结束时间或用户明确接受的默认时长；地点和提醒通常可选。

### Deadline

必须在某日期或时间之前完成的事项，例如申请或退货截止日期。它不是自动的全天预约。

### Reminder

需要在某天被提醒，但不一定占用固定时间段的事项，例如取消订阅或取包裹。

### No action

纯信息、营销内容或不需要日历行为的通知。系统保留 Case 和来源，但不创建 Event。

## 11. 产品原则与不变量

### 先保留来源，再进行解释

模型超时、输出无效或提取失败，都不能导致原始通知丢失。

### 对话不替代结构化状态

Chat 负责交互；Event、证据、version、确认、导出和审计仍是可查询的结构化状态。

### 全局时间线不等于全局模型上下文

用户可以在一条 chat 中处理多件事，但模型每次只能获得目标 Case 的允许上下文。

### Case 表示事项，InboxItem 表示来源

一个事项可以拥有多个来源。V1 的一份 InboxItem 只属于一个 Case；若材料包含多件独立事项，Agent 先要求用户选择或分开提交。两者不能混为同一概念。

### 先证据完整，再允许确认

任何 blocker 都会阻止 Event 进入 `READY`。只有准确 version 的明确 Confirm 才产生权威状态。

### 已确认事实保持稳定

候选更新或取消使用内嵌 pending 区域；用户接受前，正式字段和导出数据不变。

### 外部副作用由人控制

确认与导出分离。V1 不自动写 Calendar、发送邮件或触发其他外部操作。

### 如实表示外部状态

生成文件、用户报告导入和 provider 确认是三件不同的事，产品不得混淆。

### 先保证可靠性，再提高自主性

V1 使用固定编排；只有在评估、可观察性、预算和审批边界成熟后，V5 才引入动态 Agent loop。

### 默认保护隐私

只向模型发送完成当前 Case 所需的最小上下文，并保留未来导出和删除数据的能力。

## 12. 初始成功指标

V1 的目标不是最大化消息数，而是安全完成一件事：

- 典型通知在三十秒内得到正确理解或一个清楚的 blocker。
- 所有已确认 Event 的必要字段都有来源证据、用户补充或明确接受的默认值。
- 未经明确确认，不会产生权威 Event 或 `.ics` 导出。
- 不同 Case 之间没有证据或上下文泄漏。
- 已确认 Event 的候选修改不会在接受前覆盖正式字段。
- 用户不需要理解 Case、InboxItem 或 Event 状态机就能完成流程。

## 13. 五分钟产品演示

1. 打开 Agent chat，粘贴一条包含预约日期但缺少开始时间的通知。
2. 系统先保存来源，展示 Draft Progress，并只询问开始时间。
3. 用户回答；系统把回答保存为 ChatMessage evidence。
4. Gate 通过后，Agent 展示带字段证据和准确 version 的 Event Preview Card。
5. 用户确认 Event；Event 进入 `CONFIRMED`。
6. 用户另行点击导出，下载 `.ics`。
7. 用户粘贴同一事项的时间更新；Agent 展示 `pendingChanges` 的旧值、新值与证据。
8. 在用户接受前，Events tab 和再次导出的 `.ics` 仍使用原正式字段。
9. 用户接受变更；正式字段原子更新，Event version 增加。

若 Events tab 尚未进入当前交付阶段，第 8 步只验证 Backend 权威字段和 Calendar Preview。

## 14. 非目标

V1 不包含：

- 用户可见的 Cases、InboxItems 或工作流表格。
- 通用任务管理、笔记或 CRM。
- 自动读取完整邮箱或任意第三方账户。
- 自动写入 Apple Calendar。
- 多用户协作与共享日历。
- 独立 `EventDraft` 或 Proposal 数据模型。
- 一个 Case 中的多个 Event。
- 动态、自主的 Agent tool loop。
- 未经用户确认的外部副作用。
