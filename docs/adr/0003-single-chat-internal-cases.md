# ADR 0003：采用单一 Agent Chat、内部 Case 与单 Event 模型

[English](0003-single-chat-internal-cases.en.md)

| 项目     | 值                                                        |
| -------- | --------------------------------------------------------- |
| 状态     | Accepted                                                  |
| 决策日期 | 2026-07-25                                                |
| 范围     | LifeInbox 用户界面、对话上下文、领域聚合与 Event 生命周期 |
| 取代     | [ADR 0002](0002-conversation-first-interaction.md)        |

## 背景

ADR 0002 确立了 Conversation-first、Card-confirmed 和结构化状态边界，但同时把每个 Case 的独立对话与用户可见的 Cases 信息中心作为产品结构。

进一步讨论后，我们希望产品更像一个真正的个人 Agent：

- 用户始终从同一个对话入口表达意图、粘贴通知、回答问题和恢复未完成事项。
- 用户查询的是已经确认的 Event，而不是系统内部的 Case、来源记录或工作流状态。
- Case 仍然需要存在，用来隔离证据、状态和模型上下文，但它是内部领域对象。
- 一件具体事项在 V1 最多形成一个 Event，避免“一条通知、多张行动卡”把产品重新变成任务管理后台。
- Event 在确认前和确认后都使用同一个聚合；不能通过新增一个 EventDraft 表制造第二份可能漂移的数据。

因此需要取代 ADR 0002 中“每个 Case 一段用户可切换对话”和“Cases 是用户查询中心”的部分，同时保留 Card 确认、证据 Gate、固定编排和外部副作用边界。

## 决策

### 1. 用户只接触 Agent、Events 与 Settings

产品界面分阶段交付：

1. 初期只提供 `Agent` 与 `Settings`。
2. 当确认 Event 已能可靠产生后，增加 `Events` tab。

`Agent` 是唯一对话入口。`Events` 只查询已经跨过明确确认边界的 Event；它不展示 `COLLECTING`、`READY` 或 `IGNORED` 候选。曾经确认后被取消的 Event 可以作为历史记录展示，但必须明确标记为 `CANCELLED`。

`Settings` 保存默认时区、默认预约时长、提醒提前量、首选语言等偏好。偏好只能提出候选值；填补阻塞字段时仍需用户明确接受。

用户不会看到、创建、选择或切换 `Case`、`InboxItem`。未完成事项通过 Agent chat 内的 resume card 恢复。

### 2. 单一可见聊天不等于单一 LLM 上下文

用户看到一条全局、按时间排序的 Agent chat。所有用户与 Agent 消息都保存为 `ChatMessage`：

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

`caseId` 可以为空。例如，尚未识别事项的第一条消息或通用界面提示可以暂时不绑定 Case。一旦消息用于某件具体事项的提取、澄清、确认或更新，它必须引用对应 Case。

全局时间线只是用户界面。Backend 为每次模型调用建立受限上下文，只允许使用：

- 目标 Case 的 `InboxItem`。
- 与目标 Case 相关的 `ChatMessage`。
- 明确允许的 Settings 偏好。
- 当前 Event，以及 `pendingOperation`、`pendingChanges`、`pendingEvidence`、`pendingStatus`。

如果一条消息可能对应多个 Case，Agent 必须先询问用户，而不能把多个 Case 的事实一起交给模型猜测。不同 Case 之间的日期、地点和证据不得静默串用。

### 3. LifeCase 是内部的一件具体事项

`LifeCase` 表示现实世界中的一件具体事项，例如“一次公寓检查”或“一次商品退货”。`LifeCase` 是领域与实现中的正式名称，本文在语义明确时简称 `Case`。

V1 聚合关系：

```text
Case
  -> zero or more immutable InboxItems
  -> zero or more linked ChatMessages
  -> zero or one Event
  -> zero or more ExtractionRuns
```

Case 不是“一条来源记录”的别名。用户直接表达的事项可以只依赖 ChatMessage evidence，因此不要求每个 Case 都有 InboxItem。存在外部材料时，多个通知可以属于同一事项，例如原通知、时间更新和取消通知。系统必须保留所有来源及 provenance，任何新来源都不能覆盖旧来源。

