# LifeInbox Backend Learning Map

[中文](04-backend-learning-map.md)

## 1. Learning objective

This map serves one product rather than listing unrelated backend topics. Every capability must
answer:

- Which user-visible behavior does it support?
- Which data invariant does it protect?
- How can failure be reproduced before adding it?
- Which automated test independently proves the fix?

LifeInbox adds capabilities through vertical slices. V1 first proves the deterministic loop from
global Agent chat to an authoritative Event. Redis, pgvector, queues, and model-selected tools arrive
only when a product gate requires them.

## 2. Architecture evolution

### Canonical product and internal model

Ordinary users see only:

```text
Agent      # one global ChatMessage feed and the primary interaction
Events     # authoritative CONFIRMED/CANCELLED Events only
Settings   # preferences and data controls
```

Internal data boundaries:

```text
ChatMessage.caseId is nullable

LifeCase = one concrete matter
LifeCase 1 -> 0..* immutable InboxItem
LifeCase 1 -> 0..1 Event
Event.caseId is NOT NULL + UNIQUE

Event.status =
  COLLECTING | READY | CONFIRMED | IGNORED | CANCELLED
```

The global feed and model context are separate boundaries. A ChatMessage may have no Case, but every
extraction, clarification, or agent run resolves one explicit Case and builds a prompt from only that
Case's data.

Creation semantics are distinct:

```text
NEW_MATTER = direct user intent; ChatMessage is evidence and no InboxItem is created
NEW_SOURCE = external raw material; resolve one explicit Case, then persist an immutable InboxItem
```

`InboxItem` means external material only; it is not a generic input record required by every LifeCase.

### V1

```text
Next.js Agent + Events + Settings
-> NestJS global-message and deterministic-command orchestration
-> internal LifeCase aggregate
   (0..* immutable InboxItem + 0..1 Event + EventHistory)
-> PostgreSQL + Drizzle
-> case-scoped structured LLM extraction
-> deterministic evidence gate + Event state machine + .ics
```

The initial candidate is the same Event: `COLLECTING` while incomplete, `READY` after the gate passes,
and `CONFIRMED` after explicit user confirmation. No second draft table is needed. The Events tab
queries only `CONFIRMED` and `CANCELLED`.

### V2

```text
V1
-> authentication + owner scope
-> cross-device global ChatMessage cursors
-> internal Case ownership
-> Event-version optimistic concurrency
```

### V3

```text
V2
-> Object Storage
-> Redis Queue
-> same-repository Worker + Scheduler
-> SharedSource + user-confirmed SharedSourceReference
-> transactional Outbox
```

Redis coordinates asynchronous work; it is not a product source of truth.

### V4

```text
PostgreSQL full-text search + pgvector
-> retrieve candidate internal Cases
-> associate a new InboxItem or ask one ambiguity question
-> stage Event pendingOperation/pendingChanges/pendingEvidence/pendingStatus
```

### V5

```text
reliable V1-V4 capabilities
-> model-selected bounded read/search/question/proposal tools
-> persisted Agent run, step, tool result, and checkpoint
```

The system remains a modular monolith. Process separation does not imply service separation or an
independent database.

## 3. Capability map

