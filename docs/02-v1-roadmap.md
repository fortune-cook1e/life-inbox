# LifeInbox V1 路线图

[English](02-v1-roadmap.en.md)

## 1. V1 成果

当一个人能够可靠地使用以下流程时，V1 即告完成：

```text
粘贴文本通知
-> 保存来源原文
-> 获得结构化 AI 草稿
-> 审查证据与不确定性
-> 编辑并确认
-> 预览 Apple Calendar 事件
-> 导出 .ics
-> 将行动标记为已完成或已忽略
```

V1 被刻意设计为 AI 辅助工作流，而不是自主 Agent。这样既能让第一版产品真正可用，也能建立未来 Agent 可以调用的可靠组件。

## 2. V1 架构

```text
Next.js Web
    |
    | HTTP
    v
NestJS 模块化单体
    |-- inbox
    |-- extraction
    |-- actions
    `-- calendar-export
          |
          |-- 通过 Drizzle ORM 访问 PostgreSQL
          |-- 一个 LLM provider
          `-- 确定性的 .ics generator
```

V1 在运行时不依赖 Redis、Object Storage、pgvector 或 Agent framework。

## 3. 建议的 V1 数据模型

只有当对应里程碑开始时，才引入这些实体。

### InboxItem

保存来源原文及其审查处置结果。提取过程的执行状态属于 `ExtractionRun`，不属于这条记录。

```text
id
rawText
contentHash
sourceType: PASTED_TEXT
sourceReceivedAt
referenceDate
referenceDateSource: NOTICE_METADATA | USER_PROVIDED | SUBMISSION_TIME
disposition: UNREVIEWED | ACTIONS_PROPOSED | NO_ACTION | REVIEWED | ARCHIVED
createdAt
updatedAt
version
```

`contentHash` 用于提供重复内容警告，但默认不具有唯一性：两次提交完全相同的文本可能对应两条真实通知，而且“内容相同”并不等同于“重试同一个 command”。

### ExtractionRun

一次模型尝试。将每次尝试单独保存，便于后续实现重试、Prompt 对比和 Evaluation。

```text
id
inboxItemId
model
promptVersion
status: RUNNING | SUCCEEDED | FAILED | ABANDONED
structuredOutput
errorCode
latencyMs
inputTokens
outputTokens
estimatedCost
startedAt
completedAt
updatedAt
```

### ActionItem

经过审查、最终由用户确认的行动。

```text
id
inboxItemId
type: APPOINTMENT | DEADLINE | REMINDER
title
startAt
endAt
dueDate
timeZone
location
nextAction
evidence
missingFields
status: DRAFT | CONFIRMED | DONE | IGNORED
createdAt
updatedAt
version
```

`startAt` 和 `endAt` 表示时间点（instant）；`dueDate` 表示只有日期的截止日。Schema 不得假装它们具有相同语义。

`DRAFT` 可以不完整。“预约必须具有日期、开始时间和时区”等完整性规则，在用户确认或导出时执行，而不是在草稿第一次创建时执行。

重要的建议字段需要携带 provenance：

```text
value
provenance:
  sourceType: NOTICE | CLARIFICATION | USER_EDIT | PREFERENCE
  sourceId
  startOffset
  endOffset
  quote
```

究竟使用规范化数据表还是 JSON 来表示，将在 V1.2 中决定。产品要求是字段级可追溯性，而不是为整个行动只保存一段 evidence 字符串。

### CalendarDraft

用于生成 `.ics` 的确定性事件表示。

```text
id
actionItemId
stableUid
sequence
eventFields
status: PROPOSED | EXPORTED | USER_REPORTED_IMPORTED
exportedAt
createdAt
updatedAt
```

`USER_REPORTED_IMPORTED` 是 V1 对“已安排进 Apple Calendar”的唯一表示。它只意味着用户报告已完成导入，并不代表 Apple Calendar provider 已确认该状态。`ActionItem` 不重复保存这个日历导入状态。

## 4. 里程碑 V1.0：工程基线与 Drizzle

### 产品成果

Web 和 API 能连接 PostgreSQL 启动，Migration 可复现，并且一项使用真实数据库的测试能够通过。

### 实现

