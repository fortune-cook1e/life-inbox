# LifeInbox Advanced Roadmap

[中文](03-advanced-roadmap.md)

## 1. Evolution rule

Move beyond V1 only after the core loop passes real acceptance:

```text
global Agent chat
-> distinguish NEW_MATTER from NEW_SOURCE
-> resolve one explicit concrete matter
   -> NEW_MATTER: atomically persist LifeCase + evidentiary ChatMessage; create no InboxItem
   -> NEW_SOURCE: ask the user to select one matter when needed, then atomically persist
      LifeCase + InboxItem + ChatMessage
-> extract and validate evidence
-> ask one question at a time when information is missing
-> show a confirmable Event Card
-> user confirms
-> authoritative Event appears in Events
-> export .ics
```

Later versions may add accounts, files, retrieval, an agent loop, and native calendar writes, but
they must not bypass the evidence gate, explicit confirmation, idempotency, transaction boundaries,
or audit history.

### Cross-version product model

Ordinary users see only three top-level areas:

- **Agent:** one globally visible, continuously growing chat. It is the primary place to submit
  notices, answer questions, inspect Draft Progress, and confirm Event Cards.
- **Events:** queries only authoritative `CONFIRMED` and `CANCELLED` Events. `COLLECTING`, `READY`,
  `IGNORED`, and unapproved changes never appear as authoritative events in this list.
- **Settings:** manages time zone, language, default duration, reminders, and data preferences.

`LifeCase` and `InboxItem` are internal models, not user navigation:

```text
LifeCase = one concrete matter
LifeCase 1 -> 0..* immutable InboxItem
LifeCase 1 -> 0..1 Event
Event.caseId is NOT NULL + UNIQUE
```

`NEW_MATTER` means the user directly states a new matter in natural language, such as "remind me to
call the landlord on Friday." The initiating message is evidence, so its LifeCase may have no
InboxItem. `NEW_SOURCE` means the user submits external raw material such as a pasted notice, file, or
later update; only this path creates an immutable `InboxItem`. If the input kind is unclear, ask
instead of treating ordinary intent as an external source.

A global `ChatMessage.caseId` is nullable: ordinary conversation may have no matter, while the
initiating `NEW_MATTER` message, a `NEW_SOURCE` submission, clarification answer, Draft Progress
message, or Event Card may reference one internal Case. All messages belong to one global feed; they
do not form user-visible per-Case conversations.

V1 cannot share one InboxItem across Cases. If one `NEW_SOURCE` contains several matters, it is not
split automatically; Agent asks the user to select one matter to handle now or submit the material
separately. V3 permits user-confirmed splitting only after introducing an explicit shared-source
reference.

A global feed does not allow context mixing. Every extraction, clarification, or agent tool call must
resolve one Case in backend code and place only that Case's InboxItems, relevant ChatMessages, Event,
and allowed preferences in the model prompt. When the Case is uncertain, the system asks first
instead of combining facts from different matters.

### Event state and confirmation boundary

V1 uses a single Event entity. The initial candidate is that same Event:

```text
COLLECTING <-> READY
COLLECTING | READY -> IGNORED
READY -> CONFIRMED
CONFIRMED -> CANCELLED
```

- `COLLECTING` means a blocking field remains `MISSING` or `CONFLICTING`; Agent may show only Draft
  Progress and one question.
- `READY` means the evidence gate passed and Agent may show a confirmable Event Card.
- `CONFIRMED` and `CANCELLED` are authoritative states visible in Events.
- `IGNORED` means the candidate matter was explicitly abandoned and does not appear in Events.

A candidate edit must never overwrite a confirmed Event. An update uses all four pending fields,
with `pendingChanges` containing only the proposed field diff. A cancellation has no field diff and
therefore uses only `pendingOperation`, `pendingEvidence`, and `pendingStatus`. Events continues to
read authoritative fields while Agent shows a reviewable diff. Applying the change validates the
exact Event version and, in one transaction, writes an `EventHistory` snapshot/transition, changes
authoritative fields or status, increments the version, and clears pending data. Rejecting pending
work also appends a `PENDING_DISCARDED` transition audit record.

