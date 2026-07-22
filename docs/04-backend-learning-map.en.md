# LifeInbox Backend Learning Map

[中文](04-backend-learning-map.md)

## 1. Learning objective

Backend learning is not memorizing terms. A topic is learned only when the developer can:

1. Explain which product need makes it necessary.
2. Reproduce the failure caused by its absence.
3. Design and implement the correction.
4. Prove important behavior with automated tests.
5. Reuse the idea in an adjacent feature.

LifeInbox therefore introduces backend capabilities through product vertical slices rather than an isolated curriculum.

## 2. Architecture evolution

### V1

```text
Next.js Web
-> NestJS API
-> PostgreSQL + Drizzle
-> LLM provider
-> deterministic .ics generation
```

### V3

```text
Next.js Web
-> NestJS API
-> PostgreSQL + Drizzle
-> Object Storage
-> Redis Queue
-> Worker and Scheduler from the same codebase
```

### V4 and V5

```text
PostgreSQL + pgvector
-> Retrieval and Evaluation
-> persisted Agent run, step, tool, and checkpoint
```

The system remains a modular monolith. Process separation does not imply service separation or independent databases.

## 3. Capability map

| Backend topic            | Product need                                            | First version | Evidence of learning                                   |
| ------------------------ | ------------------------------------------------------- | ------------- | ------------------------------------------------------ |
| HTTP semantics           | Create, review, confirm, complete                       | V1.1-V1.3     | Correct status codes and API integration tests         |
| Validation               | Allow incomplete drafts, reject invalid confirmation    | V1.1b/V1.3    | State-dependent rules are tested                       |
| PostgreSQL schema        | Save sources before drafts                              | V1.1/V1.1b    | Constraints reject invalid state                       |
| Drizzle ORM              | Explicit schemas and queries                            | V1.0          | Fresh migration plus real query test                   |
| Migrations               | Reproduce schema across environments                    | V1.0          | Fresh database reaches current version                 |
| Transactions             | Atomically confirm an authoritative action              | V1.3          | Injected mid-operation failure leaves no partial state |
| Concurrency              | Two tabs edit one draft                                 | V1.3          | Stale version returns `409`                            |
| Idempotency              | Retry extraction, confirmation, export, jobs, reminders | V1.3+         | Duplicate command has one logical result               |
| Time modeling            | Appointments, date-only deadlines, DST                  | V1.4          | Time-zone transition tests                             |
| Authentication           | Private cross-device access                             | V2            | Expired/forged sessions fail safely                    |
| Authorization            | User accesses only personal data                        | V2            | Cross-user integration tests                           |
| Pagination               | Growing synchronized history                            | V2            | Stable cursors under concurrent inserts                |
| Rate limiting            | Bound abuse and model cost                              | V2            | Bursts are limited without corrupting state            |
| Files and object storage | Screenshots and PDFs                                    | V3            | Content validation and orphan recovery                 |
| Queue and workers        | Work beyond HTTP lifetime                               | V3            | Crash and duplicate-delivery tests                     |
| Retry/backoff            | Temporary model/OCR failures                            | V3            | Temporary and permanent failures diverge               |
| Scheduling               | Reminder delivery                                       | V3            | Duplicate scheduler and missed-window tests            |
| Transactional outbox     | Reliable external notification                          | Optional V3.5 | Recovery between commit and dispatch                   |
| Search/indexes           | Find personal history                                   | V4            | Query plan and retrieval cases                         |
| pgvector                 | Semantic related-item retrieval                         | V4            | User-scoped vector query and recall tests              |
| Persistent state         | Pause/resume agent work                                 | V5            | Restart and duplicate-resume tests                     |
| Tool authorization       | Bound agent capabilities                                | V5            | Unknown/unauthorized tools rejected                    |
| Audit history            | Explain state/tool changes                              | V5            | Timeline reconstructs a run                            |
| Observability            | Diagnose requests, jobs, retrieval, agents              | V1+           | IDs/signals grow with async boundaries                 |
| Deployment               | Safe cross-device operation                             | V2/V6         | HTTPS release then rollback exercise                   |
| Backup/restore           | Protect private state                                   | V2/V6         | Managed backups then real restore                      |
| Performance              | Optimize measured bottlenecks                           | V6            | Before/after load and query measurements               |

## 4. Drizzle learning path

Drizzle is the only ORM. Learning includes both its API and underlying PostgreSQL behavior.

### V1.0: configuration and migrations

Learn how config locates schema/migrations, how pool/client creation works, how changes generate SQL, how environment workflows differ, and why `db:push` is not production deployment.