Case 的创建、关联和恢复由 Backend 固定工作流负责。用户只看到 Agent 的解释、resume card 和 Event Card。

### 4. InboxItem 只表示外部原始材料

`InboxItem` 保存用户带入系统的外部原始材料，例如粘贴通知；后续版本还可以包括邮件、截图或 PDF。

规则：

- 内容保存后不可静默修改。
- 同一 Case 可以没有 InboxItem，也可以拥有多个 InboxItem；只有外部材料才创建 InboxItem。
- `SUPPORTED_BY_SOURCE` 必须定位到具体 InboxItem；`PROVIDED_BY_USER` 必须定位到带 Case 引用的用户 ChatMessage；`DEFAULT_ACCEPTED` 必须定位到用户明确接受的 UserPreference。
- Card edit command 必须在同一事务中追加一条 `EVENT_EDIT` 用户 ChatMessage，字段证据引用该消息。
- 用户对 Agent 澄清问题的回答不是新的 InboxItem，而是带 Case 引用的 `ChatMessage` evidence。

### 5. 一个 Case 在 V1 最多拥有一个 Event

V1 不支持一个 Case 产生多个 Event：

```text
Case.event = zero or one Event
```

如果一份外部材料明显包含多件互相独立的事项，V1 先要求用户选择一个事项或分开提交，在事项边界明确前不创建 Event。V1 不共享同一个 InboxItem 给多个 Case，也不在一个 Case 内创建多张 Event Card。后续只有在引入明确的共享来源引用后，才可以经用户确认拆分多个内部 Case。

`NO_ACTION` 表示 Case 保留来源和审计记录，但不创建 Event。

### 6. Event 合并草稿与权威状态

V1 不创建独立的 `EventDraft` 或 Proposal 表。Event 自身保存当前候选或已确认数据：

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

状态语义：

- `COLLECTING`：至少一个阻塞字段缺失或冲突。Chat 展示 Draft Progress 和唯一活跃问题。
- `READY`：确定性完整性 Gate 已通过。Chat 展示可确认的 Event Preview Card。
- `CONFIRMED`：用户确认了当前准确版本；正式字段成为权威产品状态。
- `IGNORED`：用户在确认前明确放弃候选 Event。
- `CANCELLED`：已经确认的 Event 后来被用户确认取消。

主要转换：

```text
COLLECTING -> READY
READY -> COLLECTING
READY -> CONFIRMED
COLLECTING | READY -> IGNORED
CONFIRMED -> CANCELLED
```

`COLLECTING` 与 `READY` 是同一个 Event 的状态，不需要独立 draft 表。每次状态修改与 Event version 必须在同一事务中保存；确认、忽略、应用或丢弃 pending operation、取消等重要权威转换还必须在该事务中追加 `EventHistory`，普通 `COLLECTING <-> READY` 变化不要求独立历史快照。

### 7. 已确认 Event 的候选操作使用内嵌 pending 字段

已确认 Event 收到更新或取消提议时，正式字段和 `CONFIRMED` 状态保持不变。候选操作写入：

```text
pendingOperation: UPDATE | CANCEL
pendingChanges?      # 仅 UPDATE：拟议字段差异
pendingEvidence      # 候选字段或取消提议的证据
pendingStatus: COLLECTING | READY
```

取消原因来自 `pendingEvidence` 引用的来源或用户消息，并显示在 Preview 中；它不是当前 Event 的拟议字段差异，因此不进入 `pendingChanges`。

Agent 在 chat 中展示旧值、新值、证据和影响：

- 接受更新：Backend 重新运行 pending Gate，原子应用 `pendingChanges`、物化 `pendingEvidence`、增加 Event version、清空全部 pending 字段并追加 `UPDATE_APPLIED` history。
- 接受取消：Backend 原子把 Event 置为 `CANCELLED`、增加 version、清空全部 pending 字段并追加 `CANCELLED` history。
- 用户拒绝：清空全部 pending 字段，不改变正式字段，并追加 `PENDING_DISCARDED` history。
- 候选仍有 blocker：每轮只问一个问题，回答作为 ChatMessage evidence 保存。