A chat-shaped UI is not an autonomous agent. V1–V4 use deterministic conversational orchestration;
only V5 lets the model choose among bounded tools.

## 2. V2: secure accounts and cross-device global conversation

### Product outcome

The user signs in on multiple devices and continues questions or Event Card confirmation in the same
global Agent feed. Events contains only that user's authoritative confirmed or cancelled Events, and
Settings remains consistent across devices.

### Capabilities

- Account creation, login, logout, and session expiry.
- Owner-only access to ChatMessages, internal Cases, InboxItems, Events, EventHistory, and exports.
- User preferences for time zone, language, default duration, and reminders.
- Stable cursor ordering and incremental cross-device synchronization for the global ChatMessage feed.
- Nullable `ChatMessage.caseId` plus backend-enforced case-scoped prompts.
- The deterministic policy of one blocking question at a time.
- Optimistic concurrency and idempotent consumption for Event versions, clarification commands, and
  confirmation commands.
- Account export and deletion.

### Clarification flow

```text
resolve internal caseId from the global ChatMessage
-> load that LifeCase, its InboxItems, Event version, and unanswered question
-> deterministic gate selects the highest-priority blocking field
-> persist one Case-linked question in the global feed
-> user answers with idempotency key + expectedEventVersion
-> update the same COLLECTING Event and preserve field provenance
-> run the gate again
   -> blocker remains: show Draft Progress in Agent
   -> no blocker: set Event to READY and show a confirmable Event Card
```

The model may phrase the selected question, but it cannot expand prompt scope or choose arbitrary
tools.

### Backend learning

- Authentication, session lifecycle, cookie security, and CSRF.
- Owner-scoped Drizzle queries and authorization errors that do not leak resource existence.
- Stable pagination, duplicate delivery, and out-of-order synchronization in a global feed.
- LifeCase as the concrete-matter aggregate and ownership of InboxItems, Event, and EventHistory.
- `UNIQUE(event.caseId)`, Event versioning, and stale-write conflicts.
- Idempotent clarification and confirmation commands.
- Deletion and privacy boundaries.

### AI learning

- Separation between a global UI and a case-scoped prompt.
- FieldProvenance from source text, user answers, explicit edits, and preferences.
- The evidence boundary between Draft Progress and a READY Event Card.
- Multi-turn context without an autonomous loop.
- Versioned prompts and replayable extraction attempts.

### Failure experiments

- User A requests user B's internal identifier.
- Two devices answer the same question.
- A client retries the same command after losing the response.
- Messages for two matters interleave in the global feed.
- A client confirms or edits with a stale Event version.
- Prompt construction accidentally includes another Case's source.

### Acceptance

- Every private query is scoped to the authenticated user.
- Global messages retain stable order across concurrent inserts and reconnects.
- An unlinked message is not silently attached to a Case.
- Every model call contains only the target Case's context.
- The same clarification or confirmation command produces at most one logical result.
- A stale Event version returns a conflict and cannot overwrite newer state.
- After signing in again, the Agent feed, Draft Progress, READY Card, and authoritative Events rebuild
  from persisted state.

## 3. V3: files, background processing, and reminders

### Product outcome

The user submits real screenshots or documents in global Agent chat, leaves while processing
continues, and receives reliable reminders for authoritative Events.

### Capabilities

- Upload images and text PDFs; add scanned PDFs/OCR after the text path is reliable.
- Store original files in S3-compatible object storage.
- Show upload, processing, and terminal-failure messages in the global feed.
- Persist the original file as SharedSource/Attachment before asynchronous parsing or model calls;
  create immutable InboxItems only after association with one explicit Case or a user-confirmed split.
- V1 still asks the user to select one matter or submit separate materials. In V3, after an explicit
  shared-source reference exists, the system may propose a split and create several internal
  LifeCases only after user confirmation.
