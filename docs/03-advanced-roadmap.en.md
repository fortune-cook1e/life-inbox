# LifeInbox Advanced Roadmap

[中文](03-advanced-roadmap.md)

## 1. Evolution rule

Product needs unlock advanced versions; calendar dates do not.

```text
V1 reliable AI-assisted workflow
-> V2 secure personal account and clarification
-> V3 real-world files and background processing
-> V4 personal retrieval and related-item understanding
-> V5 bounded, stateful agent
-> V6 production hardening
-> optional V7 native Apple Calendar execution
```

A version may be delayed or reduced. Infrastructure needed by a later version must not be introduced early.

## 2. V2: secure personal account and clarification workflow

### Product outcome

The user signs in across devices, accesses only personal data, and answers one focused clarification question when a notice is incomplete.

### Capabilities

- Account creation, sign-in/out, and session expiry.
- Owner-only access to inbox items, actions, and exports.
- Time-zone, language, duration, and reminder preferences.
- One focused clarification question at a time.
- Persisted questions, answers, and draft versions.
- Cross-device item-state synchronization.
- Account export and deletion design.

### Clarification flow

```text
extraction reports missingFields
-> application selects the highest-priority missing field
-> generate one focused question
-> save workflow as WAITING_FOR_USER
-> user answers
-> update the same draft version chain
-> review again
```

This is still a fixed workflow: application code decides when to ask, and the model cannot freely choose among arbitrary tools.

### Backend learning

Authentication and session lifecycle, password/OAuth boundaries, cookie security and CSRF, owner-only authorization, rate/cost limits, owner-scoped Drizzle queries, concurrent answers and optimistic locking, deletion, and privacy.

### AI learning

Clarification quality, provenance from source and user answers, multi-turn context without autonomous loops, and versioned/replayable extraction attempts.

### Failure experiments

User A requests user B's identifier; signed-out browser replays an old write; two tabs answer the same question; answers conflict; one user sends many expensive requests.

### Acceptance

- Every private query is scoped to the authenticated user.
- Unauthorized access does not reveal whether another resource exists.
- Session cookies use appropriate `HttpOnly`, `Secure`, and `SameSite` settings.
- Write routes have CSRF protection when required by the session design.
- A clarification answer is consumed at most once.
- Conflicting answers remain visible rather than silently overwriting history.

## 3. V3: files, background processing, and reminders

### Product outcome

The user submits real screenshots and documents, leaves while they process, and receives reliable reminders for confirmed actions.

### Capabilities

- Upload images and text-based PDFs; add scanned PDFs/OCR only after the text path is reliable.
- Store original files in S3-compatible object storage.
- Display upload and processing state.
- Extract zero or more action candidates from one document.
- Retry transient failures and expose terminal failures.
- Detect identical files and duplicate processing commands.
- Send in-app reminders and seven-day summaries.
- Preserve Apple Calendar `VALARM` reminders in `.ics`.

### Added architecture

```text
Object Storage
Redis + Queue
worker process in the same repository
Scheduler
Outbox dispatcher
```

API, worker, and scheduler remain one modular codebase. Separate processes do not automatically justify microservices.

### Proposed data

```text
Attachment
ProcessingJob
JobAttempt
ReminderSchedule
ReminderDelivery
OutboxEvent
```

### Backend learning

Multipart/direct uploads, file validation by size/MIME/magic bytes, signed URLs, queue/worker lifecycle, at-least-once delivery, exponential backoff and terminal failure, idempotent consumers and unique constraints, scheduling and missed-window recovery, and transactional outbox.

### AI learning

Treat OCR/parsing as upstream components, extract multiple actions, preserve page/region evidence, and treat document text as untrusted data.

### Failure experiments

Renamed executable; oversized file; upload succeeds but DB write fails; DB row exists but upload never finishes; worker crashes before/after saving; duplicate delivery to two workers; two schedulers create the same reminder; delivery succeeds but response is lost.

### Acceptance

- Invalid files are rejected before processing.
- Failed uploads and orphaned objects have cleanup paths.
- Duplicate jobs do not create duplicate drafts.
- Stable business keys and database constraints provide idempotency.
- Terminal failures stop retrying and remain visible.
- Workers recover unfinished work after restart.
- One reminder window creates at most one logical notification.
- Logs exclude document bodies and signed URLs.

## 4. V4: personal retrieval and related-item understanding

### Product outcome

LifeInbox finds relevant history and explains whether a new notice appears to update, cancel, or supplement an existing item.

### Product example

```text
Old notice: inspection on August 5
New notice: inspection moved to August 8

LifeInbox:
- finds the old action;
- shows old and new evidence;
- proposes an update;
- waits for confirmation.
```

### Evolution inside V4

1. Metadata filtering and exact/keyword search.
2. Debug UI showing matches and scores.
3. A small related-item retrieval evaluation set.
4. Embeddings stored in PostgreSQL with pgvector.
5. Hybrid retrieval only when evaluation proves useful.
6. RAG output cites retrieved source identifiers.

Ordinary retrieval must be reliable and debuggable before a model decides how to use results.

### Capabilities

- Search personal sources and confirmed actions.
- Find potentially related notices.
- Classify `UPDATE`, `CANCELLATION`, `FOLLOW_UP`, or `UNRELATED`.
- Show retrieval evidence and scores.
- Propose changes without applying them.
- Version documents, chunks, embeddings, and retrieval configuration.

### Proposed data

```text
LifeCase
ItemRelation
Document
Chunk
EmbeddingVersion
RetrievalRun
RetrievalEvalCase
```

### Backend learning

