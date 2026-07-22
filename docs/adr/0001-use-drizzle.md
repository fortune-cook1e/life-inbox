# ADR 0001：仅使用 Drizzle ORM，禁止使用 TypeORM

[English](0001-use-drizzle.en.md)

| 项目     | 值                         |
| -------- | -------------------------- |
| 状态     | Accepted                   |
| 决策日期 | 2026-07-22                 |
| 范围     | LifeInbox Backend 持久化层 |

## 背景

LifeInbox 是一个用于学习 Backend 和 AI Agent 工程的项目。持久化层必须足够清楚地暴露 SQL、Schema、Migration、Constraint、Transaction、Index 和 Query Design 决策，以便开发者真正学习这些内容。

同时使用两个 ORM 会产生重复配置和两套 Migration 路径，却不会增加产品价值。因此，项目必须在实现开始之前明确选择唯一的持久化方案。

## 决策

LifeInbox 将使用：

- PostgreSQL 作为权威数据库。
- Drizzle ORM 作为唯一的应用层 ORM。
- 使用 `drizzle-kit` 进行 Schema Diff 和 Migration Generation。
- 通过 Drizzle 的 node-postgres adapter 使用现有 PostgreSQL `pg` driver。
- 只维护一个 Drizzle 配置，除非具体需求能够证明需要更多配置。
- 为 shared、test、staging 和 production 环境维护有版本控制的 Migration。

LifeInbox 禁止安装或使用 TypeORM。

## 建议目录布局

```text
apps/api/
├── drizzle.config.ts
├── drizzle/                 # 生成的 SQL migration 与 metadata
└── src/
    └── db/
        ├── client.ts        # 创建 pool 与 Drizzle client
        ├── schema/          # table、constraint、index、relation
        └── transaction.ts   # 只有真正需要共享 helper 时才创建
```

运行时 `db` 目录是一级应用边界，不应被隐藏在通用的 `lib` 目录中。

## Migration 策略

- `db:generate` 根据经过审查的 Schema 变更创建 Migration。
- `db:migrate` 应用已经提交的 Migration。
- 如果所选 Drizzle 版本支持，`db:check` 用于检查 Schema 和 Migration 一致性。
- `db:studio` 是开发阶段的检查工具。
- `db:push` 只能作为经过明确考虑的本地开发便利工具使用。
- 生产环境必须使用已提交、经过审查的 Migration；生产环境禁止使用 `db:push`。

Migration 命令和精确 package version 将在 V1.0 中，根据届时最新的 Drizzle 官方文档最终确定。

## 后果

### 收益

- Schema 和 SQL 决策保持可见。
- 可以直接审查数据库 Constraint 和 Index。
- Transaction Boundary 在 Service Code 中保持显式。
- 项目只有一份 Migration History 和一个 Schema Source of Truth。
- PostgreSQL Full-text Search 和 pgvector 等能力仍可直接使用。

### 成本

- 必须显式创建 NestJS Integration，而不是依赖大型 Framework Integration Module。
- Repository Boundary 与 Transaction Propagation 需要经过认真设计。
- 开发者必须理解生成的 SQL，而不能把 Migration 当成黑箱。

对于这个学习项目，这些成本是有价值的。

## 被拒绝的替代方案

### 只使用 TypeORM

拒绝。项目已经决定学习并使用 Drizzle 显式、以 Schema 和 SQL 为导向的工作流。

### 同时使用 Drizzle 和 TypeORM

拒绝。两套 Entity、Connection、Transaction、Migration 和 Query Style 会产生互相冲突的 Source of Truth。

### 只使用 Raw SQL

初始阶段拒绝。此时产品的 Query Complexity 还不足以证明大量重复 Mapping 工作具有价值。当经过测量的 Query 确有需要时，仍可以通过 Drizzle 使用 Raw SQL。

## 验证

只有满足以下条件，V1.0 才算完成：

- 已配置 `drizzle-orm`、`drizzle-kit` 和 `pg`。
- 不存在任何 TypeORM package 或 import。
- 一项 Migration 可以初始化空的 PostgreSQL 数据库。
- 测试数据库通过同一份已提交的 Migration 完成初始化。
- 至少一项 NestJS Integration Test 通过真实 Drizzle Connection 执行查询，例如 `SELECT 1`；第一张产品数据表从 V1.1 开始引入。
- 开发和生产环境的 Migration 命令被分别记录。