| Backend topic           | Product need                                                     | First version | Learning proof                                    |
| ----------------------- | ---------------------------------------------------------------- | ------------- | ------------------------------------------------- |
| HTTP semantics          | NEW_MATTER/NEW_SOURCE, answer, confirm Event, query Events       | V1            | Status codes, DTOs, API integration tests         |
| Global message ordering | Every device sees one stable Agent feed                          | V1/V2         | Concurrent insert, cursor, and reconnect tests    |
| Case routing            | Message link is optional; model calls bind one internal Case     | V1            | Case prompt-isolation test                        |
| Validation              | Reject confirmation while a blocker exists                       | V1            | State-dependent command tests                     |
| PostgreSQL schema       | Concrete matters, immutable sources, one Event, audit history    | V1            | FK, CHECK, and `UNIQUE(event.caseId)`             |
| Drizzle ORM             | Express schema, queries, and transactions explicitly             | V1.0          | Empty-database migration plus real query tests    |
| Migrations              | Reproduce schema in every environment                            | V1.0          | A fresh database reaches the current version      |
| Event state machine     | `COLLECTING/READY/CONFIRMED/IGNORED/CANCELLED`                   | V1            | Transition-table unit tests                       |
| Evidence gate           | Choose Draft Progress or a READY Card                            | V1            | Policy and provenance tests                       |
| Pending change          | A confirmed Event remains authoritative during review            | V1            | Apply/reject and snapshot tests                   |
| Transactions            | Confirm/apply and write EventHistory atomically                  | V1            | Failure injection leaves no partial state         |
| Concurrency             | Two devices edit or apply the same Event                         | V1/V2         | A stale Event version returns `409`               |
| Idempotency             | Retry source, answer, confirm, apply, export, job, reminder      | V1+           | Duplicate commands have one logical result        |
| Time modeling           | Appointments, date-only deadlines, and DST                       | V1            | Fixed-clock and time-zone transition cases        |
| Authentication          | Cross-device private access                                      | V2            | Expired/forged sessions fail safely               |
| Authorization           | User owns messages, internal Cases, sources, and Events          | V2            | Cross-user integration tests                      |
| File processing         | Accept screenshots and PDFs                                      | V3            | Type/size/content and orphan-recovery tests       |
| Queues/workers          | Parse and extract outside an HTTP lifetime                       | V3            | Crash, duplicate-delivery, confirmed-split tests  |
| Scheduled jobs          | Remind from authoritative Events                                 | V3            | Duplicate-scheduler and missed-window tests       |
| Transactional outbox    | Trigger external notification reliably                           | V3            | Recover between commit and dispatch               |
| Search/indexes          | Find sources that may belong to the same matter                  | V4            | Query plan and association evaluation             |
| pgvector                | Retrieve semantically similar internal Cases                     | V4            | User-scoped vector query and recall tests         |
| Agent state             | Pause/resume a bounded tool workflow                             | V5            | Restart and duplicate-resume tests                |
| Tool authorization      | Agent may read, search, ask, or propose pending Event changes    | V5            | Unknown, unauthorized, side-effect tools rejected |
| EventKit approval       | Native write binds an exact Event version/snapshot               | V7            | Stale-approval and reconciliation tests           |
| Observability           | Explain request, message, Case, Event, job, retrieval, and agent | V1+           | Correlation IDs grow with async boundaries        |

## 4. Drizzle learning path

### V1.0: configuration and migrations

Learn:

- One Drizzle config, PostgreSQL connectivity, and pgvector readiness.
- Generate, migrate, check, and test-database lifecycle.
- Why migration SQL is committed instead of relying only on runtime push.

Acceptance:

- One configuration file is enough.
- Migrations initialize an empty database.
- Tests use committed migrations.
- Generated SQL is reviewed before execution.

### V1.1: core schema and constraints

Learn:

- `LifeCase` means one concrete matter, not a page, chat thread, or single source.
- `InboxItem` stores immutable external material only; a direct-intent Case may own zero InboxItems.
- `ChatMessage` belongs to the global feed and has nullable `caseId`; a link references a valid Case
  owned by the same user.
- `Event.caseId` is required and unique. A Case with no candidate has no Event row, so every Case owns
  at most one Event.
- Event status uses a controlled enum and legal transitions.
- Foreign keys, deletion behavior, `NOT NULL`, `CHECK`, and evidence-driven indexes.
- The difference between Drizzle relations and real database constraints.

Key principle:

> TypeScript relations improve query ergonomics; PostgreSQL constraints protect correctness.

- `NEW_MATTER` creates `LifeCase + initiating ChatMessage` in one short transaction. That message is
  direct-intent evidence and no InboxItem is created.
- After the user selects one explicit matter, `NEW_SOURCE` creates the LifeCase and persists
  `immutable InboxItem + source ChatMessage` in one short transaction before any model call.
- Ambiguous input kind produces a question instead of a silent semantic choice.

### V1.1b: candidate states on the same Event

Learn:

