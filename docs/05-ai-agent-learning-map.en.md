# LifeInbox AI and Agent Learning Map

[中文](05-ai-agent-learning-map.md)

## 1. Learning objective

LifeInbox builds reliable, testable AI components before allowing a model to choose among bounded capabilities. The chat interface exists from V1, but the first real agent loop does not appear until V5.

```text
single chat surface + structured model call
-> fixed routing, extraction, evidence, and clarification workflow
-> asynchronous file processing
-> evaluated retrieval and historical-matter association
-> bounded agent tool loop
-> persisted pause/resume and production observability
```

Every stage preserves the same safety boundary:

> A model may understand, explain, and propose candidate content, but it cannot bypass
> backend gates to turn that content into an authoritative Event or an external side effect.

## 2. Terms used in this project

### 2.1 Single chat surface

The user sees one chronologically ordered Agent conversation and never needs to open or switch Cases.

This does not mean sending the entire chat history to the model. The backend first determines the purpose of a message, then loads only the LifeCase, InboxItem, Event, PendingQuestion, and preferences required for that task:

```text
globally visible Chat
!=
globally unbounded LLM context
```

`ChatMessage` is the readable conversation record. It may reference an internal `caseId`, `eventId`, or `replyToMessageId`, while queries, general explanations, and messages awaiting routing may belong to no Case.

### 2.2 Internal matters and authoritative state

`LifeCase` is the canonical domain name; the documents abbreviate it to `Case` when unambiguous.

- `LifeCase` is the internal context boundary for one concrete life matter; the user does not need to see it.
- `InboxItem` is an external source artifact such as pasted text, email, PDF, or an external chat transcript. It is never silently overwritten.
- A clarification answer sent to the LifeInbox Agent is `ChatMessage` evidence, not automatically an InboxItem.
- One LifeCase may own no InboxItem or accumulate several, but owns at most one Event; a directly expressed matter uses ChatMessage evidence only.
- `Event` carries both the pre-confirmation candidate and confirmed fact; there is no separate `EventDraft`.
- `Event.status` uses `COLLECTING`, `READY`, `CONFIRMED`, `IGNORED`, and `CANCELLED`.
- `EventFieldEvidence` records whether an important field comes from an InboxItem, user answer, explicit edit, or accepted default.

Schedule queries read only authoritative `CONFIRMED`/`CANCELLED` state from the Event store; Calendar export reads only a `CONFIRMED` Event. Chat prose, model output, and a Preview Card cannot become a second source of truth.

### 2.3 Single model call

The application gives a model one input and a strict schema, then validates the structured output. The application has already selected the purpose and next step, so this is an AI capability, not an agent.

### 2.4 Fixed workflow

V1 application code controls the sequence:

```text
save user message and external source
-> route to new matter, clarification answer, Event query, or general message
-> extract one candidate Event
-> validate evidence and field completeness
-> blocker exists: show Draft Progress and ask one question
-> no blocker: show Event Preview Card
-> user explicitly confirms
-> Event becomes CONFIRMED
```

The model may propose fields and phrase a selected question, but it cannot choose arbitrary tools, confirm an Event, or export Calendar data.

### 2.5 Retrieval-augmented workflow

The application searches related Events, LifeCases, and InboxItems in a fixed order, then supplies cited results to a model. Retrieval plus generation is not automatically an agent.

### 2.6 Agent loop

The model observes current state and tool results, selects a next step from an allowlist, and then continues, pauses, or stops after receiving the result. LifeInbox first introduces this mechanism in V5.

## 3. V1 AI: reliable routing, extraction, and deterministic clarification

### 3.1 Goal

Receive natural language or pasted notices through one Chat, route each message safely, and produce zero or one Event inside one LifeCase:

```text
NO_ACTION
EVENT
MULTIPLE_MATTERS
```

V1 never creates multiple Events in one Case. If the input contains several independent matters, the Agent asks the user to select the one to process now or submit them separately. V1 does not create multiple Cases automatically and never places several Events in one Case.

### 3.2 Fixed intents

V1 needs only a bounded intent set:

| Intent                 | Meaning                              | Case behavior                                 |
| ---------------------- | ------------------------------------ | --------------------------------------------- |
| `NEW_MATTER`           | A directly expressed new matter      | Create LifeCase with ChatMessage evidence     |
| `NEW_SOURCE`           | An external source artifact          | Create LifeCase, InboxItem, and ExtractionRun |
| `CLARIFICATION_ANSWER` | Answer to a structured open question | Bind exact PendingQuestion and LifeCase       |
| `EVENT_QUERY`          | Query schedule past confirmation     | Create no InboxItem; read the Event store     |
| `GENERAL`              | Product help or another message      | Remain unbound to a Case by default           |

Automatic detection of historical Event updates and cancellations belongs to a later version. If V1 cannot identify the target of a message, it must ask rather than link silently.

### 3.3 Extraction input

- The current user message and, when external material exists, immutable InboxItem content.
- Source language when known.
- User default time zone.
- A fixed `referenceDate` and provenance when relative dates occur.
- Default duration and reminder preferences only when relevant.
- Explicitly allowed clarification evidence from the current LifeCase.

Without a trusted reference date, expressions such as `tomorrow` remain unresolved and require confirmation. Evaluations use a fixed clock.

### 3.4 Structured output

```text
outcome: NO_ACTION | EVENT | MULTIPLE_MATTERS

event:
  type: APPOINTMENT | DEADLINE | REMINDER
  title
  temporalData
  location
  nextAction
  proposedFieldEvidence

warnings
multipleMatterSummaries
```

Constraints:

```text
NO_ACTION        => event == null
EVENT            => event != null
MULTIPLE_MATTERS => event == null and the user must select one matter or submit separately
```

The model proposes values and references only. The backend adapter validates the schema, InboxItem identifiers, quotations, and offsets; a model statement that evidence exists is never sufficient by itself.

### 3.5 Field evidence

Every important field uses one of these states:

```text
SUPPORTED_BY_SOURCE  an external source supports the value
PROVIDED_BY_USER     the user supplied it through clarification or an explicit edit
DEFAULT_ACCEPTED     a visible default was explicitly accepted
MISSING              no usable value is currently available
CONFLICTING          available values conflict
```

`SUPPORTED_BY_SOURCE` references a concrete InboxItem; `PROVIDED_BY_USER` references a user ChatMessage. An explicit Card edit first appends an `EVENT_EDIT` user ChatMessage in the same transaction, then evidence references it. `DEFAULT_ACCEPTED` references a UserPreference the user explicitly accepted. Model confidence is useful for debugging or ranking but cannot promote `MISSING` or `CONFLICTING` into supported fact.

### 3.6 Deterministic completeness gate

The application maintains versioned field rules per Event type:

- `BLOCKING`: missing or conflicting data prevents confirmation.
- `NON_BLOCKING`: confirmation is allowed, but the Preview Card shows a warning.
- `OPTIONAL`: the field may remain missing.

Whether a default may be proposed is a separate policy, not a fourth requirement. A field becomes `DEFAULT_ACCEPTED` only after explicit user acceptance.

When several blockers exist, code selects one by fixed priority. The model or template only phrases that selected question. `PendingQuestion` stores:

```text
caseId
eventId?
assistantMessageId
kind: FIELD_CLARIFICATION | MATTER_SELECTION
fieldKey?
status: OPEN | ANSWERED | SUPERSEDED | CANCELLED
```

`MATTER_SELECTION` permits a null `eventId` before an Event exists. An answer binds to the exact question through `replyToMessageId -> assistantMessageId` or an explicit resume action. The backend cannot guess which Case a message such as “18:00” belongs to; when new information invalidates an old question, mark it `SUPERSEDED`.

### 3.7 Data flow

New external source processing uses two short transactions; the LLM call is outside both:

```text
transaction A:
save ChatMessage
+ create LifeCase
+ save immutable InboxItem
+ create RUNNING ExtractionRun
-> commit

call model and perform schema/evidence validation

transaction B:
save ExtractionRun result
+ create or update the unique Event
+ create PendingQuestion or Assistant ChatMessage
-> commit
```

A directly expressed new matter uses the same two-transaction boundary, but transaction A creates no InboxItem; the ChatMessage itself supplies user-provided field evidence.

