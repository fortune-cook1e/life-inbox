# ADR 0003: Use One Agent Chat, Internal Cases, and a Single-Event Model

[中文](0003-single-chat-internal-cases.md)

| Item          | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Status        | Accepted                                                                               |
| Decision date | 2026-07-25                                                                             |
| Scope         | LifeInbox user interface, conversation context, domain aggregates, and Event lifecycle |
| Supersedes    | [ADR 0002](0002-conversation-first-interaction.en.md)                                  |

## Context

ADR 0002 established conversation-first interaction, card confirmation, and structured-state boundaries. It also made each Case conversation separate and exposed a Cases information center to the user.

Further product discussion moved LifeInbox toward a clearer personal-agent experience:

- The user always starts from one conversation to express intent, paste a notice, answer questions, and resume unfinished work.
- The user queries confirmed Events rather than internal Cases, source records, or workflow states.
- Cases still isolate evidence, state, and model context, but remain internal domain objects.
- One concrete matter produces at most one Event in V1, avoiding a return to task-management UI through multiple action cards.
- Pre-confirmation and post-confirmation data live in the same Event aggregate; a separate EventDraft table would create another copy that could drift.

This decision supersedes the per-Case user conversation and user-facing Cases center from ADR 0002. Card confirmation, evidence gates, fixed orchestration, and external-side-effect boundaries remain.

## Decision

### 1. Users interact only with Agent, Events, and Settings

The product surfaces arrive in stages:

1. The initial product provides only `Agent` and `Settings`.
2. After confirmed Events are produced reliably, the product adds an `Events` tab.

`Agent` is the only conversation entry point. `Events` queries only Events that crossed the explicit confirmation boundary; it does not show `COLLECTING`, `READY`, or `IGNORED` candidates. An Event cancelled after confirmation may remain visible as history, clearly labeled `CANCELLED`.

`Settings` stores preferences such as default time zone, default appointment duration, reminder lead time, and preferred language. A preference may only propose a value; when it fills a blocking field, the user must explicitly accept it.

Users never see, create, select, or switch `Case` or `InboxItem`. Unfinished matters return through resume cards inside Agent chat.

### 2. One visible chat does not mean one global LLM context

The user sees one global, chronological Agent chat. Every user and Agent message is stored as a `ChatMessage`:

```text
ChatMessage
  id
  role: USER | ASSISTANT | SYSTEM
  kind
  content
  caseId?
  referenceType?
  referenceId?
  clientMessageId?
  createdAt
```

`caseId` is nullable. For example, a first message whose matter has not yet been identified, or a general interface notice, may initially have no Case. Once a message supports extraction, clarification, confirmation, or an update for one matter, it references that Case.

The global timeline is only the user interface. For every model call, the backend builds a bounded context using only:

- The target Case's `InboxItem` records.
- `ChatMessage` records related to the target Case.
- Explicitly allowed Settings preferences.
- The current Event plus `pendingOperation`, `pendingChanges`, `pendingEvidence`, and `pendingStatus`.

If one message may belong to multiple Cases, the Agent asks the user first rather than mixing facts and asking the model to guess. Dates, locations, and evidence must never leak silently between Cases.

### 3. LifeCase is one internal concrete matter

A `LifeCase` represents one concrete real-world matter, such as one apartment inspection or one product return. `LifeCase` is the canonical domain and implementation name; this ADR uses `Case` as shorthand when the meaning is clear.

V1 aggregate relationships:

```text
Case
  -> zero or more immutable InboxItems
  -> zero or more linked ChatMessages
  -> zero or one Event
  -> zero or more ExtractionRuns
```

A Case is not an alias for one source record. A directly expressed matter may rely only on ChatMessage evidence, so not every Case requires an InboxItem. When external material exists, several notices may belong to the same matter, including an original notice, a time update, and a cancellation. The system preserves every source and its provenance; a new source never overwrites an old one.