- 初始化或核实现有的 Next.js 和 NestJS 应用。
- 添加 `drizzle-orm`、`drizzle-kit` 和 `pg`。
- 只添加一个 `drizzle.config.ts`。
- 创建运行时 `src/db` 边界。
- 添加有版本控制的 Migration 命令。
- 分别创建开发数据库和测试数据库。
- 添加一项真实的 PostgreSQL Integration Test。
- 为 lint、test 和 build 添加 CI。

### 明确的 ORM 规则

- 禁止安装 TypeORM。
- 禁止添加 `@nestjs/typeorm`。
- 禁止维护 TypeORM entity 或 TypeORM migration。
- 如果现有 scaffold 包含 TypeORM，必须在开始创建产品实体之前将其移除。
- Drizzle ORM 是本项目唯一的应用层 ORM。

### 学习要点

- 环境配置。
- PostgreSQL Connection Pool。
- Drizzle schema 与 Migration 生命周期。
- 开发环境与测试环境的配置差异。
- NestJS 模块边界。
- Integration Test 与数据库清理。

### 故障实验

- 使用无效的数据库 URL 启动。
- 在执行 Migration 之前运行应用。
- 对全新的空数据库执行 Migration。
- 运行两个在缺少隔离时会互相污染的测试用例。

### 验收标准

- 能通过已提交的 Migration 初始化空数据库。
- 测试与开发环境使用同一份 Migration 历史。
- 数据库不可用时，应用能清楚报告错误。
- 至少一项 Integration Test 通过真实的 Drizzle 连接执行查询，例如 `SELECT 1`；第一张产品数据表到 V1.1 才引入。
- 不存在任何 TypeORM dependency 或 import。
- 启动 V1 不需要 Redis。

## 5. 里程碑 V1.1：手工 Inbox

### 产品成果

用户可以粘贴一条通知，并在之后查看被完整保存的来源原文。

### 实现

- 创建并读取 `InboxItem`。
- 使用稳定的逆时间顺序列出 InboxItem：`createdAt DESC, id DESC`。
- 对相同来源内容发出警告，但不自动拒绝。
- 构建最小化的 Inbox 页面和来源详情页。

候选 API 形状：

```text
POST   /inbox-items
GET    /inbox-items
GET    /inbox-items/:id
```

实现前应审查具体 endpoint；这并不要求立即构建每一种操作。

### 学习要点

- HTTP method 和 status code。
- DTO Validation 与错误映射。
- Drizzle insert 和 select。
- Primary Key、长度约束、content hash 与稳定排序。
- Service 与持久化层的职责边界。
- 使用真实数据库的 Integration Test。

### 故障实验

- 提交空白或超出大小限制的来源文本。
- 请求不存在的资源。
- 两次提交相同内容，并区分“重复内容警告”和“command 被拒绝”。
- 插入多条创建时间完全相同的记录，验证排序仍然稳定。

### 验收标准

- 非法输入返回 `400`，且不会写入数据库。
- 资源不存在时返回 `404`。
- 返回的来源文本与提交内容完全一致。
- 列表顺序是确定性的。
- 相同内容可以被标记，但不能被当作 Idempotency Key。
- create、list 和 detail 路径都有真实 PostgreSQL Integration Test。

### 延后

- LLM 调用。
- Authentication。
- 文件。
- 行动草稿与确认。
- `.ics` 生成。

## 6. 里程碑 V1.1b：手工行动草稿

### 产品成果

用户可以为某个 InboxItem 手工创建并编辑一份不完整的行动草稿。确认功能被刻意延后到 V1.3。

### 实现

- 添加状态为 `DRAFT` 的 `ActionItem`。
- 创建并编辑手工草稿。
- 在不可变的来源原文旁展示草稿。
- 添加第一个 Foreign Key 和 relation query。
- 根据状态校验字段：草稿允许不完整。

候选 API 形状：

```text
POST  /inbox-items/:id/actions
PATCH /actions/:id
```

### 学习要点

- Foreign Key 与删除行为。
- Drizzle relation 与 PostgreSQL constraint 的区别。
- 不完整草稿与依赖状态的 Validation。
- 在尚未实现确认功能时，先加入乐观并发所需的 version 字段。

### 故障实验

- 为不存在的 InboxItem 创建草稿。
- 使用未知的行动类型。
- 保存不完整的预约草稿。
- 尝试通过 action route 修改不可变的来源原文。

### 验收标准