Acceptance: one config is enough; migrations initialize an empty database; tests use committed migrations; generated SQL is reviewed before execution.

### V1.1: schema and constraints

Learn identifier strategy, foreign keys/deletion, `NOT NULL`/`UNIQUE`/`CHECK`, evidence-based indexes, and the difference between Drizzle relations and database constraints.

> TypeScript relations improve query ergonomics; PostgreSQL constraints protect correctness.

### V1.3: transactions and concurrency

Learn transaction boundaries and propagation, why LLM/file calls stay outside long transactions, versioned optimistic updates, and zero-row update detection.

### V3: worker-safe idempotency

Learn unique business keys, insert-on-conflict, constraints as the last duplicate-delivery defense, logical jobs versus attempt history, and outbox rows only when a real external dual-write exists.

### V4: search, indexes, and pgvector

Learn full-text search before vectors, extension setup in every environment, vector dimensions and embedding-version lifecycle, user filters in similarity queries, exact versus approximate search only at meaningful corpus size, and measured performance through `EXPLAIN`.

## 5. Recommended module boundaries

Add modules only when their milestone begins:

```text
apps/api/src/
├── database/
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

Modules represent product capabilities, not technical class types. Do not create every directory on day one.

## 6. Error model

| Error type              | Example                     | Expected behavior                       |
| ----------------------- | --------------------------- | --------------------------------------- |
| Validation              | Impossible date             | `400`, no write                         |
| Not Found               | Missing action              | `404`                                   |
| Conflict                | Stale draft version         | `409`                                   |
| Unauthorized            | Missing/expired session     | `401`                                   |
| Forbidden               | Another user's item         | `404` or `403` per anti-leak policy     |
| Temporary Dependency    | Model timeout               | Visible retryable failure               |
| Permanent Input         | Unsupported encrypted PDF   | Visible terminal failure                |
| Unknown External Result | Delivery may have succeeded | Reconcile before retry                  |
| Internal Invariant      | Impossible transition       | Reject, log correlation ID, investigate |

Do not collapse every failure into `500`, and do not retry every error automatically.

## 7. Testing strategy

### Unit tests

Deterministic time normalization, action transitions, `.ics` escaping/generation, idempotency-key derivation, and prompt-independent schema guards.

### PostgreSQL integration tests

Drizzle queries, constraints/relations, transactions/rollbacks, concurrency/locking, authorization filters, idempotent inserts, and outbox behavior. Mock repositories must not replace these tests.

### API integration/E2E tests

DTO validation, HTTP status/shape, sessions, and complete user-visible paths.

### Worker integration tests

From V3: duplicate delivery, crash recovery, retry classification, and terminal failure.

### Failure-injection tests

Every milestone deliberately reproduces at least one correctness failure before fixing it.

## 8. Security evolution

### V1: local only

No secrets in source control; avoid high-risk notices; redact source content; enforce input limits; disclose third-party model transfer; review provider retention and isolate development credentials.

### V2: remote personal product

Secure sessions, CSRF defense, owner-scoped queries, rate/cost limits, account deletion, HTTPS, production secret storage, explicit migration releases, and managed backups.

### V3: files

Validate content rather than extension alone; private object storage and short-lived signed URLs; appropriate malware/parser review; orphan cleanup and retention.

### V4/V5: retrieval and agents

Treat notices/chunks as untrusted; enforce user scope in backend tools; allowlist tools and validate parameters; require user confirmation for all writes and external effects.

## 9. Observability evolution

- **V1:** structured logs, request/extraction IDs, latency, tokens, cost, redaction.
- **V3:** job ID/attempt, queue age, retries, terminal failures, scheduler lag.
- **V4:** retrieval run, query/filter, result IDs, scores, index version.
- **V5:** agent run/step correlation, tool result, stop reason, budget.
- **V6:** centralized metrics, traces, dashboards, alerts, SLOs.

Do not postpone IDs and state-transition logs needed to understand early failure experiments.

## 10. Performance evolution

1. Record a baseline.
2. Inspect query patterns and plans.
3. Correct schema, index, or query behavior.
4. Inspect pool and worker concurrency.
5. Add cache only if a measured bottleneck remains.
6. Define TTL, invalidation, and fallback first.

Redis is not the source of truth. Its failure may reduce throughput but must not corrupt PostgreSQL state.

## 11. Decisions the developer must own

Identifier strategy, exact action invariants, date versus timestamp semantics, transaction boundaries, optimistic locking, idempotency-key scope/retention, retry classification, file lifecycle/deletion, reminder guarantees, agent tool permissions, and evaluation/release thresholds.

Codex may propose options, tests, and review feedback, but these choices are core learning evidence and must not be silently delegated.