Backend fixed orchestration creates, links, and resumes Cases. The user sees only Agent explanations, resume cards, and Event Cards.

### 4. InboxItem represents external source material only

`InboxItem` stores external source material that the user brings into the system, such as pasted notice text. Later versions may also support email, screenshots, or PDFs.

Rules:

- Stored content is never silently edited.
- One Case may own no InboxItem or several; create InboxItems only for external material.
- `SUPPORTED_BY_SOURCE` points to a specific InboxItem; `PROVIDED_BY_USER` points to a Case-bound user ChatMessage; `DEFAULT_ACCEPTED` points to a UserPreference the user explicitly accepted.
- A Card-edit command appends an `EVENT_EDIT` user ChatMessage in the same transaction, and field evidence references that message.
- A user's answer to an Agent clarification is not a new InboxItem; it remains `ChatMessage` evidence linked to the Case.

### 5. One Case owns at most one Event in V1

V1 does not allow multiple Events in one Case:

```text
Case.event = zero or one Event
```

When one external source clearly contains multiple independent matters, V1 first asks the user to select one matter or submit them separately, and creates no Event until that boundary is clear. V1 neither shares one InboxItem across Cases nor creates several Event Cards inside one Case. A later version may split several internal Cases only after introducing an explicit shared-source reference and receiving user confirmation.

`NO_ACTION` preserves the Case, source, and audit history without creating an Event.

### 6. Event combines draft and authoritative state

V1 creates no separate `EventDraft` or Proposal table. Event itself stores current candidate or confirmed data:

```text
Event
  id
  caseId
  type: APPOINTMENT | DEADLINE | REMINDER
  title
  temporalData
  location
  nextAction
  fieldStates
  status:
    COLLECTING
    READY
    CONFIRMED
    IGNORED
    CANCELLED
  pendingOperation: UPDATE | CANCEL | null
  pendingChanges?
  pendingEvidence?
  pendingStatus: COLLECTING | READY | null
  version
  createdAt
  updatedAt
```

Status semantics:

- `COLLECTING`: at least one blocking field is missing or conflicting. Chat shows Draft Progress and one active question.
- `READY`: the deterministic completeness gate passes. Chat shows a confirmable Event Preview Card.
- `CONFIRMED`: the user confirmed the exact current version; official fields become authoritative product state.
- `IGNORED`: the user explicitly dismissed a candidate Event before confirmation.
- `CANCELLED`: a previously confirmed Event was later explicitly cancelled.

Primary transitions:

```text
COLLECTING -> READY
READY -> COLLECTING
READY -> CONFIRMED
COLLECTING | READY -> IGNORED
CONFIRMED -> CANCELLED
```

`COLLECTING` and `READY` are states of the same Event and require no separate draft table. Every status mutation and Event version commit in the same transaction. Important authoritative transitions—confirmation, ignore, applying or discarding a pending operation, and cancellation—also append `EventHistory` in that transaction; ordinary `COLLECTING <-> READY` changes need no separate history snapshot.

### 7. Candidate operations on a confirmed Event use embedded pending fields

When a confirmed Event receives a proposed update or cancellation, its official fields and `CONFIRMED` status remain unchanged. The candidate operation uses:

```text
pendingOperation: UPDATE | CANCEL
pendingChanges?      # UPDATE only: proposed field diff
pendingEvidence      # evidence for candidate fields or the cancellation proposal
pendingStatus: COLLECTING | READY
```

A cancellation reason comes from the source or user message referenced by `pendingEvidence` and appears in the Preview. It is not a proposed field diff on the current Event, so it does not enter `pendingChanges`.

The Agent shows old values, proposed values, evidence, and impact in chat:

- Accept update: the backend reruns the pending gate, atomically applies `pendingChanges`, materializes `pendingEvidence`, increments Event version, clears all pending fields, and appends `UPDATE_APPLIED` history.
- Accept cancellation: the backend atomically sets the Event to `CANCELLED`, increments version, clears all pending fields, and appends `CANCELLED` history.
- Reject: clear every pending field without modifying official fields, and append `PENDING_DISCARDED` history.
- Still blocked: ask one question per turn and store the answer as ChatMessage evidence.