Full-text search and indexes, pgvector, query planning and `EXPLAIN`, filtering around similarity search, tenant isolation, re-indexing/version lifecycle, and caches only after a measured bottleneck.

### AI learning

Chunking and retrieval evaluation, retrieval versus generation failures, evidence-based relationship classification, recency/authority priority, and refusal when no reliable relation exists.

### Failure experiments

Semantically similar but unrelated result ranks first; an obsolete address outranks the new address; no related item exists; user filter is omitted; search happens before asynchronous indexing completes.

### Acceptance

- Retrieval never crosses user boundaries.
- Results, scores, and source identifiers are inspectable.
- Explicit new information outranks conflicting old context.
- No reliable result returns `UNRELATED` or requests review instead of guessing.
- Saved evaluation cases measure retrieval quality.

## 5. V5: bounded, stateful LifeInbox agent

### Product outcome

The system may decide to search history, read preferences, ask a question, propose a calendar action, or finish without action. It can pause for hours or days and resume the same run. This is the first version that should be called an agent.

### Initial read/proposal tools

```text
get_user_preferences
get_current_item
search_related_items
retrieve_personal_documents
ask_clarification
propose_new_action
propose_action_update
propose_action_cancellation
propose_calendar_export
finish_without_action
```

The agent cannot directly confirm actions, export calendar files, send notifications, or write Apple Calendar. Those remain user-approved application commands.

### Agent-run state

```text
QUEUED
-> RUNNING
-> WAITING_FOR_USER | PROPOSAL_READY
-> RUNNING
-> COMPLETED | FAILED | CANCELLED | BUDGET_EXCEEDED
```

### Proposed data

```text
AgentRun
AgentStep
ToolCall
Checkpoint
ActionProposal
AuditEvent
```

V5 does not add a generic `Approval`. Existing explicit commands confirm proposals. A precise approval model is needed only when V7 introduces EventKit side effects.

### Backend learning

Persistent workflow state, checkpoints and resume events, idempotent event consumption, leases for one active worker, concurrent edits during pauses, tool authorization/schema validation, and append-only audit history.

### Agent learning

Model-selected tools, observation/action loops, step/time/token/tool/cost budgets, stop conditions and escalation, prompt-injection defense, versioning, and trajectory evaluation.

### Hard limits for the first agent

- At most five steps.
- At most one active run per inbox item.
- Read, search, question, and proposal tools only.
- No unapproved external side effects.
- Stop repeated identical tool calls.
- Backend schema validates all arguments.
- Every database query is scoped to the authenticated user.

### Failure experiments

Restart while waiting; submit one answer twice; resume after the underlying action changes; repeated tool call; injected instruction to access another user; unknown tool/invalid arguments; exhausted budget.

### Acceptance

- Every run ends completed, waiting, failed, cancelled, or budget-exceeded.
- Completed steps survive restart.
- User answers are consumed once.
- A stale checkpoint cannot overwrite newer product state.
- Unauthorized/invalid calls fail before execution.
- No agent path creates an unapproved side effect.
- Steps, results, stop reason, latency, and cost are inspectable.

## 6. V6: production hardening

### Product outcome

The system is deployable, diagnosable, recoverable, and safe for real private data within its stated limits.

### Capabilities and learning

- Redacted structured logs and correlation identifiers.
- HTTP, database, queue, LLM, retrieval, and notification metrics.
- Distributed traces across API, worker, model, and tools.
- Liveness/readiness/dependency checks.
- Secret management and environment isolation.
- Database backups with tested restoration.
- Object-storage lifecycle and deletion.
- Safe migration rollout and rollback plans.
- Rate limits, quotas, cost budgets, load tests, and pool analysis.
- Cache only after measurement and with an invalidation plan.

### Failure experiments

Stop PostgreSQL during a request; stop workers and watch queue age; increase model latency/error rate; deploy an incompatible schema to staging; restore a backup; revoke credentials; inspect logs for private content.

### Acceptance

- One user action traces across relevant components.
- Default logs contain no sensitive notice content.
- A database backup has actually been restored.
- Failed deployment has a tested recovery path.
- Queue age, retry storms, and model cost have practical alerts.
- Data deletion covers sources, derivatives, embeddings, and audit-policy requirements.

## 7. Optional V7: native Apple Calendar companion

### Product outcome

After explicit approval, a small macOS/iOS companion creates, updates, or cancels Apple Calendar events through EventKit.

### Flow

```text
backend creates an exact versioned proposal
-> native companion receives it
-> user grants Calendar permission
-> user approves exact fields
-> EventKit performs the operation
-> companion reports result and event identifier
-> backend records confirmed external state
```

### Learning

Swift/EventKit permissions, device/server coordination, parameter-bound versioned approval, external identifiers and reconciliation, offline devices/eventual consistency, and direct Calendar edits.

### Proposed data

```text
Approval
ExternalCalendarCommand
CalendarSyncAttempt
```

`Approval` binds proposal ID/version, parameter hash, approver, and expiry. It is not a generic consent boolean.

### Failure experiments

Permission denied/revoked; duplicate approval; successful creation with lost acknowledgement; proposal changes after approval; manual deletion; offline device.

### Acceptance

- No valid exact approval means no write.
- Changing a proposal invalidates old approval.
- Duplicate commands do not blindly duplicate events.
- Unknown external outcomes enter reconciliation rather than being reported as success.

V7 is optional; the web `.ics` workflow remains valid without it.

## 8. Explicit roadmap exclusions

- Microservices and Kubernetes.
- Multi-agent swarms and GraphRAG.
- Fine-tuning, custom model training, or multiple vector databases.
- Multiple calendar providers.
- Automatic access to the user's full email inbox.
- Unapproved medical, legal, immigration, or financial action.