- Store the original file once. Each confirmed Case receives its own immutable InboxItem plus a
  SharedSourceReference; an InboxItem still belongs to one Case, and every Case owns at most one Event.
- SharedSourceReference binds the Case-owned InboxItem to the shared original file and exact
  page/region so provenance remains auditable.
- Preserve multiple sources for the same matter as immutable InboxItems without overwriting history.
- Retry transient failures and make permanent failures visible.
- Send in-app reminders and a next-seven-days digest.
- Generate `.ics` deterministically from an exact authoritative Event version or EventHistory snapshot.

### Added architecture

```text
Object Storage
Redis + Queue
worker from the same repository
Scheduler
Outbox dispatcher
```

The API, worker, and scheduler remain one modular monolith. Process separation does not imply
microservices.

### Proposed data

```text
Attachment
SharedSource
SharedSourceReference
ProcessingJob
JobAttempt
ReminderSchedule
ReminderDelivery
OutboxEvent
```

### Backend learning

- Upload validation, signed URLs, and sensitive metadata.
- Queues, workers, at-least-once delivery, and exponential backoff.
- Stable business job keys, idempotent consumers, and database unique constraints.
- Scheduled jobs, distributed locks, and missed-window recovery.
- Transactional outbox behavior between database state and external delivery.

### AI learning

- Treat OCR and document parsing as upstream components.
- Identify concrete-matter boundaries and propose a split for user confirmation rather than creating
  several Cases automatically.
- Preserve page/region evidence.
- Treat document content as untrusted data.

### Failure experiments

- Upload an executable renamed as a PDF or a file above the hard limit.
- Object upload succeeds while the database write fails.
- A worker crashes after model completion and before persistence.
- Two workers consume the same job.
- A worker splits multi-matter material before the user confirms.
- Retrying a confirmed split creates duplicate Cases or SharedSourceReferences.
- A worker attempts to insert a second Event for the same caseId.
- Notification delivery succeeds but its acknowledgement is lost.

### Acceptance

- Invalid files are rejected before processing and orphaned objects have a cleanup path.
- The original SharedSource/Attachment exists before any model call; InboxItems are created only
  after explicit Case association or a user-confirmed split.
- A duplicate job does not duplicate a Case, InboxItem, or Event.
- A database constraint rejects a second Event for one Case.
- In V1, multi-matter material requires choosing one matter or submitting separately; InboxItems are
  never shared automatically.
- In V3, splitting requires an explicit shared-source reference and user confirmation; uncertain
  boundaries cause a question in Agent.
- Workers recover unfinished jobs after restart.
- Reminders read only authoritative Events and never unapproved pendingChanges.
- Logs do not expose document bodies or signed URLs.

## 4. V4: safe source association and personal retrieval

### Product outcome

LifeInbox can decide whether a new InboxItem belongs to an existing concrete matter. A reliable match
appends it to the existing LifeCase; ambiguity produces an evidence-backed question in global Agent
chat and is never linked silently.

### Product example

```text
existing internal Case: housing inspection on August 5
authoritative Event: August 5, CONFIRMED
new InboxItem: the inspection moved to August 8

LifeInbox:
-> retrieve candidate Cases and compare matter identity plus source evidence
-> reliable match allowed by policy: append InboxItem to the same Case and explain the link in Agent
-> ambiguity: ask in Agent, "Is this a reschedule of the earlier inspection?"
-> after association, stage pendingOperation=UPDATE and pendingChanges={date: Aug 8}
-> pendingEvidence references the source; an independent gate sets pendingStatus
-> Events continues to show the authoritative August 5 value
-> Agent shows a diff Card
-> user applies it; write EventHistory, increment Event version, show August 8 in Events
```

A cancellation notice follows the same boundary: the Event remains `CONFIRMED` with
`pendingOperation=CANCEL` until approval, then becomes `CANCELLED`. Distinct but related matters may
use `CaseRelation`; that relation must not replace appending a source to the same matter.

### Evolution inside V4