- Initial extraction inserts one Event and sets `COLLECTING` or `READY` from the gate.
- A `COLLECTING` Event projects only as Draft Progress in Agent.
- A `READY` Event projects only as a confirmable Card in Agent.
- Events queries filter to `CONFIRMED` or `CANCELLED`.
- `READY -> CONFIRMED` requires an explicit command, expected Event version, and another gate check.
- `COLLECTING/READY -> IGNORED` is explicit abandonment and does not enter Events.

### V1.3: pending changes, transactions, and concurrency

A confirmed Event edit stores:

```text
authoritative fields remain unchanged
pendingOperation = UPDATE | CANCEL
pendingChanges = validated candidate diff for UPDATE; null for CANCEL
pendingEvidence = candidate field evidence
pendingStatus = COLLECTING | READY
```

Learn:

- Writing pending data never overwrites authoritative fields on a `CONFIRMED` Event.
- Agent shows an authoritative-versus-pending diff; Events continues to read authoritative fields.
- Apply validates `expectedEventVersion` plus the current pending payload/hash.
- Applying an update atomically writes the pre-apply `EventHistory` snapshot/transition, changes
  fields, increments version, and clears pending data.
- Applying cancellation atomically writes snapshot/transition, sets `CANCELLED`, increments version,
  and clears pending data.
- Reject clears pending data and appends a `PENDING_DISCARDED` transition without changing authoritative fields.
- An optimistic update affecting zero rows is a conflict, not success.
- LLM and file-provider calls stay outside long transactions.

### V1.4: Calendar projection from an exact Event

Learn:

- `.ics` reads only an exact authoritative Event version or immutable EventHistory snapshot.
- pendingChanges never enter export silently.
- Historical exports preserve the Event version/snapshot hash they used.
- A later Event edit requires a new explicit export command.

### V2: ownership and the global feed

Learn:

- ownerId scopes ChatMessage, LifeCase, InboxItem, Event, and preference queries.
- A stable cursor such as `(createdAt, id)` handles concurrent inserts.
- Idempotent message submission and cross-device catch-up.
- A case-link command validates owner plus expected Case/Event version.
- Prompt construction is forced to load exactly one Case.

### V3: worker-safe idempotency

Learn stable business keys, upserts, unique constraints, claim/lease, retry state, and outbox
behavior. V1 never shares an InboxItem: multi-matter material requires choosing one matter or
submitting separate sources. After V3 introduces explicit `SharedSource`/`SharedSourceReference`,
the system may propose a split; several Cases are created only after user confirmation, each gets its
own InboxItem reference, and each remains protected by `UNIQUE(event.caseId)`. Persist the original
SharedSource before parser/OCR/model work; create InboxItems only after Case association is explicit.
SharedSourceReference records the shared file plus the exact page/region.

### V4: search, indexes, and pgvector

Learn GIN/full-text indexes, vector columns, metadata filters, query plans, `EXPLAIN`, association
evaluation, embedding versions, and re-indexing. Similarity yields candidates only. Associating a new
InboxItem requires policy, evidence, and an idempotent command; ambiguity requires a question.

### V5: agent proposal and versioning

Agent tools may read case-scoped context, search the user's internal Cases, write one question, or
propose an Event change. `propose_event_change` records a base Event version and evidence references;
it cannot confirm an Event, apply pending data, or execute an external side effect.

### V7: EventKit approval

Approval binds Event ID/version, EventHistory snapshot hash, parameter hash, approver, and expiry.
Execution revalidates them; stale approval fails and requires a new preview.

## 5. Recommended module boundaries

Introduce modules as milestones need them:

```text
apps/api/src/
├── database/
├── messages/              # global ChatMessage feed, cursor, optional case link
├── cases/                 # internal concrete-matter boundary and prompt scope
├── inbox/                 # NEW_SOURCE only; immutable external raw material
├── events/                # Event state, pending data, EventHistory
├── extraction/            # case-scoped extraction and evidence gate
├── calendar/              # authoritative Event -> .ics; V7 EventKit proposals
├── preferences/           # Settings values and accepted defaults
├── auth/                  # V2
├── files/                 # V3 Attachment, SharedSource, SharedSourceReference
├── jobs/                  # V3
├── reminders/             # V3
├── retrieval/             # V4 association/search
└── agent/                 # V5
```

