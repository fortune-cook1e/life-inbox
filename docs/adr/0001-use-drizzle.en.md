# ADR 0001: Use Drizzle ORM Only; Do Not Use TypeORM

[中文](0001-use-drizzle.md)

| Item          | Value                               |
| ------------- | ----------------------------------- |
| Status        | Accepted                            |
| Decision date | 2026-07-22                          |
| Scope         | LifeInbox backend persistence layer |

## Context

LifeInbox is a project for learning backend and AI-agent engineering. Its persistence layer must expose SQL, schema, migrations, constraints, transactions, indexes, and query-design decisions clearly enough for the developer to learn them.

Using two ORMs would create duplicate configuration and two migration paths without adding product value. The project therefore needs one explicit persistence choice before implementation begins.

## Decision

LifeInbox will use:

- PostgreSQL as the authoritative database.
- Drizzle ORM as the only application ORM.
- `drizzle-kit` for schema diffs and migration generation.
- Drizzle's node-postgres adapter with the existing PostgreSQL `pg` driver.
- One Drizzle configuration unless a concrete requirement proves that more are needed.
- Version-controlled migrations for shared, test, staging, and production environments.

LifeInbox must not install or use TypeORM.

## Recommended layout

```text
apps/api/
├── drizzle.config.ts
├── drizzle/                 # generated SQL migrations and metadata
└── src/
    └── database/
        ├── client.ts        # creates the pool and Drizzle client
        ├── schema/          # tables, constraints, indexes, relations
        └── transaction.ts   # only when a shared helper is genuinely needed
```

The runtime `database` directory is a first-class application boundary and must not be hidden in a generic `lib` directory.

## Migration strategy

- `db:generate` creates migrations from reviewed schema changes.
- `db:migrate` applies committed migrations.
- `db:check` checks schema/migration consistency when supported by the selected Drizzle version.
- `db:studio` is a development inspection tool.
- `db:push` is allowed only as an explicitly chosen local-development convenience.
- Production uses committed, reviewed migrations and must never use `db:push`.

Exact package versions and commands are finalized in V1.0 against the current official Drizzle documentation.

## Consequences

### Benefits

- Schema and SQL decisions remain visible.
- Database constraints and indexes are directly reviewable.
- Transaction boundaries stay explicit in service code.
- The project has one migration history and one schema source of truth.
- PostgreSQL full-text search and pgvector remain directly available.

### Costs

- NestJS integration must be written explicitly instead of relying on a large framework module.
- Repository boundaries and transaction propagation require deliberate design.
- Generated SQL must be understood rather than treated as a black box.

These costs are valuable for this learning project.

## Rejected alternatives

### TypeORM only

Rejected. The project has chosen Drizzle's explicit, schema- and SQL-oriented workflow.

### Drizzle and TypeORM together

Rejected. Two entity, connection, transaction, migration, and query styles would create conflicting sources of truth.

### Raw SQL only

Rejected initially. Current query complexity does not justify repetitive mapping work. Measured queries may still use raw SQL through Drizzle when necessary.

## Verification

V1.0 is complete only when:

- `drizzle-orm`, `drizzle-kit`, and `pg` are configured.
- No TypeORM package or import exists.
- A migration can initialize an empty PostgreSQL database.
- The test database is initialized from the same committed migrations.
- At least one NestJS integration test runs a real query such as `SELECT 1` through Drizzle; the first product table arrives in V1.1.
- Development and production migration commands are documented separately.