1. Metadata filters and exact/keyword search.
2. Persist inspectable retrieval runs, candidates, and scores.
3. Build an evaluation set for association and refusal to associate.
4. Store embeddings in PostgreSQL with pgvector.
5. Add hybrid retrieval only when evaluation proves value.
6. Let a model classify from retrieval evidence while application policy decides whether automatic
   association is allowed.

### Capabilities

- Search internal LifeCases, InboxItems, and authoritative Events.
- Distinguish a new source for the same matter from a different but related matter.
- Record the association decision, evidence, model/prompt/index version, and actor.
- Show completed automatic associations in Agent and allow correction; never change matter identity
  invisibly.
- Ask one explicit question for ambiguous results.
- Propose pending update/cancel data for a confirmed Event without mutating authoritative fields.
- Show source evidence in Agent Cards; ordinary users do not browse internal Case lists or identifiers.

### Proposed data

```text
CaseAssociationRun
CaseAssociationCandidate
CaseRelation
Document
Chunk
EmbeddingVersion
RetrievalRun
RetrievalEvalCase
```

### Backend learning

- Full-text indexes, pgvector, query planning, and `EXPLAIN`.
- User/status filters before or around similarity search.
- Concurrency, idempotency, and audit for association decisions.
- Transaction boundaries between appending an InboxItem and staging an Event change.
- Re-indexing/version lifecycle; cache only after measuring a bottleneck.

### AI learning

- Chunking and retrieval evaluation.
- Separate retrieval failure, association ambiguity, and generation failure.
- Determine matter identity from evidence rather than semantic similarity alone.
- Recency and authoritative-source precedence.
- Refuse automatic association when evidence is insufficient.

### Failure experiments

- A semantically similar notice for another address ranks first.
- One new source has two plausible Case candidates.
- An older source scores above a newer source.
- The retrieval query omits the user filter.
- Two devices process the same update notice concurrently.
- The Event changes before association completes.

### Acceptance

- Retrieval never crosses user boundaries.
- A new InboxItem links to one unambiguous Case; ambiguity requires a question.
- Retrying an association command does not append the source twice.
- pendingChanges never contaminates authoritative values in Events.
- A stale Event version cannot apply an update or cancellation.
- The evaluation set separately measures correct association, incorrect association, and ask-first
  decisions.

## 5. V5: bounded, stateful LifeInbox agent

### Product outcome

Within one explicit Case scope, the system may decide to read context, search history, ask a question,
propose an Event change, or finish without an Event. It can pause and resume the same run. This is the
first version with model-selected next tools.

### Initial tools

```text
get_user_preferences
read_case_context
search_cases
ask_clarification
propose_event_change
finish_without_event
```

Tools are read-only or proposal-only:

- `read_case_context` returns only the run-bound Case's InboxItems, relevant ChatMessages, and Event.
- `search_cases` enforces user scope and returns evidence-backed candidates.
- `ask_clarification` writes one internal-Case-linked question to the global feed and pauses.
- `propose_event_change` may update a `COLLECTING`/`READY` candidate or stage
  the pending fields applicable to the target operation for a `CONFIRMED` Event; it cannot confirm,
  apply, cancel, or execute an external side effect.

