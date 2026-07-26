# ADR 0002：采用 Conversation-first、Card-confirmed、Case-organized 交互模型

[English](0002-conversation-first-interaction.en.md)

| 项目     | 值                                                           |
| -------- | ------------------------------------------------------------ |
| 状态     | Superseded by [ADR 0003](0003-single-chat-internal-cases.md) |
| 决策日期 | 2026-07-25                                                   |
| 范围     | LifeInbox 产品交互、状态边界与前后端职责                     |

> 本 ADR 保留旧决策及其理由，作为设计历史。当前有效的交互与领域边界以 ADR 0003 为准。

## 背景

LifeInbox 的核心任务不是让用户维护一组数据表，而是帮助用户理解一条生活通知、补齐关键事实，并安全地形成下一步行动。

传统的 Inbox 或 Dashboard 可以方便地展示大量记录，但它要求用户自己理解状态、寻找缺失信息并完成字段录入。纯聊天界面则存在相反的问题：结果被埋在消息历史中，证据、版本、确认状态和外部副作用很难准确查询。

产品需要同时满足：

- 用户可以用自然语言或粘贴通知开始。
- 系统主动识别行动、缺失字段、冲突和证据。
- 澄清过程保持轻量，每次只处理一个真正阻塞的问题。
- AI 输出在用户确认前始终是草稿。
- 确认对象必须是准确、结构化且有版本的内容。
- 用户能够在之后查询所有 Case、来源、对话、行动和导出状态。
- 聊天式体验不能迫使 V1 过早实现自由运行的 Agent loop。

## 决策

LifeInbox 采用以下产品交互模型：

> **Conversation-first、Card-confirmed、Case-organized。**

### Conversation-first

`Agent Workspace` 是默认入口。用户通过粘贴通知或自然语言描述开始一个新的 `LifeCase`，之后在同一个 Case 中回答澄清问题。

V1 中的对话由应用程序固定编排：

```text
接收来源
-> 提取结构化草稿
-> 执行字段与证据完整性检查
-> 提出一个阻塞问题，或生成 Action Preview Card
```

模型不在 V1 中自由选择工具。聊天界面是一种产品交互方式，不等同于自主 Agent。

### Card-confirmed

聊天消息不直接成为权威行动。阻塞字段存在时，对话和 Draft Progress 展示当前理解、证据与唯一活跃问题；这不是可确认 Card。完整性 Gate 通过后，系统才将候选结果呈现为 `Action Preview Card`，其底层对应带不可变 revision 的 `ActionItem DRAFT`。

Card 至少展示：

- 行动类型。
- 标题。
- 日期、时间和时区。
- 地点与下一步行动。
- 每个重要字段的证据或来源。
- 非阻塞 warning、已解决冲突的历史和已接受默认值。
- 当前 ActionItem revision identifier/number。

用户可以编辑、忽略或确认 Card。只有确认后的准确 revision 才成为权威 Action，并获得导出 `.ics` 等后续操作资格。

确认操作必须绑定 `ActionItem` identifier、revision identifier 和 aggregate `expectedVersion`。编辑会创建新的不可变 revision；如果重新引入 blocker，界面退回 Draft Progress。新 revision 必须重新确认，旧确认不能自动适用于新内容。

### Case-organized

`LifeCase` 是用户理解事情的主要容器。V1 中一个 Case 包含：

- 一份不可变的主要 `InboxItem` 来源。
- 一组 `CaseMessage` 对话记录。
- 零个或多个提取尝试。
- 零个或多个 `ActionItem`。
- 相关的 Calendar Draft 与导出记录。

V1 每个 Case 只有一个主要来源。后续版本可以把更新、取消通知或相关文档附加到同一个 Case。

`Cases` 是次级信息中心，而不是主要工作入口。默认使用可搜索的列表或 Card，并按 `Needs input`、`Ready for review`、`Planned`、`Done` 和 `Ignored` 分组。`Planned` 表示已确认但尚未完成的行动；Calendar 导出和用户报告导入是独立 badge。表格可以在未来作为高级密集视图出现，但不是默认体验。

### 结构化状态不会被聊天取代

对话记录用于解释过程，不是产品状态的唯一来源：

