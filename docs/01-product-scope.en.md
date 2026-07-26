# LifeInbox Product Scope and Principles

[中文](01-product-scope.md)

The current interaction and domain boundaries are locked by [ADR 0003](adr/0003-single-chat-internal-cases.en.md).

`LifeCase` is the canonical domain and implementation name; this document uses `Case` as shorthand when the meaning is clear.

## 1. Product overview

LifeInbox is a personal life-notice agent with one conversation as its primary interaction.

The user can tell the Agent about a matter directly or paste external notices such as housing inspections, university deadlines, medical appointments, parcel pickups, return deadlines, or subscription renewals. LifeInbox first preserves the original material, then extracts structured information, checks field evidence, resolves blocking gaps step by step, and presents the result as a confirmable Event Preview Card. Only after confirmation does the Event become authoritative product state, and the user may separately export it to Apple Calendar.

Its core promise is:

> Understand an important life notice in under thirty seconds, explain clearly what is still missing, never silently invent dates, never mix evidence across matters, and never act without confirmation.

The product scope stays focused:

```text
life notice
-> evidence-complete Event Preview
-> explicit user confirmation
-> optional Calendar .ics export
-> later update or cancellation
```

LifeInbox is neither a general chatbot nor a task-management back office with AI wrapped around database tables.

## 2. Primary user and initial context

The first user is the product developer. The initial context is an individual living in Sweden who receives English, Swedish, or Chinese notices. The default time zone is `Europe/Stockholm`.

V1 is local-first and single-user. It becomes remotely usable across devices only after V2 adds authentication and owner-only authorization.

## 3. Problem statement

Everyday notices mix context, dates, requirements, updates, and irrelevant text. The user must determine:

- Should this enter a calendar?
- Is it an appointment, deadline, or flexible reminder?
- Which date is the actual event date rather than the message date?
- Are the time, location, time zone, and next action clear?
- Does a new notice create a new matter, or update or cancel an existing one?
- Which source passage or user answer supports each important field?

Copying this information into a calendar is small but repetitive work. Missing a date, using the wrong time zone, or applying one matter's answer to another can cause real loss.

## 4. Core interaction model

LifeInbox follows three mutually constraining principles:

> Single-chat, Card-confirmed, Internally case-scoped.

### 4.1 Single-chat

The user always sees one global, chronological Agent chat. They do not create, name, select, or switch internal workflow objects.

Conversation handles:

- Natural-language intent and external notices.
- A brief explanation of the matter the system understood.
- Draft Progress, the one active blocker, and resume cards.
- Event Previews, proposed updates, and confirmation results.
- Edit, ignore, cancel, query, and export instructions.

Unfinished matters do not move into a user-facing Cases page. The Agent surfaces resume cards in chat, such as “The apartment inspection still needs a start time,” and the user continues by answering directly.

### 4.2 Card-confirmed

A natural-language summary is not final fact. While a blocking field remains, chat shows Draft Progress and one question rather than disguising an incomplete result as a confirmable Card.

Only after the deterministic completeness gate passes does the exact current Event version appear as an Event Preview Card. At minimum, the Card shows:

- Event type and title.
- Relevant fields such as date, time, time zone, location, reminder, and next action.
- The source or user contribution behind each important field.
- Accepted preference defaults, non-blocking warnings, and resolved conflicts.
- `Edit`, `Ignore`, and `Confirm` operations.

The user confirms the exact Event version referenced by the Card. A chat response such as “looks fine” is valid only when the product resolves it to an explicit Confirm of that Card and restates the confirmation target. Ambiguous agreement never counts as confirmation.

### 4.3 Internally case-scoped

One visible chat does not mean passing the entire transcript into every LLM call.

The backend identifies the target internal Case and supplies only:

- That Case's `InboxItem` records.
- `ChatMessage` records linked to that Case.
- Explicitly allowed Settings preferences.
- The Case's current Event plus `pendingOperation`, `pendingChanges`, `pendingEvidence`, and `pendingStatus`.