Confirmation, applying pending data, Calendar export, notification delivery, and EventKit writes
remain validated explicit application commands.

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
EventChangeProposal
AuditEvent
```

A proposal records its base Event version and supporting InboxItem/ChatMessage references.
Application rereads the Event and fails with a conflict if the version changed. The agent cannot turn
its own proposal into authoritative Event state.

### Backend learning

- Persist runs, steps, tool results, and checkpoints.
- Store caseId, Event version, budget, and allowed tools in each checkpoint.
- Idempotent resume events and leases for one active worker.
- Concurrent user edits while an agent is paused.
- Tool authorization, schema validation, and append-only audit.

### Agent learning

- Model-selected tool use and the observation-action loop.
- Step, time, token, tool-call, and cost budgets.
- Stop conditions, human escalation, and prompt-injection defense.
- Explain tool decisions without persisting hidden chain-of-thought.

### Hard limits for the first agent

- Every run binds one explicit Case.
- At most one active run per Case.
- At most five steps.
- At most one question per turn.
- Allowlisted tools only.
- No automatic Event confirmation, pending-change application, or external side effect.

### Failure experiments

- Restart while waiting for an answer.
- Submit the same answer twice.
- Add an InboxItem or change Event version while paused.
- Repeat a tool call, send invalid arguments, or access another user.
- Put prompt injection inside retrieved content.
- Exhaust the budget or time out a tool.

### Acceptance

- A run resumes across restart without process-local memory.
- One logical step does not duplicate a business result.
- Tools cannot escape the run's Case or user scope.
- An agent proposal does not mutate authoritative Event fields.
- A stale base Event version cannot apply.
- No agent path creates an unapproved side effect.

## 6. V6: production hardening

### Product outcome

The system can be deployed, observed, backed up, restored, and upgraded safely while exposing clear
failure states to real users.

### Capabilities and learning

- Container images, environment validation, and a non-root runtime.
- HTTPS, secret management, CORS, CSRF, CSP, and security headers.
- Migration release strategy, backward-compatible deployment, and rollback.
- Managed PostgreSQL, backups, and restore drills.
- Secure object storage, Redis, and queue configuration.
- Structured logs, metrics, traces, dashboards, alerts, and SLOs.
- Request, ChatMessage, Case, Event, job, retrieval, and agent correlation.
- Provider cost, retention, redaction, and data deletion.
- Dependency, container, and static-analysis scanning.

### Failure experiments

- Incomplete environment configuration, failed migration, or incompatible rolling deployment.
- PostgreSQL, Redis, object storage, or model-provider outage.
- Queue backlog, worker crash loop, or retry storm.
- Event apply transaction fails between snapshot and update.
- A backup exists but cannot be restored.
- Logs accidentally contain private source text.

### Acceptance

- Releases use committed migrations and a tested recovery path.
- Redis failure does not corrupt authoritative PostgreSQL state.
- Dashboards explain global-feed, Event, worker, retrieval, and agent failures.
- Alerts cover queue age, retry storms, error rate, and model cost.
- Deletion covers original data, derivatives, embeddings, and policy-retained audit data.

## 7. Optional V7: native Apple Calendar companion

### Product outcome

After explicit approval, a macOS/iOS companion creates, updates, or cancels Apple Calendar events
through EventKit.

### Flow

```text
backend creates a proposal from an exact authoritative Event version and EventHistory snapshot
-> companion receives proposal
-> user grants Calendar permission
-> user approves exact parameters
-> backend revalidates Event version/snapshot
-> EventKit executes
-> companion reports external identifier and result
-> backend records sync state and audit
```

Approval binds proposal ID/version, Event ID/version, snapshot hash, parameter hash, approver, and
expiry. It is not a generic consent boolean and cannot silently adopt later pendingChanges.

### Proposed data

```text
Approval
ExternalCalendarCommand
CalendarSyncAttempt
```

### Failure experiments

- Calendar permission is denied or revoked.
- The user approves twice.
- The external event succeeds but acknowledgement is lost.
- Event version or snapshot changes after approval.
- The user edits or deletes the event directly in Apple Calendar.
- An offline device receives an expired proposal.

### Acceptance

- EventKit cannot be written without explicit approval.
- Replayed commands do not blindly duplicate events.
- A stale Event version/snapshot requires a new preview and approval.
- External state supports reconciliation.
- PostgreSQL Event state and Apple Calendar are not presented as strongly consistent.

## 8. Explicit roadmap exclusions

Unless real usage and evidence change priorities, do not pre-build:

- Multi-agent swarms or GraphRAG.
- Fine-tuning, custom model training, or multiple vector databases.
- Multiple Calendar providers.
- Automatic access to the user's complete email inbox.
- A native mobile app without an explicit synchronization protocol.
- Microservices or caches before measuring a bottleneck.