Modules own meaningful product capabilities rather than mirroring class types. Do not create every
directory on day one.

## 6. Error model

| Error type              | Example                                     | Expected behavior                       |
| ----------------------- | ------------------------------------------- | --------------------------------------- |
| Validation              | Impossible date or invalid pendingOperation | `400`, no write                         |
| Not Found               | Internal Case/Event missing                 | `404`                                   |
| Conflict                | Expected Event version is stale             | `409`, do not overwrite or apply        |
| Idempotency Conflict    | Same key with a different payload           | `409`, preserve first result            |
| Ambiguous Association   | New source plausibly belongs to two Cases   | Do not link; ask in Agent               |
| Unauthorized            | Session missing or expired                  | `401`                                   |
| Forbidden               | Request another user's resource             | `404` or `403` under anti-leak policy   |
| Temporary Dependency    | Model timeout                               | Preserve source; show retryable failure |
| Permanent Input         | Unsupported encrypted PDF                   | Show terminal failure                   |
| Unknown External Result | Calendar/notification may have succeeded    | Reconcile before retry                  |
| Internal Invariant      | Second Event uses the same caseId           | Reject, correlate, and investigate      |

Do not compress every error into `500`, and do not retry permanent errors or business conflicts
automatically.

## 7. Testing strategy

### Unit tests

- Evidence requirements, FieldProvenance, and the blocking gate.
- `COLLECTING/READY/CONFIRMED/IGNORED/CANCELLED` transition table.
- Draft Progress, READY Card, and authoritative Events projection.
- Pending-diff validation, apply/reject rules, and cancellation rules.
- The Case prompt builder accepts only one Case's sources, related messages, Event, and allowed
  preferences.
- Time, time-zone, and `.ics` escaping.
- Idempotency-key derivation and prompt-independent schema guards.

### PostgreSQL integration tests

- Drizzle queries, foreign keys, relations, checks, and migrations.
- `UNIQUE(event.caseId)` rejects a second Event for one Case.
- Atomic `NEW_MATTER` creation of `LifeCase + initiating ChatMessage` without an InboxItem.
- Atomic `NEW_SOURCE` creation of `LifeCase + InboxItem + source ChatMessage`.
- InboxItem immutability; global ChatMessage.caseId is nullable and owner-consistent.
- Writing pendingChanges leaves every authoritative Event field unchanged.
- Apply/reject and EventHistory snapshot/transition are atomic.
- A stale Event-version optimistic update affects zero rows.
- Idempotent inserts, worker claims, and outbox behavior.

Mock repositories must not replace these tests.

### API integration/E2E tests

- A user writes in Agent and reloads the global feed in stable order.
- Concurrent inserts from two devices produce a cursor with neither gaps nor duplicates.
- `NEW_MATTER` persists ChatMessage evidence first; model failure never deletes that message or Case.
- `NEW_SOURCE` persists the InboxItem first; model failure never deletes the source.
- In V1, multi-matter material requires selecting one matter or submitting separately; the system
  neither splits Cases nor shares an InboxItem automatically.
- A Case-linked message produces a prompt containing no other Case's data.
- A blocker prevents confirmation; after the gate passes the same Event becomes `READY`.
- Confirmation makes the `CONFIRMED` Event appear in Events; `COLLECTING`, `READY`, and `IGNORED` do
  not appear.
- A pending change appears only in the Agent review Card while Events retains authoritative values.
- Confirmation or apply with a stale version returns `409`.
- Approved cancellation appears as authoritative `CANCELLED` in Events.
- Preference use retains explicit provenance.

### Worker integration tests

- A real queue delivers and processes the file job.
- V3 splits one file into several Cases only after a shared-source reference exists and the user
  confirms; every Case has at most one Event.
- The original SharedSource is persisted before parser/OCR/model work; no Case-owned InboxItem is
  created before split confirmation.
- Duplicate delivery, worker crashes, retry classification, and terminal failure.
- Reminders read authoritative Events and never pendingChanges.