If a message may refer to multiple matters, the Agent asks the user first. Dates, locations, evidence, and answers never leak silently between Cases.

## 5. Staged product surfaces

### Stage A: Agent + Settings

Initial navigation contains only:

- **Agent**: the only conversation entry point and default home.
- **Settings**: preferences such as default time zone, default appointment duration, reminder lead time, and preferred language.

A setting is not an unconditional fact. When a preference fills a confirmation-blocking field, the Preview identifies it as a default and requires explicit acceptance.

### Stage B: add Events

After V1 can produce confirmed Events reliably, navigation adds:

- **Events**: query, search, and view Events that crossed the confirmation boundary—those currently `CONFIRMED`, plus formerly confirmed Events now `CANCELLED`.

The Events tab does not show `COLLECTING`, `READY`, or `IGNORED` candidates. An Event cancelled after confirmation may remain as history, clearly labeled `CANCELLED`.

Unfinished candidates remain resumable only through Draft Progress and resume cards in Agent chat. Events is neither a second approval inbox nor a Case-management page.

### Objects users never see

Users never see, create, select, or switch:

- `LifeCase` (`Case` for short)
- `InboxItem`
- `ExtractionRun`
- Internal evidence or audit records

These objects support evidence, state, isolation, and diagnosis rather than navigation.

## 6. Internal domain model

### 6.1 ChatMessage: the global timeline

All user and Agent messages form one global timeline:

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

`caseId` is nullable. For example, the system may not yet know which matter a first message belongs to, or a message may be a general interface notice. Once a message supports extraction, clarification, confirmation, update, or cancellation for one matter, it links to that Case.

A user's answer to an Agent clarification remains `ChatMessage` evidence linked to the Case. It is not a new `InboxItem`.

### 6.2 LifeCase (Case): one concrete matter

A `LifeCase` is one concrete real-world matter in the backend, such as one apartment inspection or one product return:

```text
Case
  -> zero or more immutable InboxItems
  -> zero or more linked ChatMessages
  -> zero or one Event
  -> zero or more ExtractionRuns
```

A Case is not an alias for one message or one source. A directly expressed matter may rely only on `ChatMessage` evidence and does not fabricate an InboxItem. When external material exists, the same matter may receive an original notice, a time update, and a cancellation notice, so one Case may own multiple `InboxItem` records. Every source remains preserved; a new source never overwrites an old one.

If one source contains multiple independent matters, V1 first asks the user to select one matter or submit them separately; it creates no Event until the matter boundary is clear. V1 neither shares one InboxItem across Cases nor creates several Events in one Case. A later version may split one source into several internal Cases only after introducing an explicit shared-source reference and receiving user confirmation.

### 6.3 InboxItem: external source material

`InboxItem` represents only external source material brought into the system. V1 supports pasted text; later versions may add email, screenshots, or PDFs.

Invariants:

- Persist external content before calling a model.
- Never silently edit stored content.
- One Case may have no InboxItem or link to several; create one only when external material exists.
- `SUPPORTED_BY_SOURCE` points to a specific InboxItem; `PROVIDED_BY_USER` points to a Case-bound user ChatMessage; `DEFAULT_ACCEPTED` points to a UserPreference the user explicitly accepted.
- A Card-edit command appends an `EVENT_EDIT` user ChatMessage in the same transaction, and field evidence references that message rather than an unauditable transient command.
- Neither Agent replies nor user clarification answers are InboxItems.

### 6.4 Event: candidate and authoritative state

One Case owns at most one Event in V1:

```text
Case.event = zero or one Event
```

V1 creates no separate `EventDraft` or Proposal table. Event itself carries both pre-confirmation candidate state and post-confirmation authoritative state:

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

`NO_ACTION` is a valid Case result: the source and audit history remain, but no Event is created.

## 7. Event lifecycle

### 7.1 Status semantics

- `COLLECTING`: at least one required field is `MISSING` or `CONFLICTING`; chat shows Draft Progress and one active question.
- `READY`: the deterministic completeness gate passes; chat shows a confirmable Event Preview Card.
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