Clarification:

```text
save answer ChatMessage
-> verify it targets an OPEN PendingQuestion
-> update Event fields and EventFieldEvidence
-> Event.version + 1
-> mark question ANSWERED
-> rerun the gate
-> ask the next question, or set Event.status = READY
```

Confirmation:

```text
confirm(eventId, expectedVersion)
-> reload Event
-> require status == READY and matching version
-> rerun the gate
-> atomically write CONFIRMED + confirmedAt + EventHistory snapshot
```

Query:

```text
save EVENT_QUERY ChatMessage (caseId may be null)
-> query Event.status == CONFIRMED or CANCELLED
-> produce response Cards referencing Event identifier/version
```

Queries read the Event store and never reconstruct schedules by reparsing chat history.

### 3.8 Rules

- Persist an external source before calling a model.
- `clientMessageId` prevents a message retry from creating duplicate logical input.
- A database constraint proves that a LifeCase owns at most one Event.
- With a blocker, show Draft Progress and no executable Confirm.
- Only a `READY` Event is rendered as a Preview Card.
- Ordinary Assistant prose cannot change Event status.
- Confirmation binds `eventId + expectedVersion`; stale versions return conflict.
- The model never generates `.ics`; a deterministic generator reads an exact confirmed Event version.
- LLM failure always preserves ChatMessage and LifeCase; when an external source exists, it also preserves InboxItem and exposes a retryable error.
- `NO_ACTION` is a LifeCase resolution and creates no Event.
- Instructions inside a notice are data and cannot modify system prompts, tool permissions, or confirmation rules.

### 3.9 Evaluation cases

- Complete Appointment.
- Date-only Deadline.
- Missing time that requires one question.
- Ambiguous `next Tuesday afternoon`.
- Relative dates with and without trusted reference dates.
- Source date and Event date in the same notice.
- Conflicting source values.
- Several blockers, with only the highest-priority one asked.
- A default duration that has not been accepted.
- An “18:00” answer with no uniquely targetable question.
- Replay of one clarification command.
- One input containing several independent matters.
- Informational notice requiring no action.
- “What do I have this week?” returning only authoritative `CONFIRMED`/`CANCELLED` Events from the Event store.
- English, Swedish, and Chinese variants.
- Prompt injection and requests for system-prompt disclosure.

### 3.10 Metrics

- Intent-routing accuracy and clarification rate.
- Schema validity.
- Field accuracy and evidence validity.
- Correct refusal-to-guess rate.
- Correct Draft Progress versus Preview Card gate choice.
- Unnecessary clarification rate.
- Incorrect Case associations, which must be zero.
- Duplicate state transitions caused by retries, which must be zero.
- User edit, confirmation, and ignore rates.
- Latency, tokens, and estimated cost.

Deterministic adapter/gate tests run in CI. Live-model evaluation uses a fixed dataset as a versioned release check.

## 4. V2 AI: cross-device global Chat and clarification recovery

### 4.1 Goal

Recover the global Chat, PendingQuestions, Event versions, and resume cards safely across devices without exposing a Cases UI.

### 4.2 Workflow

```text
load the user's global Chat cursor
-> load visible timeline and unfinished resume cards
-> user answers an exact question
-> consume idempotently with replyToMessageId + expectedEventVersion
-> update Event/evidence
-> rerun the gate
-> append the next question or Preview Card to the same global timeline
```

Every device observes the same authoritative Event state. Conversation order does not define state; persisted PendingQuestion, Event, and evidence do.

### 4.3 Acceptance

- A user can read only their own Messages, Cases, InboxItems, and Events.
- Global Chat uses stable cursor ordering.
- If two devices answer the same question, at most one command succeeds.
- A stale `expectedEventVersion` returns conflict and cannot overwrite newer evidence.
- Reload reconstructs Draft Progress, Preview Cards, and resume cards from persisted state.

Multi-turn chat and cross-device recovery remain a fixed workflow and do not constitute an agent loop.

## 5. V3 AI: asynchronous files and extraction pipeline

### 5.1 Goal