- 草稿始终引用一个存在的 InboxItem。
- 不完整的预约可以保持为可见的 `DRAFT`。
- 编辑草稿后，来源原文保持不变。
- 此时不存在 confirmation、completion 或 calendar-export endpoint。

## 7. 里程碑 V1.2：AI 提取草稿

### 产品成果

用户粘贴通知后，会获得零个或多个可编辑的行动草稿，并能看到对应证据和不确定性。

### 参考时间

相对时间表达需要可信锚点。模型输入包含显式的 `referenceDate` 及其 provenance。如果粘贴的通知写着 `tomorrow`，但没有可信的接收日期，LifeInbox 必须要求用户澄清，而不能悄悄把粘贴时间当成锚点。

Evaluation case 使用固定 reference clock，避免期望日期随时间变化。

### 结构化输出

```text
outcome: ACTIONS | NO_ACTION
actions:
  - type: APPOINTMENT | DEADLINE | REMINDER
    title
    startAt
    endAt
    dueDate
    timeZone
    location
    nextAction
    missingFields
    fieldProvenance
warnings
```

硬性不变量：

```text
NO_ACTION => actions.length == 0
ACTIONS   => actions.length >= 1
```

### 数据流

```text
保存 InboxItem
-> 提交数据库事务
-> 创建 RUNNING ExtractionRun
-> 提交数据库事务
-> 调用 LLM，并设置 timeout
-> 校验 structured output
-> 对照来源原文验证 evidence
-> 在新事务中将 ExtractionRun 更新为 SUCCEEDED，并保存草稿

provider/validation 失败时：
-> 将 ExtractionRun 更新为 FAILED
```

LLM 调用不得放在长时间持有的数据库事务中。如果进程在创建 run 之后终止，后续请求可以将过期的 `RUNNING` attempt 标记为 `ABANDONED`，然后创建新的 attempt。

在实现 Prompt 之前，先创建一组有版本控制、约 15–30 条的 gold case，覆盖下方列出的最低类别。V1.5 将扩充这组数据并设置 release threshold，而不是到那时才第一次创建 Evaluation。

### 学习要点

- Structured Output 与 Schema Validation。
- Timeout、Cancellation 与外部错误分类。
- Prompt 与 Model Versioning。
- Token、Latency 与 Cost 记录。
- Model Output 与用户确认后的产品状态之间的区别。
- 安全的 Retry Boundary。
- 第三方模型的数据边界与 provider retention setting。

### 故障实验

- 返回非法 JSON。
- 返回符合 schema 但缺少必要值的结果。
- 让 provider 调用超时。
- 为 `next week` 捏造一个精确日期。
- 在缺少可信 reference date 时解析相对日期。
- 提供来源原文中不存在的字段 evidence。
- 为实际上无需行动的消息返回行动。
- 同时返回 `NO_ACTION` 和非空的 actions array。
- 遵循通知正文中试图改变输出协议或泄露 system instructions 的指令。

### 验收标准

- 模型调用失败绝不会删除 InboxItem。
- 非法输出绝不会进入 ActionItem。
- 重要字段的 evidence 能在来源原文或用户明确提供的 clarification 中找到。
- 模糊值保持为 `DRAFT`，保留 missing-field 标记，并让 InboxItem disposition 继续处于可审查状态，而不是被擅自猜测。
- `NO_ACTION` 与多个 action 都有无歧义的表示。
- 重试会创建新的 ExtractionRun，但不会复制已确认行动。
- 过期的 `RUNNING` attempt 可见且可恢复。
- Evaluation run 按 model/prompt version 记录 schema validity、field accuracy、refusal-to-guess、evidence validity、latency 和 cost。
- UI 明确说明通知文本会被发送到已配置的 model provider。

### 延后

- 自由运行的 Agent loop。
- Retrieval 与个人记忆。
- PDF 和图片解析。

## 8. 里程碑 V1.3：审查、确认与并发

### 产品成果

用户可以对照来源原文与草稿，编辑不确定字段，并将一个已审查的草稿版本转变为权威的已确认行动。

### 实现

- 并排展示来源原文和草稿以供审查。
- 展示字段级 evidence 与 missing-field 指示。
- 支持草稿编辑和版本历史。
- 提供显式的 confirm 和 ignore 操作。
- 通过条件更新，将同一条 `ActionItem` 记录从 `DRAFT` 改为 `CONFIRMED`；禁止插入第二条已确认 ActionItem。
- 使用 version 值实现 Optimistic Concurrency。
- 如果确有必要维护完整 Audit Table，则为重要状态变更记录 Audit Entry。