Every status mutation and Event version commit in the same transaction. Important authoritative transitions—confirmation, ignore, applying or discarding a pending operation, and cancellation—also append `EventHistory` in that transaction; ordinary `COLLECTING <-> READY` changes do not require separate history snapshots.

### 7.2 Field evidence and completeness gate

Every important field uses one of:

```text
SUPPORTED_BY_SOURCE
PROVIDED_BY_USER
DEFAULT_ACCEPTED
MISSING
CONFLICTING
```

Deterministic backend rules decide whether an Event may move from `COLLECTING` to `READY`. Model confidence neither replaces evidence nor grants confirmation eligibility.

The shared gate requires an Event type and non-empty title, with an allowed evidence state for every blocking field. The list below contains only the additional type-specific minimums:

- `APPOINTMENT`: date, start time, and time zone are blocking; an end time or explicit user acceptance of the default duration is also required. Location is normally non-blocking and becomes a blocker only under a deterministic product rule that the matter cannot be performed without it.
- `DEADLINE`: due date is blocking; only when a precise time exists must `dueAt` and time zone both be valid.
- `REMINDER`: reminder date is blocking; reminder time and location are normally non-blocking. Never disguise a flexible reminder as a precise appointment.

### 7.3 Ask one blocker at a time

When multiple fields are missing or conflicting, the backend selects the most confirmation-blocking issue with deterministic priority. Each turn asks one question:

1. Store the answer as ChatMessage evidence linked to the current Case.
2. Update the relevant field and evidence.
3. Rerun the gate.
4. Ask the next blocker or show the Event Preview Card.

The user may say “later” at any time. The Event remains `COLLECTING` and returns through a resume card in chat.

### 7.4 Separate explicit confirmation from export

Only an explicit Confirm bound to the exact Event version may perform `READY -> CONFIRMED`.

Confirming an Event and exporting `.ics` are separate operations:

1. The user confirms the Event.
2. The product shows a Calendar Preview.
3. The user explicitly chooses export.
4. The backend generates `.ics` from confirmed official fields.

The system may record “file generated” or “user reported import,” but it must not describe a user report as confirmation from the Apple Calendar provider.

## 8. Later updates to a confirmed Event

When a new source or user message proposes an update or cancellation, the confirmed official fields and `CONFIRMED` status remain unchanged. The candidate operation uses four embedded pending fields:

```text
pendingOperation: UPDATE | CANCEL
pendingChanges?      # UPDATE only: proposed field diff
pendingEvidence      # evidence for candidate fields or the cancellation proposal
pendingStatus: COLLECTING | READY
```

A cancellation reason comes from the source or user message referenced by `pendingEvidence` and appears in the Preview. It does not enter `pendingChanges` unless the authoritative Event schema later gains such a field.

The Agent shows the old value, proposed value, evidence, and impact in chat:

- **Accept update**: rerun the pending gate, then atomically apply `pendingChanges`, materialize `pendingEvidence`, increment Event version, clear all pending fields, and append `UPDATE_APPLIED` history.
- **Accept cancellation**: rerun the pending gate, then atomically set the Event to `CANCELLED`, increment version, clear all pending fields, and append `CANCELLED` history.
- **Reject**: clear every pending field without modifying official fields, and append `PENDING_DISCARDED` history.
- **Still blocked**: ask one question per turn and continue storing answers as ChatMessage evidence.

An unconfirmed pending operation:

- Never replace authoritative fields in the Events tab.
- Never supply `.ics` export data.
- Never make the Event temporarily leave `CONFIRMED`.

If a source says a confirmed matter was cancelled, the Agent presents the cancellation evidence and asks for explicit confirmation. Only then does the Event enter `CANCELLED`.

## 9. Fixed V1 orchestration

```text
receive message
-> identify or create internal Case
-> preserve InboxItem or ChatMessage evidence
-> extract candidate Event fields
-> validate schema, evidence, and completeness
-> ask one blocker or show Event Preview Card
-> explicit Confirm
-> optionally export .ics
```

Application code decides every allowed transition, retry, and side effect. A single-chat experience does not make V1 an autonomous agent loop.

