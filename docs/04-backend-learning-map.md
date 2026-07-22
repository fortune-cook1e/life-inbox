# LifeInbox Backend 学习地图

[English](04-backend-learning-map.en.md)

## 1. 学习目标

Backend 学习的目标不是记住一串术语。只有当开发者能够完成以下事情时，才算真正学会一个主题：

1. 解释是什么产品需求使它成为必要能力。
2. 复现缺少这项能力时会发生的故障。
3. 设计并实现修正方案。
4. 通过自动化测试证明关键行为正确。
5. 在相邻功能中复用这个思路。

因此，LifeInbox 通过产品垂直切片逐步引入 Backend 能力，而不是采用与产品脱离的孤立课程表。

## 2. 架构演进

### V1

```text
Next.js Web
-> NestJS API
-> PostgreSQL + Drizzle
-> LLM provider
-> 确定性的 .ics 生成
```

### V3

```text
Next.js Web
-> NestJS API
-> PostgreSQL + Drizzle
-> Object Storage
-> Redis Queue
-> 来自同一代码库的 Worker 和 Scheduler
```

### V4 和 V5

```text
PostgreSQL + pgvector
-> Retrieval 与 Evaluation
-> 持久化的 Agent run、step、tool 和 checkpoint
```

系统始终保持模块化单体。进程分离不代表服务分离，也不代表使用独立数据库。

## 3. 能力地图

| Backend 主题         | 产品需求                                  | 首次引入版本         | 学习证明                                   |
| -------------------- | ----------------------------------------- | -------------------- | ------------------------------------------ |
| HTTP 语义            | 创建、审查、确认和完成事项                | V1.1-V1.3            | 正确的 status code 和 API Integration Test |
| Validation           | 接受不完整草稿，但拒绝非法确认            | V1.1b/V1.3           | 依赖状态的规则有自动化测试                 |
| PostgreSQL Schema    | 先保存来源原文，再保存草稿                | V1.1/V1.1b           | Constraint 能拒绝非法状态                  |
| Drizzle ORM          | 显式表达 Schema 和 Query                  | V1.0                 | 空数据库 Migration 加真实 Query Test       |
| Migration            | 在不同环境中复现 Schema                   | V1.0                 | 全新数据库可以到达当前版本                 |
| Transaction          | 原子地确认一个权威行动                    | V1.3                 | 在操作中途强制失败后不留下部分状态         |
| Concurrency          | 两个标签页编辑同一份草稿                  | V1.3                 | 过期版本产生 `409`                         |
| Idempotency          | 重试提取、确认、导出、Job 和提醒          | V1.3 起              | 重复 command 只有一个逻辑业务结果          |
| 时间建模             | 预约、只有日期的截止日和 DST              | V1.4                 | 时区与切换点测试用例                       |
| Authentication       | 跨设备访问私人通知                        | V2                   | 过期和伪造 Session 安全失败                |
| Authorization        | 用户只能访问个人数据                      | V2                   | 跨用户 Integration Test                    |
| Pagination           | 跨设备同步不断增长的 Inbox 历史           | V2                   | 并发插入时仍保持稳定 Cursor 排序           |
| Rate Limiting        | 限制模型成本和滥用                        | V2                   | 突发请求受到限制且不破坏状态               |
| 文件处理             | 接收截图和 PDF                            | V3                   | 文件类型、大小与内容 Validation Test       |
| Object Storage       | 在数据库之外保存原始文件                  | V3                   | 孤儿对象与部分上传恢复                     |
| Queue 与 Worker      | 在 HTTP 生命周期之外解析和提取            | V3                   | Worker 崩溃与重复投递测试                  |
| Retry/Backoff        | 从临时 Model/OCR 故障中恢复               | V3                   | 临时故障与永久故障具有不同行为             |
| Scheduled Job        | 在截止日期前提醒                          | V3                   | 重复 Scheduler 与错过时间窗口测试          |
| Transactional Outbox | 可靠触发外部通知 provider                 | 可选 V3.5            | 在 Commit 与 Dispatch 之间崩溃后能够恢复   |
| Search 与 Index      | 查找相关个人历史                          | V4                   | Query Plan 与 Retrieval Case               |
| pgvector             | 语义相关事项检索                          | V4                   | 限定用户范围的 Vector Query 和 Recall Test |
| 持久化状态           | 暂停和恢复 Agent 工作                     | V5                   | 重启与重复 Resume Test                     |
| Tool Authorization   | 限制 Agent 能力                           | V5                   | 未知和未授权 Tool 被拒绝                   |
| Audit History        | 解释重要状态和 Tool 变更                  | V5                   | Timeline 能重建完整 Run                    |
| Observability        | 诊断 Request、Job、Retrieval 和 Agent Run | V1 起                | ID 和信号随每个异步边界逐步增加            |
| Deployment           | 安全地跨设备运行                          | V2 最小部署，V6 加固 | 先实现 HTTPS 发布，之后进行 Rollback 演练  |
| Backup/Restore       | 保护私人产品状态                          | V2 基线，V6 演练     | 先启用托管 Backup，之后实际执行 Restore    |
| Performance          | 优化经过测量的瓶颈                        | V6                   | 优化前后的 Load 与 Query 测量              |