An unconfirmed pending operation never supplies `.ics` export data and never replaces authoritative fields in the Events tab.

### 8. Card, evidence, and external-side-effect boundaries remain

Important fields continue to use:

```text
SUPPORTED_BY_SOURCE
PROVIDED_BY_USER
DEFAULT_ACCEPTED
MISSING
CONFLICTING
```

The backend deterministic gate decides `COLLECTING -> READY`, confirmation eligibility, and whether a pending operation may be applied. Model confidence is not authoritative.

Chat text is not the confirmation target. The user confirms a Preview Card bound to one exact Event version. Confirming an Event and exporting `.ics` remain separate operations; export requires another explicit user action. The system may record only that a file was generated or that the user reported an import; it must not claim Apple Calendar provider confirmation.

### 9. V1 remains fixed orchestration

A single-chat interface does not make V1 an autonomous agent loop. Application code chooses the next step:

```text
receive
-> identify or create Case
-> preserve InboxItem or ChatMessage evidence
-> extract
-> validate
-> ask one blocker or show Event Preview
-> confirm
-> optionally export
```

Dynamic tool selection, checkpoints, budgets, and approval boundaries still belong to V5.

## Consequences

### Benefits

- Users need to understand only Agent, Events, and Settings, not internal workflow objects.
- Global chat provides continuity while Case isolation continues to protect evidence and context.
- One Case and one Event make confirmation, update, cancellation, and Calendar export boundaries direct.
- The embedded pending area keeps confirmed facts stable while an update or cancellation remains a proposal.
- Event state directly drives resume cards and the Events tab without combining multiple Case and Action states into a user view.

### Costs

- The backend must reliably identify, create, or link an internal Case.
- ChatMessage queries must support both a global timeline and Case-bounded model context.
- When a source contains several matters, V1 must ask the user to select or submit them separately; automatic splitting waits until a shared-source model exists.
- A pending operation requires versioning, evidence, concurrency, and audit design.
- The previous Cases page, Case conversation, and multi-Action Case documentation can no longer guide V1 implementation.

## Rejected alternatives

### User-facing Cases workspace

Rejected. Case is a reasoning and evidence-isolation boundary, not the first object users should manage.

### Pass the entire global chat to every model call

Rejected. A global UI does not authorize cross-Case fact use; the backend selects a bounded target-Case context.

### Create one Case for every InboxItem

Rejected. Case represents a matter; updates and cancellation notices for that matter remain separate InboxItems.

### Put multiple Events in one Case

Rejected in V1. Independent Events use independent Cases.

### Separate EventDraft table

Rejected. Pre-confirmation state is represented by Event `COLLECTING`/`READY`, preventing Event and EventDraft drift.

### Return a confirmed Event to unconfirmed state during editing

Rejected. Confirmed fields remain effective while candidate changes stay in the embedded pending fields until the user accepts the exact change.

## Verification

This decision is verified when:

- Navigation exposes only Agent, the later Events tab, and Settings.
- A user never needs to see or select Case/InboxItem.
- Global chat resumes multiple unfinished matters, while each model call receives only one target Case context.
- Clarification answers remain ChatMessage evidence rather than InboxItems.
- A Case can never own two Events.
- An Event with a blocker is `COLLECTING`; after the gate passes it is `READY`.
- No Event becomes `CONFIRMED` without explicit confirmation.
- Editing a confirmed Event changes only the embedded pending area; official fields remain unchanged until acceptance.
- The Events tab shows only Events currently `CONFIRMED`, or formerly confirmed and now `CANCELLED`.
- `.ics` export never happens automatically or disguises a user report as provider confirmation.
- V1 does not depend on a dynamic agent loop.