### Failure-injection tests

The minimum V1 failures are:

- `NEW_MATTER` wrongly creates an InboxItem, or `NEW_SOURCE` fails to preserve external material.
- V1 automatically splits multi-matter material without a shared-source model and user confirmation.
- Concurrent inserts destabilize global-feed order.
- Prompt construction includes an InboxItem from another Case.
- Two transactions create an Event for the same Case.
- Writing pendingChanges overwrites a confirmed field.
- The transaction fails after EventHistory snapshot insertion but before Event update.
- A stale Event version confirms or applies successfully.
- `.ics` reads an unapproved pending value.

Every fix needs automated proof that fails under the old behavior and passes under the new one.

## 8. Security evolution

### V1: local only

- Secrets stay out of source control.
- Logs redact sources, ChatMessages, and pending data.
- Inputs have strict bounds.
- The UI discloses transfer to the configured model provider.
- Provider retention is reviewed and development credentials are isolated.

### V2: remote personal product

- Secure sessions, CSRF, HTTPS, and production secret storage.
- Every message/Case/Inbox/Event/preference query enforces owner scope.
- Rate/cost limits, account deletion, explicit migration releases, and baseline backups.

### V3: files

- Validate file content, not only extensions.
- Private object storage, short-lived signed URLs, and orphan cleanup.
- Review malware/parser risk for each supported format.

### V4/V5: retrieval and agents

- InboxItems, files, retrieved chunks, and ChatMessages are untrusted content.
- Backend tools enforce both user and Case scope.
- Tools use an allowlist and strict parameter schemas.
- The agent may only propose pending Event changes; authoritative confirmation, apply, and every
  external side effect require an explicit application command.

### V7: EventKit

- Approval binds an exact Event version/snapshot and parameter hash.
- Authorization, version, and expiry are revalidated before execution.
- External identifiers, idempotency, and reconciliation do not rely on model judgment.

## 9. Observability evolution

- **V1:** request ID, ChatMessage ID, internal Case ID, Event ID/version, extraction run, latency,
  tokens, cost, redaction, and state transitions.
- **V2:** user/session, cursor, synchronization lag, and stale-version conflicts.
- **V3:** job ID, attempt, queue age, retry count, terminal failure, and scheduler lag.
- **V4:** association/retrieval run, candidate, score, decision, and index version.
- **V5:** agent run/step, tool result, stop reason, and budget.
- **V7:** approval, external command, snapshot hash, and reconciliation outcome.

Do not postpone IDs and transition logs required for early failure experiments until production
hardening.

## 10. Performance evolution

1. Record a baseline.
2. Inspect global-feed, Events, and retrieval query patterns.
3. Use `EXPLAIN` to validate schema/index/query changes.
4. Check connection pools and worker concurrency.
5. Add cache only after a measured bottleneck remains.
6. Define TTL, invalidation, and fallback before enabling cache.

PostgreSQL owns authoritative state. Redis failure may reduce throughput but cannot change the
correctness of ChatMessages, Cases, InboxItems, Events, or EventHistory.

## 11. Decisions the developer must own

- Identifier and global-feed cursor strategy.
- `NEW_MATTER` versus `NEW_SOURCE` command semantics and ambiguity handling.
- The concrete-matter boundary and Case-association policy.
- Nullable ChatMessage-to-Case links and the case-scoped prompt invariant.
- `0..* InboxItem` lifecycle, external-material restriction, immutability, and deletion.
- `0..1 Event`, `UNIQUE(event.caseId)`, and Event-status transitions.
- `BLOCKING/NON_BLOCKING/OPTIONAL` and FieldProvenance rules.
- The pending area's four-field schema, operation-specific field use, apply/reject, and EventHistory snapshot semantics.
- Event-version optimistic locking and idempotency-key scope.
- Transaction boundaries and time semantics.
- Authentication/authorization, retry, file lifecycle, and reminder guarantees.
- Agent tool permissions, retrieval evaluation, and release thresholds.
- EventKit approval and reconciliation.

Codex may propose options, failure experiments, and tests, but these decisions are core learning
evidence and must not be silently delegated.