## 4. Drizzle 学习路线

Drizzle 是本项目唯一的 ORM。学习目标既包括 Drizzle API，也包括其底层的 PostgreSQL 行为。

### V1.0：配置与 Migration

学习：

- `drizzle.config.ts` 如何定位 Schema 与 Migration。
- 如何创建 PostgreSQL Pool 和 Drizzle Client。
- Schema 变更如何生成 SQL Migration。
- 开发、测试和生产环境的 Migration 流程有何不同。
- 为什么 `db:push` 不是生产环境的 Deployment 流程。

验收标准：

- 一个配置文件已经足够。
- Migration 能初始化空数据库。
- 测试使用已提交的 Migration。
- 执行前必须审查生成的 SQL。

### V1.1：Schema 与 Constraint

学习：

- UUID 或其他 Identifier 策略。
- Foreign Key 与删除行为。
- `NOT NULL`、`UNIQUE` 和 `CHECK` Constraint。
- 根据 Query Pattern 证明 Index 的必要性。
- Drizzle relation 与真实数据库 constraint 的区别。

重要原则：

> TypeScript relation 改善 Query 的开发体验；PostgreSQL constraint 保护数据正确性。

### V1.3：Transaction 与 Concurrency

学习：

- Transaction 在哪里开始、在哪里结束。
- 如何在相关 Service Operation 中传递 Transaction Object。
- 为什么不能把 LLM 和文件 provider 调用放入长时间持有的 Transaction。
- Optimistic Concurrency 如何在 Update Condition 中使用 version。
- 如何检测一项影响零行的 Update。

### V3：对 Worker 安全的 Idempotency

学习：

- 唯一 Business Key。
- Insert-on-conflict 行为。
- 数据库 Constraint 是防止重复投递的最后一道防线。
- Job Attempt History 与一个逻辑 Business Job 的区别。
- 只有当外部通知 provider 产生 Dual-write 需求后，才在保存产品状态的同一个 Transaction 中写入 Outbox Row。

### V4：Search、Index 与 pgvector

学习：

- 先实现 PostgreSQL Full-text Search，再实现 Vector Search。
- 通过已提交的 Custom Migration 或显式环境 Preflight，在开发、测试、CI 和生产环境中配置 pgvector extension。
- Vector Dimension 与 Embedding Version 生命周期。
- Similarity Query 中的 Tenant/User Filter。
- 只有当 Corpus Size 确实需要时，才讨论 Approximate Search 与 Exact Search 的取舍。
- `EXPLAIN` 与基于测量结果的 Query Performance。

## 5. 建议的模块边界

随里程碑开始逐步引入模块：

```text
apps/api/src/
├── db/
├── inbox/
├── actions/
├── extraction/
├── calendar-export/
├── auth/                  # V2
├── files/                 # V3
├── jobs/                  # V3
├── reminders/             # V3
├── retrieval/             # V4
└── agent/                 # V5
```

模块应当负责有意义的产品能力，而不是只对应某种技术 class type。不要在第一天创建所有目录。

## 6. 错误模型

需要不同行为的错误必须被区分：

| 错误类型                | 示例                  | 预期行为                             |
| ----------------------- | --------------------- | ------------------------------------ |
| Validation              | 不可能存在的日期      | 返回 `400`，不写入数据               |
| Not Found               | Action 不存在         | 返回 `404`                           |
| Conflict                | 草稿 version 已过期   | 返回 `409`                           |
| Unauthorized            | Session 缺失或过期    | 返回 `401`                           |
| Forbidden               | 请求其他用户的 Item   | 根据防泄漏策略返回 `404` 或 `403`    |
| Temporary Dependency    | Model timeout         | 展示可重试失败                       |
| Permanent Input         | 不支持的加密 PDF      | 展示终止性失败                       |
| Unknown External Result | Delivery 可能已经成功 | 重试前先进行 Reconciliation          |
| Internal Invariant      | 不可能的状态转换      | 拒绝操作、记录 Correlation ID 并调查 |