未确认的 pending operation 不能用于 `.ics` 导出，也不能覆盖 Events tab 中的权威字段。

### 8. Card、证据与外部副作用边界保持不变

重要字段继续使用：

```text
SUPPORTED_BY_SOURCE
PROVIDED_BY_USER
DEFAULT_ACCEPTED
MISSING
CONFLICTING
```

Backend 的确定性 Gate 决定 `COLLECTING -> READY`、是否允许 Confirm，以及是否允许应用 pending operation。模型 confidence 不是确认资格。

聊天文本不是确认对象。用户必须确认引用准确 Event version 的 Preview Card。确认 Event 与导出 `.ics` 是两个操作；导出必须再次由用户显式触发。系统只能如实记录文件已生成或用户报告已导入，不能声称 Apple Calendar provider 已确认导入。

### 9. V1 仍是固定编排

单一聊天界面不意味着 V1 使用自主 Agent loop。V1 的下一步由应用代码决定：

```text
receive
-> identify or create Case
-> preserve InboxItem or ChatMessage evidence
-> extract
-> validate
-> ask one blocker or show Event Preview
-> confirm
-> optionally export
```

动态工具选择、checkpoint、预算与审批边界仍属于 V5。

## 后果

### 收益

- 用户只需理解 Agent、Event 和 Settings，不需要学习内部工作流对象。
- 全局 chat 提供连续体验，同时 Case 隔离继续保护证据和上下文。
- 一个 Case 一个 Event 使确认、更新、取消和日历导出边界更直接。
- 内嵌 pending 区域保证已确认事实不会因候选更新或取消而暂时消失。
- Event 状态直接驱动 resume card 与 Events tab，无需把多个 Case/Action 状态合成为用户视图。

### 成本

- Backend 必须可靠地识别、创建或关联内部 Case。
- ChatMessage 查询既要支持全局时间线，也要支持按 Case 构建模型上下文。
- 一份材料包含多个事项时，V1 必须要求用户选择或分开提交；自动拆分要等共享来源模型存在后才能实现。
- pending operation 需要版本、证据、并发和审计设计。
- 旧的 Cases 页面、Case conversation 和多 Action Case 文档不能继续作为 V1 实现依据。

## 被拒绝的替代方案

### 用户可见的 Cases 工作区

拒绝。Case 是推理与证据隔离边界，不是用户首先要管理的对象。

### 把整条全局聊天作为每次 LLM 输入

拒绝。全局 UI 不授权跨 Case 使用事实；Backend 必须选择目标 Case 的受限上下文。

### 每个 InboxItem 固定创建一个 Case

拒绝。Case 表示事项；同一事项的更新与取消通知应保留为多个 InboxItem。

### 一个 Case 包含多个 Event

拒绝于 V1。互相独立的 Event 使用互相独立的 Case。

### 独立 EventDraft 表

拒绝。确认前状态由 Event 的 `COLLECTING`/`READY` 表示，避免 Event 与 EventDraft 漂移。

### 编辑已确认 Event 时退回未确认状态

拒绝。已确认字段继续有效，候选修改进入内嵌 pending 字段，直到用户确认准确变更。

## 验证

该决策通过以下行为验证：

- 用户导航中只有 Agent、随后加入的 Events，以及 Settings。
- 用户无需看到或选择 Case/InboxItem。
- 全局 chat 可以恢复多个未完成事项，但每次模型调用只获得一个目标 Case 的上下文。
- 澄清回答保存为 ChatMessage evidence，而不是 InboxItem。
- 一个 Case 永远不会拥有两个 Event。
- 有 blocker 的 Event 为 `COLLECTING`，Gate 通过后为 `READY`。
- 未经明确 Confirm，Event 不会进入 `CONFIRMED`。
- 编辑已确认 Event 只更新内嵌 pending 区域；正式字段在接受前不变。
- Events tab 只显示当前为 `CONFIRMED`，或确认后又变为 `CANCELLED` 的 Event。
- `.ics` 导出不自动发生，也不把用户报告伪装成 provider 确认。
- V1 不依赖动态 Agent loop。
