# LifeInbox Documentation

[中文](README.md)

| Item           | Description                                                                          |
| -------------- | ------------------------------------------------------------------------------------ |
| Status         | Design in progress                                                                   |
| Product        | LifeInbox                                                                            |
| Primary user   | An individual managing everyday notices                                              |
| V1 outcome     | Talk to Agent -> complete evidence -> confirm Event Card -> explicitly export `.ics` |
| Stack          | Next.js, NestJS, PostgreSQL, Drizzle ORM                                             |
| Delivery model | Modular monolith, one vertical slice at a time                                       |

## Product statement

LifeInbox turns everyday notices into evidence-backed, confirmable Events. The user always uses one Agent chat to express intent, paste external source material, answer clarification questions, and review an Event Preview Card. Behind the chat, the system preserves original sources, internal `LifeCase` records, and structured state, then helps export confirmed Events to Apple Calendar. `LifeCase` is the canonical domain and implementation name; the documents use `Case` as shorthand when the meaning is clear.

The scope stays focused:

> Life notice -> confirmed Event -> Apple Calendar -> later updates.

It is not an unbounded general-purpose personal assistant.

## Interaction model

V1 uses three mutually reinforcing principles:

- **Single-chat**: `Agent` is the only conversation entry point. Users never view or switch Cases; unfinished matters return through resume cards in the global chat.
- **Card-confirmed**: a chat summary is not final fact. Blocking issues are resolved in Draft Progress. After the deterministic completeness gate passes, important fields, evidence, warnings, and accepted defaults appear in a confirmable Event Preview Card. Official fields become authoritative only when the user confirms the exact Event version.
- **Internally case-scoped**: one visible chat does not mean one global LLM context. The backend still isolates source material, message evidence, Event state, and model context by internal Case. Dates, locations, or answers never leak silently between matters.

Chat is the control surface, not the data model. `ChatMessage` records form the global user-visible timeline. `LifeCase`, `InboxItem`, `Event`, field evidence, user changes, and export records remain structured state.

Surfaces arrive in stages: the initial product has only `Agent` and `Settings`; after confirmation is reliable, an `Events` tab shows only Events that crossed the confirmation boundary—those currently `CONFIRMED`, plus formerly confirmed Events now `CANCELLED`. Users never see, create, select, or switch `LifeCase` or `InboxItem`.

The V1 “agent” is a bounded, fixed orchestration flow: extract, validate, clarify, propose, confirm, and export. It does not dynamically select arbitrary tools or create unapproved external side effects. A dynamic tool loop with budgets and approval boundaries belongs to V5.

## Reading and review order

Review one document at a time. Later documents may depend on earlier decisions but must not silently change them.

1. [Product scope and principles](01-product-scope.en.md)
2. [ADR 0003: Use one Agent Chat, internal Cases, and a single-Event model](adr/0003-single-chat-internal-cases.en.md)
3. [ADR 0002: Previous Conversation-first, Card-confirmed, Case-organized model (historical, superseded by ADR 0003)](adr/0002-conversation-first-interaction.en.md)
4. [ADR 0001: Use Drizzle, not TypeORM](adr/0001-use-drizzle.en.md)
5. [A simple first version: V1 roadmap](02-v1-roadmap.en.md)
6. [Advanced roadmap](03-advanced-roadmap.en.md)
7. [Backend learning map](04-backend-learning-map.en.md)
8. [AI and agent learning map](05-ai-agent-learning-map.en.md)
9. [Milestone workflow and definition of done](06-milestone-method.en.md)

## Locked decisions

These decisions are closed unless a new ADR changes them:

- Drizzle ORM is the only application ORM.
- TypeORM is outside this project and must not be installed.
- PostgreSQL is the source of truth.
- The backend starts as a NestJS modular monolith.
- V1 accepts pasted text and exports Apple Calendar `.ics` files.
- The initial product exposes only `Agent` and `Settings`; a later `Events` tab shows Events currently `CONFIRMED` or formerly confirmed and now `CANCELLED`.
- Users never see, create, select, or switch `Case` or `InboxItem`; unfinished matters return through resume cards in chat.
- A `LifeCase` (`Case` for short) is one internal concrete matter with zero or more immutable `InboxItem` records, zero or more linked `ChatMessage` records, and zero or one `Event`; a directly expressed matter may use ChatMessage evidence only.
- `ChatMessage` records form the global timeline and may have a nullable `caseId`; a model call still receives only the bounded target-Case context.
- `InboxItem` represents external source material only; clarification answers remain `ChatMessage` evidence.
- Conversation never replaces structured state or field-level source evidence.
- When information is incomplete, the system asks one confirmation-blocking question at a time.
- Event combines candidate and authoritative state; there is no separate `EventDraft`. Its statuses are `COLLECTING`, `READY`, `CONFIRMED`, `IGNORED`, and `CANCELLED`.
- Only an exact Event version that passes the blocking gate appears as a confirmable Event Preview Card, and the user confirms it explicitly.
- A proposed operation on a confirmed Event uses the embedded pending area: updates put their proposed field diff in `pendingChanges`; cancellations have no field diff and use only `pendingOperation`, `pendingEvidence`, and `pendingStatus`. Official fields remain unchanged before acceptance.
- Confirming an Event and exporting it to a calendar are separate operations; the system does not automatically export or write events.
- Redis is introduced only when background jobs require it.
- pgvector is introduced only after ordinary search and retrieval debugging exist.
- A native Apple EventKit companion is optional and comes only after the web product proves useful.
- AI output is a draft; only user-confirmed product state is authoritative.
- V1 uses fixed workflow orchestration rather than an autonomous agent loop; dynamic tool selection waits until V5.
- ADR 0003 locks the current interaction and domain boundaries; ADR 0002 remains only as design history.

## Version overview

| Version     | Product outcome                                    | Main learning outcome                                                 |
| ----------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| V1          | One Agent chat -> confirmed Event -> `.ics` export | HTTP, Drizzle, PostgreSQL, testing, structured AI output              |
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