不要把所有故障都压缩成 `500`，也不要自动重试每一种错误。

## 7. 测试策略

### Unit Test

用于确定性逻辑：

- 时间和时区规范化。
- Action 状态转换规则。
- `.ics` 转义和生成。
- Idempotency Key 推导。
- 与 Prompt 无关的 Schema Guard。

### PostgreSQL Integration Test

用于：

- Drizzle Query。
- Constraint 与 relation。
- Transaction 与 Rollback。
- Concurrency 与 Optimistic Locking。
- Authorization Filter。
- Idempotent Insert 与 Outbox 行为。

禁止用 Mock Repository 代替这些测试。

### API Integration/E2E Test

用于：

- DTO Validation。
- HTTP status 和 response shape。
- Session 行为。
- 完整的用户可见路径。

### Worker Integration Test

从 V3 开始用于：

- 重复投递。
- Crash Recovery。
- Retry Classification。
- Terminal Failure。

### Failure-injection Test

每个里程碑都至少包含一次刻意制造的故障；在修复前，该故障应当能够造成不正确状态。

## 8. 安全演进

### V1：仅限本地

- Secret 不得进入 Source Control。
- 避免使用高风险通知。
- 从日志中 Redact 来源内容。
- 使用严格的输入上限。
- 明确说明通知文本会被发送到已配置的第三方 Model Provider。
- 审查 Provider Retention Setting，并隔离开发环境 Credential。

### V2：远程个人产品

- Secure Session 与 CSRF 防御。
- Owner-scoped Query。
- Rate Limit 与 Cost Limit。
- 账户删除。
- HTTPS、生产 Secret Storage、显式 Migration Release，以及托管数据库的基础 Backup。

### V3：文件

- 验证文件内容，而不只是扩展名。
- 私有 Object Storage 和短期有效的 Signed URL。
- 根据支持的文件格式，进行相应程度的 Malware 与 Parser Risk 审查。
- 孤儿对象清理与 Retention。

### V4/V5：Retrieval 与 Agent

- 将每条通知和每个检索到的 Chunk 都视为不可信内容。
- 在 Backend Tool 中强制限定用户范围。
- 对 Tool 使用 Allowlist，并校验 Parameter。
- 所有写入和 External Effect 都需要用户确认。

## 9. Observability 演进

Observability 应当从它需要解释的能力出现时开始：

- **V1：** Structured Log、Request ID、Extraction Run ID、Latency、Token、Cost 与 Redaction。
- **V3：** Processing Job ID、Attempt、Queue Age、Retry Count、Terminal Failure 与 Scheduler Lag。
- **V4：** Retrieval Run ID、Query/Filter、Result Identifier、Score 与 Index Version。
- **V5：** Agent Run/Step Correlation、Tool Result、Stop Reason 与 Budget。
- **V6：** 集中式 Metric、Distributed Trace、Dashboard、Alert 与 SLO。

不要把理解早期故障实验所需的 ID 和状态转换日志推迟到 V6。

## 10. Performance 演进

Performance 工作应以测量结果为依据：

1. 记录 Baseline。
2. 检查 Query Pattern 和 Plan。
3. 修正 Schema、Index 或 Query 行为。
4. 检查 Connection Pool 和 Worker Concurrency。
5. 只有测量后仍存在瓶颈时才添加 Cache。
6. 启用 Cache 前定义 TTL、Invalidation 和 Fallback。

Redis 不是产品的 Source of Truth。Redis 故障可以降低吞吐量，但不得破坏 PostgreSQL 状态。

## 11. 应由开发者亲自决定的事项

实现前，开发者应当亲自作出并解释以下选择：

- Identifier 策略。
- 精确的 ActionItem Invariant。
- 只有日期与 Timestamp 的语义区别。
- Transaction Boundary。
- Optimistic Locking 机制。
- Idempotency Key 的作用域和保留期。
- Retryable Error 与 Permanent Error 的分类。
- 文件生命周期和删除策略。
- Reminder Delivery Guarantee。
- Agent Tool Permission Policy。
- Evaluation 和 Production Release Threshold。

Codex 可以提出选项、测试和审查意见，但这些决定是核心学习证据，不应被悄悄委托出去。