Convert PDFs, screenshots, and images into evidence-backed candidate Events without holding an HTTP request open for long work.

```text
validate upload
-> persist file metadata and InboxItem
-> queue
-> worker parse/OCR
-> save normalized text and page/region evidence
-> run structured extraction
-> update the unique Event
-> Draft Progress or Preview Card
```

File parsing failure, OCR uncertainty, model failure, and queue failure are distinct states.

If a file contains several independent matters, one Case still cannot own multiple Events. V3 first presents a split proposal and creates several internal Cases only after user confirmation. Shared file content uses an explicit source reference instead of silently duplicating authoritative matters.

### 5.2 Safety and evaluation

- File text is untrusted data.
- Retrying one job cannot create duplicate InboxItems or Events.
- Evaluate OCR/parser quality, page/region evidence, refusal on unreadable content, and prompt injection.
- Measure “detect several matters” and “split Cases correctly” separately rather than using a many-Events-per-Case recall metric.

## 6. V4 AI: retrieval, update recognition, and safe association

### 6.1 Goal

Determine whether a new source starts a new matter or updates/cancels an existing Event. The user still completes confirmation in the global Chat.

```text
candidate new InboxItem
-> metadata / keyword / full-text search
-> pgvector only when justified
-> candidate LifeCases/Events with evidence
-> relationship decision
   -> NEW_CASE
   -> UPDATE_EXISTING
   -> CANCEL_EXISTING
   -> NO_MATCH
   -> INSUFFICIENT_EVIDENCE
-> ask the user when ambiguous
```

Only a unique, explainable target permits associating the new InboxItem with an existing LifeCase.

### 6.2 Candidate changes to a confirmed Event

The official fields and `CONFIRMED` status remain unchanged while an update is pending:

```text
pendingOperation: UPDATE | CANCEL
pendingChanges? # UPDATE only; empty for CANCEL
pendingEvidence
pendingStatus: COLLECTING | READY
```

The Agent presents a before/after Preview. After user confirmation, the backend atomically applies changes, increments Event version, clears pending fields, and appends EventHistory. A cancellation changes status to `CANCELLED` only after confirmation. Rejecting either an update or cancellation clears all four pending fields, preserves the official Event, and appends `PENDING_DISCARDED` history.

`pendingChanges` is the update field diff inside Event's pending area, not a second Event or separate EventDraft.

### 6.3 Retrieval evaluation

- Find the correct identical matter.
- Separate similar but unrelated Events.
- Prefer explicit new evidence over conflicting old evidence while showing the change.
- Return `NO_MATCH` when no reliable result exists.
- Return `INSUFFICIENT_EVIDENCE` when candidates exist but evidence is weak.
- Cross-user results must be zero.
- Silent incorrect associations must be zero.

Retrieved content remains untrusted. RAG may propose associations and changes but cannot confirm or execute them.

## 7. V5 AI: bounded agent loop

### 7.1 Entry criteria

Before the Agent becomes the default path:

- Save at least three tasks that genuinely need dynamic branching.
- Measure the fixed workflow as a baseline.
- Compare completion, safety, steps, latency, and cost.
- Record a go/no-go decision.

If dynamic tool selection does not provide stable value, retain the fixed workflow.

### 7.2 Initial tools

| Tool                         | Type           | Allowed result                                 |
| ---------------------------- | -------------- | ---------------------------------------------- |
| `get_user_preferences`       | Read           | Read allowed settings                          |
| `get_current_case`           | Read           | Read the current internal matter               |
| `get_current_event`          | Read           | Read an exact Event version                    |
| `search_related_events`      | Read           | Return sourced candidates                      |
| `retrieve_personal_sources`  | Read           | Return cited InboxItems/chunks                 |
| `ask_clarification`          | Pause/proposal | Create PendingQuestion                         |
| `propose_new_event`          | Proposal       | Populate an unconfirmed Event without confirm  |
| `propose_event_update`       | Proposal       | Write pendingChanges; preserve official fields |
| `propose_event_cancellation` | Proposal       | Write pendingOperation; do not cancel Event    |
| `propose_calendar_export`    | Proposal       | Return a preview without external side effect  |
| `finish_without_action`      | Terminal       | No external side effect                        |

