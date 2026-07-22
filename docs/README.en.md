# LifeInbox Documentation

[中文](README.md)

| Item           | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| Status         | Design in progress                                              |
| Product        | LifeInbox                                                       |
| Primary user   | An individual managing everyday notices                         |
| V1 outcome     | Paste notice -> review AI draft -> export Apple Calendar `.ics` |
| Backend        | Next.js, NestJS, PostgreSQL, Drizzle ORM                        |
| Delivery model | Modular monolith, one vertical slice at a time                  |

## Product statement

LifeInbox turns everyday notices into reviewable actions. It preserves the original source, extracts dates and next steps, asks for clarification when necessary, and helps the user schedule confirmed actions in Apple Calendar.

The scope stays focused:

> Life notice -> confirmed action -> Apple Calendar -> later updates.

It is not a general-purpose personal assistant.

## Reading and review order

Review one document at a time. Later documents may depend on earlier decisions but must not silently change them.

1. [Product scope and principles](01-product-scope.en.md)
2. [A simple first version: V1 roadmap](02-v1-roadmap.en.md)
3. [Advanced roadmap](03-advanced-roadmap.en.md)
4. [Backend learning map](04-backend-learning-map.en.md)
5. [AI and agent learning map](05-ai-agent-learning-map.en.md)
6. [Milestone workflow and definition of done](06-milestone-method.en.md)
7. [ADR 0001: Use Drizzle, not TypeORM](adr/0001-use-drizzle.en.md)

## Locked decisions

These decisions are closed unless a new ADR changes them:

- Drizzle ORM is the only application ORM.
- TypeORM is outside this project and must not be installed.
- PostgreSQL is the source of truth.
- The backend starts as a NestJS modular monolith.
- V1 accepts pasted text and exports Apple Calendar `.ics` files.
- Redis is introduced only when background jobs require it.
- pgvector is introduced only after ordinary search and retrieval debugging exist.
- A native Apple EventKit companion is optional and comes only after the web product proves useful.
- AI output is a draft; only user-confirmed product state is authoritative.

## Version overview

| Version     | Product outcome                                    | Main learning outcome                                                 |
| ----------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| V1          | Text notice -> reviewed action -> `.ics` export    | HTTP, Drizzle, PostgreSQL, testing, structured AI output              |
| V2          | Secure personal account and clarification workflow | Authentication, authorization, concurrency, persistent workflow state |
| V3          | Screenshots/PDFs, background processing, reminders | Files, object storage, queues, workers, retries, idempotency          |
| V4          | Relate new notices to personal history             | Search, pgvector, RAG, retrieval evaluation                           |
| V5          | Bounded, stateful LifeInbox agent                  | Tools, checkpoints, pause/resume, budgets, approvals                  |
| V6          | Safe and diagnosable production system             | Logs, metrics, traces, deployment, backups, privacy                   |
| Optional V7 | Direct Apple Calendar integration                  | Native EventKit, external side effects, eventual consistency          |

## How to use these documents

Before starting a milestone:

1. Review only that milestone and its prerequisites.
2. Write its five-line feature card.
3. Decide the invariants and failure experiment.
4. Implement the smallest happy path.
5. Do not start the next milestone until the acceptance test passes.

These documents are planning artifacts. They intentionally do not contain application scaffolding or a full implementation.