- 原始来源保存在 `InboxItem`。
- 对话保存在 `CaseMessage`。
- 提取尝试保存在 `ExtractionRun`。
- 行动身份和当前状态保存在 `ActionItem`，每个用户可见版本保存在不可变的 `ActionItemRevision`。
- Calendar 输出保存在 `CalendarDraft`、append-only `CalendarExport` 和 `CalendarImportReport`。

聊天时间线可以引用这些结构化对象，但不能把整个 Card、审批或导出结果只存成一段自然语言。

### 字段与证据完整性

重要字段使用以下证据状态：

```text
SUPPORTED_BY_SOURCE
PROVIDED_BY_USER
DEFAULT_ACCEPTED
MISSING
CONFLICTING
```

应用程序根据行动类型执行确定性的完整性规则。例如 Appointment 必须具有日期、开始时间、时区，以及结束时间或用户明确接受的默认时长。

系统只询问阻止确认的字段：

- 每次只问一个最高优先级问题。
- 不重复询问已有可靠证据的字段。
- 说明为什么需要该信息。
- 允许用户回答“不知道”或取消。
- 可选字段缺失时展示警告，不强迫用户补齐。
- 用户回答作为新的 provenance 保存，不修改原始来源。

### 外部副作用边界

确认 Action 与执行外部操作是两个不同步骤。即使 Card 已确认，`.ics` 导出仍需要用户单独触发。产品可以记录文件已经生成，也可以记录用户显式报告已经导入，但后者必须标为 `USER_REPORTED_IMPORTED`，不能声称 Apple Calendar provider 已确认导入。

## 主要交互流程

```text
Agent Workspace
-> 用户粘贴通知
-> 创建 LifeCase 与不可变 InboxItem
-> Agent 展示理解结果
-> 完整性 Gate
   -> 缺少阻塞字段：提出一个问题
   -> 信息完整：展示 Action Preview Card
-> 用户编辑或确认准确版本
-> 显式导出 .ics
-> Case 进入 Cases 信息中心，供后续查询
```

## 后果

### 收益

- 用户围绕真实意图交流，而不是填写后台表单。
- 不确定性和证据可以在确认之前被处理。
- Card 为确认、并发控制和外部副作用提供明确边界。
- Case 让来源、对话、状态和历史保持可查询。
- V1 可以提供 Agent-like 体验，同时保留固定工作流的可靠性。
- V5 可以在不重写产品状态模型的情况下引入动态工具选择。

### 成本

- 对话消息和权威领域状态必须分别建模。
- UI 需要同时支持自然语言与结构化 Card 编辑。
- Case 恢复、消息幂等和草稿版本需要明确设计。
- Agent 的语言表达与产品状态可能不一致，因此 Backend 必须重新校验 Card。
- 仅靠聊天 transcript 无法测试产品正确性，需要针对状态和证据编写测试。

## 被拒绝的替代方案

### Table-first Dashboard

拒绝作为默认体验。它适合密集查询，但把理解通知和补齐信息的工作重新交给用户。

### 一个无限增长的全局聊天

拒绝。不同通知会共享模糊上下文，难以隔离证据、权限、状态和后续更新。

### 只保存聊天记录

拒绝。自然语言 transcript 不能替代可校验、可并发控制和可审计的结构化状态。

### V1 直接实现自由运行的 Agent

拒绝。V1 的工具选择和状态转换可以由固定工作流完成。只有当动态分支相对于固定流程产生经过评测的价值时，才在 V5 引入 bounded Agent loop。

## 验证

这项决策通过以下行为验证：

- 用户可以从 Agent Workspace 创建一个 Case，而不需要先填写结构化表单。
- 完整通知可以直接产生 Preview Card。
- 缺少阻塞字段时，每轮只出现一个聚焦问题。
- 可选字段缺失不会造成无休止追问。
- 每个重要字段都能展示来源、用户回答或已接受默认值。
- 编辑 Card 后，旧 revision 不能被确认；旧历史仍可审计。
- 未确认 Card 不能导出日历。
- Cases 中可以重新打开来源、对话、Card 和导出历史。
- 刷新或服务重启不会要求依赖模型重新推断权威状态。