V1 does not allow the model to:

- Select arbitrary tools freely.
- Bypass the gate or confirmation boundary.
- Export or write to Calendar automatically.
- Silently apply one matter's context to another.

Dynamic tool selection, checkpoints, pause/resume, budgets, and approval boundaries belong to V5.

## 10. Event types

### Appointment

A matter that occurs during a specific time range, such as a medical appointment or housing inspection. It requires a start time plus either an end time or explicit acceptance of the default duration; location and reminder are normally optional.

### Deadline

Something that must be completed by a date or time, such as an application or return deadline. It is not automatically an all-day appointment.

### Reminder

Something the user needs to remember on a date without necessarily occupying a fixed time range, such as cancelling a subscription or collecting a parcel.

### No action

Pure information, marketing, or a notice that requires no calendar behavior. The system preserves the Case and source but creates no Event.

## 11. Product principles and invariants

### Preserve before interpreting

A model timeout, invalid output, or extraction failure never loses the original notice.

### Conversation does not replace structured state

Chat handles interaction. Event data, evidence, versions, confirmation, export, and audit records remain queryable structured state.

### A global timeline is not global model context

The user can handle many matters in one chat, but each model call receives only the allowed target-Case context.

### Case represents a matter; InboxItem represents a source

One matter may have multiple sources. In V1, one InboxItem belongs to one Case; if material contains several independent matters, the Agent asks the user to select or submit them separately. The concepts are not interchangeable.

### Evidence completeness precedes confirmation

Any blocker prevents an Event from becoming `READY`. Only explicit confirmation of the exact version creates authoritative state.

### Confirmed facts remain stable

Candidate updates or cancellations use the embedded pending area; official fields and export data remain unchanged until acceptance.

### Humans control external side effects

Confirmation and export remain separate. V1 never writes to Calendar, sends email, or triggers another external action automatically.

### Represent external state honestly

Generating a file, a user reporting import, and provider confirmation are three different facts and must never be conflated.

### Reliability before autonomy

V1 uses fixed orchestration. V5 introduces a dynamic agent loop only after evaluation, observability, budget, and approval boundaries exist.

### Privacy by default

Send only the minimum context needed for the current Case to a model, and preserve the ability to export and delete data later.

## 12. Initial success metrics

V1 does not optimize for message count. It optimizes for completing one matter safely:

- A typical notice produces a correct interpretation or one clear blocker within thirty seconds.
- Every required field of a confirmed Event has source evidence, user-provided evidence, or an explicitly accepted default.
- No authoritative Event or `.ics` export exists without explicit confirmation.
- Evidence and context never leak between Cases.
- A proposed change never overwrites confirmed official fields before acceptance.
- The user completes the flow without understanding Case, InboxItem, or the Event state machine.

## 13. Five-minute product demo

1. Open Agent chat and paste a notice with an appointment date but no start time.
2. The system preserves the source, shows Draft Progress, and asks only for the start time.
3. The user answers; the system stores it as ChatMessage evidence.
4. After the gate passes, the Agent shows an Event Preview Card bound to an exact version with field evidence.
5. The user confirms the Event; it enters `CONFIRMED`.
6. The user separately chooses export and downloads `.ics`.
7. The user pastes a time update for the same matter; the Agent shows old and new values plus evidence in `pendingChanges`.
8. Before acceptance, the Events tab and any repeated `.ics` export still use the original official fields.
9. The user accepts; official fields update atomically and the Event version increments.

If the Events tab is not yet part of the current delivery stage, step 8 verifies the backend authoritative fields and Calendar Preview instead.

## 14. Non-goals

V1 does not include:

- User-facing Cases, InboxItems, or workflow tables.
- General task management, notes, or CRM.
- Automatic access to a complete mailbox or arbitrary third-party account.
- Automatic Apple Calendar writes.
- Multi-user collaboration or shared calendars.
- A separate `EventDraft` or Proposal data model.
- Multiple Events inside one Case.
- A dynamic, autonomous agent tool loop.
- External side effects without user confirmation.