Confirming Events, applying pendingChanges, generating `.ics`, sending notifications, and writing through EventKit are not tools of the first Agent. They still require an explicit user command and backend validation.

### 7.3 Conceptual loop

```text
load run, checkpoint, internal Case, Event version, and budget
-> expose allowlisted tools
-> model selects one step
-> backend validates parameters, ownership, version, and budget
-> execute
-> persist step and observation
-> continue, pause, complete, or stop
```

AgentRun states:

```text
QUEUED
RUNNING
WAITING_FOR_USER
PROPOSAL_READY
COMPLETED
FAILED
CANCELLED
BUDGET_EXCEEDED
```

The first Agent has at most five steps plus runtime, token, cost, per-tool, and repeated-loop limits. The backend enforces every budget.

### 7.4 Pause and resume

When asking a question:

1. Persist PendingQuestion and checkpoint.
2. Set the run to `WAITING_FOR_USER`.
3. Release the worker.
4. Consume the user's answer idempotently.
5. Revalidate Case, Event version, pending operation, and permissions.
6. Resume from the checkpoint.

Waiting never holds an HTTP connection or relies on an in-memory process.

## 8. Agent evaluation

Trajectories include:

- Clear new matter: propose directly.
- Ambiguous matter: ask one question.
- Event query: use the authoritative Event store.
- Update notice: search and propose pendingChanges.
- Cancellation notice: locate the exact Event and propose cancellation.
- Missing retrieval evidence: refuse association.
- Prompt injection: refuse escalation.
- Tool loop: stop within budget.
- Tool timeout: expose failure or a retry decision.
- Resume after service restart.

Metrics include tool-choice accuracy, correct pause/completion rate, unnecessary-call rate, steps, cost, correct-stop rate, recovery success, and user acceptance/edit rates. Successful unauthorized operations, silent wrong associations, and confirmation bypasses must all be zero.

## 9. Prompt injection and tool safety

### 9.1 Trust boundaries

- System/developer instructions define behavior.
- Tool metadata defines allowed capability.
- User messages express data and intent.
- InboxItems, files, retrieved chunks, external chat records, and historical ChatMessages are untrusted content and cannot increase permission.

### 9.2 Enforcement

- Every run uses a tool allowlist.
- Parameters pass strict backend schemas.
- Resource identifiers resolve inside the current user's scope.
- The backend computes authorization and never trusts a model-supplied user id.
- Candidate writes bind an exact `eventId + expectedVersion`.
- External effects require separate confirmation, idempotency, and server-side revalidation.

## 10. Model and prompt lifecycle

Record from the first model call:

- Provider, model, and prompt version.
- Structured-output schema version.
- Input/output tokens, latency, and estimated cost.
- Stop or error reason.
- ExtractionRun or AgentRun identifier.
- Loaded Case/Event identifiers, while logs omit full private content by default.

Before release, run the fixed evaluation set, compare quality, refusal behavior, routing errors, latency, and cost, and record regressions and the release decision.

## 11. Framework introduction rule

V1-V4 do not need LangGraph. Single calls, fixed workflows, queues, and retrieval use ordinary application code.

Consider an agent framework only after V5 proves real value from dynamic tool selection, checkpoints, pause/resume, and trajectory inspection. Even then:

- PostgreSQL remains authoritative for Messages, Cases, Events, and evidence.
- Framework checkpoints do not replace product state.
- Backend code still enforces tool authorization and confirmation gates.
- Model access remains behind project adapters.
- Replacing the framework must not require rewriting core domain modules.

## 12. AI mastery standard

A developer has mastered the relevant capability only when they can:

- Explain the difference among a model call, fixed workflow, RAG, and agent loop.
- Define a structured extraction schema, evidence rules, and deterministic gate.
- Reproduce hallucinated dates, incorrect Case association, duplicate answers, and stale confirmation.
- Prove fixes with labeled and failure cases rather than one successful demo.
- Explain why one Chat UI does not imply one global prompt context.
- Explain why an Agent may only propose Events or pending operations and cannot confirm or execute.
- Reuse the same safety boundary for an adjacent Event type or tool.