### 学习要点

- State Machine。
- Transaction Boundary。
- Optimistic Locking。
- Idempotent Command。
- Append-only History 与可变产品状态的区别。

### 故障实验

- 双击 Confirm。
- 从两个浏览器标签页确认同一份草稿。
- 编辑过期版本。
- 在条件状态更新完成后、关联 history/audit entry 保存前制造失败。
- 客户端丢失响应后重试请求。

### 验收标准

- 一个草稿版本最多只能确认一次。
- 并发的过期写入返回 `409`。
- 确认失败不会留下部分完成的确认状态。
- 确认不会创建重复的 ActionItem 记录。
- 用户确认的字段仍可与模型建议的字段区分。
- 每次状态转换都由 Backend 校验。

## 9. 里程碑 V1.4：Apple Calendar `.ics` 导出

### 产品成果

用户可以预览一个已确认行动，并显式导出 Apple Calendar 能够导入的 `.ics` 文件。

### 实现

- 确定性生成 CalendarDraft。
- 支持有具体时间的 appointment event。
- 支持全天 deadline event。
- 支持默认及用户编辑后的 reminder offset。
- 正确处理 `Europe/Stockholm` 时区。
- 使用稳定的 ICS `UID` 和 event `SEQUENCE`。
- 正确转义文本字段。
- 返回 `text/calendar` HTTP response。
- 保存导出历史，并使用诚实的状态标签。

模型生成结构化 event field；`.ics` 内容由确定性 application code 生成，而不是由模型生成。

### 学习要点

- 只有日期的值与 timestamp 的区别。
- UTC instant 与 IANA timezone name。
- Daylight Saving Time 转换。
- 确定性文件生成。
- Idempotency 与外部系统边界。

### 故障实验

- 重复导出同一个行动。
- 修改事件时间后再次导出。
- 使用处于 Daylight Saving Time 切换点的日期。
- 使用跨越午夜的事件。
- 在文本中使用逗号、分号、反斜杠、Unicode 和换行符。
- 导出没有具体时间的 deadline。

### 验收标准

- Apple Calendar 可以通过人工测试导入代表性文件。
- 重复导出复用同一个逻辑 UID。
- 事件变更后，其 sequence/version 会一致地递增。
- Appointment time 与 all-day deadline 保留各自语义。
- 导出必须由用户显式触发。
- 数据库记录 `EXPORTED`，不能记录虚假的 provider-confirmed creation。

## 10. 里程碑 V1.5：Evaluation 与发布加固

### 产品成果

V1 已足够安全，可供开发者用于低风险的个人通知，并拥有可复现的质量基线。

### 实现

- 扩充有版本控制的 extraction evaluation dataset，并设置 release threshold。
- 添加自动化 schema test 和确定性 ICS test。
- 添加不包含完整通知内容的基本 Structured Log。
- 向用户展示 provider error 和 validation error。
- 为本地数据添加删除流程。
- 在 README 中记录启动和开发说明。

最低 Evaluation 类别：

- 具有开始和结束时间的明确预约。
- 只有日期、没有具体时间的截止事项。
- 需要审查的模糊日期。
- 相互冲突的日期。
- 多个可能的行动。
- 无需行动的通知。
- 英语、瑞典语和中文示例。

### 验收标准

- 从干净数据库开始，完整 V1 路径可以正常运行。
- 重要错误对用户可见且可恢复。
- Evaluation result 记录 model 和 prompt version。
- Safety case 绝不会悄悄创建已确认行动。
- 默认日志不包含完整来源文本或 secret。
- 开发者无需阅读代码即可解释数据流。

## 11. V1 发布定义

只有满足以下条件，V1 才能发布：

- 面向用户的端到端流程可以正常运行。
- 所有 Migration 都能初始化一个全新的数据库。
- 核心 API 行为有 PostgreSQL Integration Test。
- 确定性 Calendar Logic 有聚焦的 Unit Test。
- 至少复现并修复一项并发故障。
- 至少复现并处理一项 LLM 故障。
- 已记录 Evaluation baseline。
- 被延后的功能没有泄漏进 V1 架构。
