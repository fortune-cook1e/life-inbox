# LifeInbox V1 Roadmap

[中文](02-v1-roadmap.md)

## 1. V1 outcome

LifeInbox V1 is a personal life-notice product whose entry point is a single Agent Chat.

The user does not first create a Case, select a table, or understand the internal data model. In one global chat timeline, they:

```text
directly describe one matter or paste an external notice
-> review what the Agent currently understands and its evidence
-> answer one blocking question at a time
-> review an Event Preview Card
-> explicitly confirm, ignore, update, or cancel
-> explicitly export .ics after confirmation
-> later query authoritative Events through chat or Events
```

V1 product boundaries:

- The initial UI has one global `Agent` Chat and a low-prominence `Settings` entry.
- The `Events` tab appears only after confirmation capability is complete.
- Events queries only authoritative Events in `CONFIRMED` or `CANCELLED`.
- `COLLECTING`, `READY`, unresolved questions, and unconfirmed updates do not enter the Events list; they continue as resume cards in Chat.
- `LifeCase` and `InboxItem` are entirely internal implementation details. The user never enters a Case page.
- One LifeCase represents one concrete matter and owns at most one Event.
- Each V1 input handles at most one concrete matter. When multiple matters are detected, the system asks the user to split or select rather than creating multiple Events in one Case.
- Every external side effect requires explicit user action.

The V1 agent experience uses a fixed, testable application workflow:

```text
route intent
-> persist message/optional source/state
-> extract
-> validate evidence
-> run completeness gate
-> ask one question or show one card
-> wait for explicit command
```

The model cannot freely select arbitrary tools, bypass the state machine, confirm an Event, export a calendar, or automatically modify authoritative fields. A dynamic agent loop is outside V1.

## 2. V1 user interface

### 2.1 Agent: the only primary workspace

Agent is the default route and the primary V1 interaction surface.

It contains:

- One global chat timeline with stable `createdAt, id` ordering.
- One input for pasting notices, answering questions, querying Events, or asking general questions.
- Status messages for source saved, analysis in progress, analysis failure, and retry.
- A Draft Progress Card for a `COLLECTING` Event.
- A confirmable Preview Card for a `READY` Event.
- A read-only authoritative summary for a `CONFIRMED` or `CANCELLED` Event.
- A before-after Preview Card for a confirmed update or cancellation.
- Resume cards for unfinished work.
- A low-prominence entry to Settings.
- A tab to Events after V1.3.

The user sees one continuous chat and does not switch into a Case conversation. A global UI does not mean global model context:

> The UI displays a user-global timeline; each model call receives only the current LifeCase's sources, messages, Event, pending question, and allowed preferences.

Dates, locations, and clarification answers from different matters must not enter one another's model context merely because they appear on the same page.

Hard invariant:

```text
GLOBAL_CHAT_UI != GLOBAL_PROMPT_CONTEXT

Every model call for domain extraction, clarification, update, or cancellation
=> binds exactly one target caseId
=> loads only that Case's InboxItems, related ChatMessages, Event, PendingQuestion,
   and allowed preferences

GENERAL / EVENT_QUERY routing
=> may have no caseId
=> does not automatically include the global transcript

Never send the entire global Chat timeline directly to the model
```

### 2.2 Card states in Chat

The same Event projects into different cards according to its state. V1 has no separate Event draft entity:

```text
Event.COLLECTING
-> Draft Progress Card
-> show known fields, evidence, warnings, and one active question
-> no Confirm

Event.READY
-> Event Preview Card
-> show complete candidate values, evidence, and non-blocking warnings
-> allow Edit, Ignore, Confirm

Event.CONFIRMED
-> Authoritative Event Card
-> show confirmed official fields
-> allow Export .ics, Propose update, Propose cancellation

Event.CONFIRMED + pendingOperation
-> Before-after Preview Card
-> official fields remain unchanged
-> pending values appear only on the proposed side

Event.IGNORED
-> show an ignored result in chat

Event.CANCELLED
-> show an authoritative cancelled Event in Chat and Events
```

Natural-language messages explain and guide. Card data comes from the structured Event store and is never recovered by reparsing assistant text.

### 2.3 Events: post-confirmation query view

The Events tab appears in V1.3 because no authoritative Event exists before confirmation capability.

It reads only:

```text
Event.status IN (CONFIRMED, CANCELLED)
```

It does not parse Chat transcripts to infer Events, and it does not show:

- `COLLECTING`.
- `READY`.
- `IGNORED`.
- Unconfirmed `pendingChanges`.
- Internal `NO_ACTION` Cases.

Recommended V1 Events behavior:

- Sort by date or recent update.
- Search title, location, and date.
- Filter `Confirmed` and `Cancelled`.
- Show Calendar export state.
- When a confirmed Event has an unfinished pending operation, show only an `Update pending` or `Cancellation pending` badge and link back to the corresponding Chat resume card. Events still displays only official fields.

Events is a query view, not a second authoritative state model, and it does not need a database-style table.

### 2.4 Settings: low-prominence preferences

V1 Settings contains:

- Default time zone.
- Default appointment duration.
- Default reminder lead time.
- Preferred Agent response language.

A preference can only propose a candidate. A default that fills a blocking field appears in Chat/Card first and becomes `DEFAULT_ACCEPTED` only after user acceptance.

## 3. Fixed intent router

The V1 router recognizes only five top-level intents:

```text
NEW_MATTER
NEW_SOURCE
CLARIFICATION_ANSWER
EVENT_QUERY
GENERAL
```

### NEW_MATTER

The user directly states one life matter, such as “remind me to do laundry the day after tomorrow.” The system creates an internal LifeCase and uses the user ChatMessage as `PROVIDED_BY_USER` evidence; it does not create an InboxItem.

### NEW_SOURCE

The user submits a new external notice. The system creates or explicitly selects an internal LifeCase, saves an immutable InboxItem, and then extracts.

### CLARIFICATION_ANSWER

The user answers a structured `PendingQuestion`. The message binds the question's assistant message through `replyToMessageId`; the backend then verifies that the question remains `OPEN`.

### EVENT_QUERY

The user queries confirmed or cancelled Events. Natural language may be parsed into a bounded Query DTO, but the final query reads only the Event store:

```text
status IN (CONFIRMED, CANCELLED)
```

Authoritative results must never be reconstructed by searching or reinterpreting Chat text.

### GENERAL

Help, product explanation, or general conversation that does not mutate domain state. It may persist as a ChatMessage with `caseId = null`, but it cannot create an InboxItem, Event, or external side effect.

### When routing is uncertain

- Do not guess between two write intents.
- Ask whether the user is directly creating a matter, submitting an external notice, answering the current question, or querying an existing Event.
- Only an explicit `replyToMessageId` allows a message to be consumed as a PendingQuestion answer.
- Automatic matching of an arbitrary new source to a historical Event update or cancellation may be deferred. V1 must not silently modify a historical Event because text looks similar.

## 4. V1 architecture

```text
Next.js Web
    |-- Agent
    |-- Events       # from V1.3
    `-- Settings
          |
          | HTTP
          v
NestJS modular monolith
    |-- chat
    |-- routing
    |-- cases        # internal
    |-- inbox        # internal immutable sources
    |-- extraction
    |-- events
    |-- calendar-export
    `-- preferences
          |
          |-- PostgreSQL through Drizzle ORM
          |-- one LLM provider
          `-- deterministic gates and .ics generator
```

These module names and later APIs are candidate implementation boundaries; they do not claim the backend endpoints already exist.

V1 has no runtime dependency on Redis, object storage, pgvector, or an agent framework. LLM calls never run inside long-held database transactions.

### 4.1 Overall data-flow diagram

```text
                         GLOBAL CHAT UI
                               |
                               v
                         ChatMessage input
                               |
                               v
                      Fixed Intent Router
          +--------------------+--------------------+
          |                    |                    |
 NEW_MATTER / NEW_SOURCE  CLARIFICATION_ANSWER     EVENT_QUERY / GENERAL
          |                    |                    |
          v                    v                    +--> Event store query
   Internal LifeCase     PendingQuestion                 status in
          |              replyTo binding             CONFIRMED/CANCELLED
          +-- NEW_SOURCE only                         |
          |      `--> immutable InboxItem             +--> Chat result
          |                    |                      +--> Events tab
          v                    v
   ExtractionRun       same internal Event
          |                    |
          +---------+----------+
                    |
                    v
             Event (0..1 / Case)
          COLLECTING <-> READY
                    |
              explicit Confirm
                    |
                    v
               CONFIRMED
                    |
           +--------+---------+
           |                  |
   Chat cards/resume     Events authoritative query

Model context builder
  -> receives one explicit target caseId
  -> loads only that Case aggregate
  -> never receives the global Chat transcript by default
```

The diagram separates two dimensions:

- The Chat timeline is a user-global read model.
- Domain mutation and model context always bind one internal LifeCase.

## 5. V1 domain model

Create entities and fields only when their milestone begins.

### 5.1 LifeCase: internal matter boundary

`LifeCase` represents one concrete life matter. It is not a user-facing page or chat channel. `LifeCase` is the canonical domain and implementation name; this document uses `Case` as shorthand when the meaning is clear:

```text
id
status: OPEN | CLOSED
resolution:
  EVENT_CONFIRMED
  EVENT_IGNORED
  NO_ACTION
  EVENT_CANCELLED
  null
createdAt
updatedAt
version
```

Aggregate cardinality:

```text
User-global timeline
  |
  `-- 0..* ChatMessage
        `-- caseId? ---------------------------+
                                                  |
                                                  v
LifeCase (internal, one concrete matter) <---------+
  |-- 0..* immutable InboxItem
  |-- 0..* case-bound ChatMessage
  |-- 0..* PendingQuestion
  |-- 0..* ExtractionRun
  `-- 0..1 Event
        |-- 0..* EventFieldEvidence
        |-- 0..* EventHistory
        `-- 0..* CalendarExport

Event pendingOperation
  |-- pendingChanges
  |-- pendingEvidence
  `-- pendingStatus

UserPreference
  `-- user-scoped, read-only candidate input to a Case workflow
```

The database requires:

```text
UNIQUE(event.caseId)
```

Case rules:

- A directly stated matter may have no InboxItem; its user ChatMessage is the structured evidence source.
- A new matter is `OPEN` during extraction and clarification.
- After the initial Event is confirmed or ignored, or the outcome becomes `NO_ACTION`, the Case becomes `CLOSED` with a resolution.
- Starting an explicit update/cancellation on a confirmed Event may atomically reopen the same Case and clear its resolution.
- Applying or discarding a pending update returns the Case to `CLOSED + EVENT_CONFIRMED`.
- Confirming cancellation moves the Case to `CLOSED + EVENT_CANCELLED`.
- Case status does not replace Event status and is not exposed as a user filter.

### 5.2 InboxItem: immutable external source

`InboxItem` represents a source arriving from outside the product. It is not created for every user chat message:

```text
id
caseId
submittedByMessageId
rawText
contentHash
sourceType: PASTED_TEXT
sourceReceivedAt
referenceDate
referenceDateSource:
  NOTICE_METADATA
  USER_PROVIDED
  SUBMISSION_TIME
createdAt
```

Rules:

- `rawText` is immutable after storage.
- A Case may own multiple InboxItems so an explicit future update or cancellation notice can attach to the same matter.
- Only `NEW_SOURCE` creates an InboxItem.
- `NEW_MATTER`, `CLARIFICATION_ANSWER`, `EVENT_QUERY`, and `GENERAL` do not create InboxItems.
- For example, “remind me to do laundry the day after tomorrow” creates only a Case, ChatMessage, and eventual Event; that ChatMessage is `PROVIDED_BY_USER` evidence.
- `contentHash` supports duplicate warnings; it is not an idempotency key and is not unique by default.
- Identical text may be two real sources. Network retries use command/client identifiers.
- Persist the source before calling the model.
- Relative dates in `NEW_MATTER` may use `ChatMessage.createdAt` in the user's time zone as the request anchor. Relative dates in `NEW_SOURCE` require the InboxItem's trusted referenceDate; paste time must not masquerade as an old notice's received time.

### 5.3 ChatMessage: global timeline

```text
id
caseId?                 # nullable
role: USER | ASSISTANT | SYSTEM
kind:
  USER_TEXT
  SOURCE_SUBMITTED
  CLARIFICATION_QUESTION
  CLARIFICATION_ANSWER
  EVENT_EDIT
  DRAFT_PROGRESS
  EVENT_PREVIEW
  EVENT_CONFIRMED
  EVENT_UPDATE_PREVIEW
  EVENT_CANCELLATION_PREVIEW
  EVENT_QUERY_RESULT
  STATUS
content
replyToMessageId?
clientMessageId?
referenceType:
  INBOX_ITEM
  PENDING_QUESTION
  EXTRACTION_RUN
  EVENT
  EVENT_HISTORY
  CALENDAR_EXPORT
  null
referenceId?
referenceVersion?
createdAt
```

Rules:

- The UI reads a user-global ChatMessage timeline rather than entering a Case-specific transcript.
- `caseId = null` applies to GENERAL, EVENT_QUERY not bound to one Event, and global system messages.
- Messages related to source intake, clarification, or Event mutation bind an internal caseId.
- Structured Card data comes from the referenced Event/EventHistory and is not copied into message text as a second source of truth.
- Messages do not store hidden chain-of-thought.
- An assistant message cannot mutate domain state by itself; mutations require backend commands.
- Global timeline pagination uses a stable cursor such as `(createdAt, id)`.

### 5.4 PendingQuestion: the single active blocking question

```text
id
caseId
eventId?
assistantMessageId
kind: FIELD_CLARIFICATION | MATTER_SELECTION
fieldKey?
status: OPEN | ANSWERED | SUPERSEDED | CANCELLED
expectedEventVersion?
answeredByMessageId?
createdAt
answeredAt?
```

Constraints and rules:

- Each Case has at most one `OPEN` PendingQuestion.
- A field question identifies its Event and field.
- A user answer must use `replyToMessageId` for the corresponding `assistantMessageId`.
- The backend verifies that the question remains `OPEN` and validates `expectedEventVersion` when applicable.
- One answer command is consumed at most once.
- After the gate reruns, the old question becomes `ANSWERED` or `SUPERSEDED` before a next question is created.

### 5.5 ExtractionRun: one model attempt

```text
id
caseId
inboxItemId?
triggerMessageId
purpose:
  MATTER_EXTRACTION
  SOURCE_EXTRACTION
  CLARIFICATION_NORMALIZATION
  UPDATE_EXTRACTION
  CANCELLATION_EXTRACTION
model
promptVersion
status: RUNNING | SUCCEEDED | FAILED | ABANDONED
structuredOutput
errorCode?
latencyMs?
inputTokens?
outputTokens?
estimatedCost?
startedAt
completedAt?
```

Rules:

- Each Retry creates a new ExtractionRun.
- A stale `RUNNING` run may become `ABANDONED` before retry.
- Run failure cannot delete ChatMessages, InboxItems, Cases, Events, or user answers.
- Prompt/model version and cost remain traceable.

### 5.6 Event: the single current work object

`Event` carries both unconfirmed candidates and authoritative confirmed data. V1 has no separate EventDraft:

```text
id
caseId
type: APPOINTMENT | DEADLINE | REMINDER
status:
  COLLECTING
  READY
  CONFIRMED
  IGNORED
  CANCELLED
title
temporalData
location?
nextAction?
version
confirmedAt?
cancelledAt?

pendingOperation: UPDATE | CANCEL | null
pendingChanges?
pendingEvidence?
pendingStatus: COLLECTING | READY | null

createdAt
updatedAt

UNIQUE(caseId)
```

Time semantics:

```text
APPOINTMENT:
  startAt
  endAt
  timeZone

DEADLINE:
  dueDate
  dueAt?
  timeZone?

REMINDER:
  remindOn
  remindAt?
  timeZone?
```

`startAt`, `endAt`, and `dueAt` are instants. `dueDate` and `remindOn` are date-only values. The schema must not turn the latter into fictional midnight UTC instants.

Initial candidate rules:

- Extraction creates one Event whose gate-derived status is `COLLECTING` or `READY`.
- While `COLLECTING`/`READY`, user edits and clarification directly update that Event and increment `version`.
- Rerunning the gate after an edit may move the Event between `COLLECTING` and `READY`.
- Edits do not create active revision objects.
- Only an explicit confirm command performs `READY -> CONFIRMED`.
- `COLLECTING` or `READY` may explicitly become `IGNORED`.

Confirmed-change rules:

- Proposed changes cannot directly overwrite the official fields of a `CONFIRMED` Event.
- An update candidate uses all four pending fields. A cancellation has no proposed field diff, so it uses `pendingOperation`, `pendingEvidence`, and `pendingStatus` while leaving `pendingChanges` empty.
- While a pending operation exists, `Event.status` remains `CONFIRMED`.
- Queries and `.ics` read official fields only, never pendingChanges.
- A gate-passing pending update appears as a before-after Preview in Chat.
- Confirming an update atomically applies pendingChanges, replaces the affected official evidence, clears all pending fields, and increments `version`; the Event remains `CONFIRMED`.
- Confirming cancellation atomically changes status to `CANCELLED`, clears pending fields, and increments `version`.
- Discarding a pending operation only clears pending fields; the official Event is unchanged.
- `CANCELLED` is an authoritative terminal state in V1. Reactivation needs a future explicit design.

Pending-field consistency:

```text
pendingOperation IS NULL
<=> pendingChanges IS NULL
    AND pendingEvidence IS NULL
    AND pendingStatus IS NULL

pendingOperation == UPDATE
=> pendingChanges contains the proposed field diff

pendingOperation == CANCEL
=> pendingChanges IS NULL

pendingStatus == READY
=> the pending operation's blocking gate passes

Event.status == CANCELLED
=> no pending operation exists
```

### 5.7 EventFieldEvidence: support for current fields

```text
id
eventId
eventVersion
fieldKey
fieldValueHash
requirement: BLOCKING | NON_BLOCKING | OPTIONAL
evidenceState:
  SUPPORTED_BY_SOURCE
  PROVIDED_BY_USER
  DEFAULT_ACCEPTED
  MISSING
  CONFLICTING
sourceType:
  INBOX_ITEM
  CHAT_MESSAGE
  USER_PREFERENCE
  null
sourceId?
startOffset?
endOffset?
quote?
createdAt
```

Rules:

- `SUPPORTED_BY_SOURCE` points into an immutable InboxItem.
- `PROVIDED_BY_USER` points to a user ChatMessage.
- An explicit Card-edit command appends a Case-bound `EVENT_EDIT` user ChatMessage in the same transaction, and field evidence references that message.
- `DEFAULT_ACCEPTED` points to a UserPreference value explicitly accepted by the user.
- Blocking `MISSING` and `CONFLICTING` cannot pass the gate.
- Model confidence is not an evidence state.
- An initial unconfirmed Event may directly update its current evidence.
- A confirmed Event keeps official evidence unchanged while an update's candidate field evidence, or a cancellation's operation-level evidence and reason, lives in `pendingEvidence`.
- Applying an update atomically materializes pendingEvidence as EventFieldEvidence for the new eventVersion.
- EventHistory stores before/after evidence snapshots for audit.

### 5.8 EventHistory: append-only snapshots of important transitions

`EventHistory` records confirmation, applied update, pending-operation discard, ignore, and cancellation transitions. It is not an active draft:

```text
id
eventId
eventVersion
operation:
  CONFIRMED
  IGNORED
  UPDATE_APPLIED
  PENDING_DISCARDED
  CANCELLED
fromStatus
toStatus
beforeSnapshot?
afterSnapshot?
pendingSnapshot?
evidenceSnapshot?
actor: USER | SYSTEM
commandId
idempotencyKey?
createdAt
```

Rules:

- The current Event row is authoritative for current state.
- History is an append-only transition snapshot.
- Confirm, ignore, update application, pending discard, and cancellation atomically update Event, insert EventHistory, and append the status ChatMessage.
- History never becomes the draft currently being edited.
- `beforeSnapshot`/`afterSnapshot` explains what was confirmed and what changed.

### 5.9 CalendarExport: explicit, idempotent file export

V1 does not need an intermediate CalendarDraft:

```text
id
eventId
eventVersion
stableUid
sequence
eventSnapshot
contentHash
idempotencyKey
exportedAt

UNIQUE(idempotencyKey)
```

Rules:

- Ordinary `.ics` export requires `Event.status == CONFIRMED`.
- Export reads current official Event fields and evidence, never pendingChanges.
- Deterministic application code generates `.ics`; the model does not.
- A retry with the same idempotency key returns the same record and bytes.
- Later applied updates reuse the Event's stable UID and consistently increment sequence.
- A `CANCELLED` Event remains queryable in Events. Calendar cancellation files are not automatically in V1 unless Apple Calendar behavior is separately specified and verified.
- LifeInbox can prove that it generated a file, not that Apple Calendar imported it.

### 5.10 UserPreference

```text
id
ownerKey
defaultTimeZone
defaultAppointmentDurationMinutes
defaultReminderLeadMinutes
preferredLanguage
createdAt
updatedAt
version
```

V1 may use one local ownerKey. A preference is a candidate source and does not automatically become a confirmed Event field.

## 6. Deterministic completeness gate

The backend runs the same gate:

- After initial extraction.
- After every clarification or direct edit.
- Before presenting an Event as a READY Preview.
- When accepting the initial Confirm command.
- Before a pending update/cancellation becomes READY.
- When accepting a pending-operation Confirm command.
- Before exporting `.ics`.

Frontend buttons are not a safety boundary.

### 6.1 Shared rules

- Event type and a non-empty title exist.
- Every blocking field is `SUPPORTED_BY_SOURCE`, `PROVIDED_BY_USER`, or `DEFAULT_ACCEPTED`.
- Blocking `MISSING` or `CONFLICTING` cannot pass.
- Values pass type, range, time-zone, and cross-field validation.
- A pending operation has its own gate and cannot borrow official fields to conceal a blocker in the proposed change.
- Confirm reloads the current Event and recomputes eligibility; it never trusts client-submitted `ready=true`.

### 6.2 Rules by type

```text
APPOINTMENT
  blocking:
    date + start time
    timeZone
    end time or user-accepted default duration
  normally non-blocking:
    location
    nextAction

DEADLINE
  blocking:
    dueDate
  if precise time is present:
    dueAt + timeZone must be valid
  normally non-blocking:
    nextAction

REMINDER
  blocking:
    remindOn
  normally non-blocking:
    remindAt
    location
```

When a location conflict or missing location makes the matter impossible to perform, policy may elevate it to blocking, but that rule must be deterministic and tested.

### 6.3 Ask one question at a time

Fixed priority:

```text
trusted referenceDate
-> matter selection
-> Event type conflict
-> date / dueDate / remindOn
-> start time
-> end time or default-duration acceptance
-> timeZone
-> another blocking conflict
```

After each gate run:

- With no blocker, Event or pendingStatus becomes `READY`.
- With a blocker, create only one OPEN PendingQuestion.
- Non-blocking gaps appear as warnings without another question.
- If a new answer invalidates an old question, mark the old question `SUPERSEDED`.

## 7. One input handles one matter

Model output is a single result rather than `events[]`:

```text
outcome:
  EVENT
  NO_ACTION
  MULTIPLE_MATTERS

operationHint:
  CREATE
  UPDATE
  CANCEL
  null

event?
noActionReason?
noActionEvidence?
mattersSummary?
relatedEventHint?
warnings
```

Hard invariants:

```text
EVENT
=> event exists
=> the current Case does not already own another Event

NO_ACTION
=> event is empty
=> a reason and verifiable evidence exist

MULTIPLE_MATTERS
=> event is empty
=> mattersSummary identifies at least two distinct matters
```

For `MULTIPLE_MATTERS`:

- Do not create multiple Events.
- Do not compress multiple matters into one Event.
- Create a `MATTER_SELECTION` PendingQuestion.
- Ask the user to select the one matter for the current Case or split the notice into separate inputs.
- After selection, the current Case may create at most one Event; remaining matters require independent submissions.

`operationHint` and `relatedEventHint` reserve structure for future automatic historical update/cancellation detection. V1 may show a hint or require explicit Event selection, but it cannot automatically mutate a matched historical Event.

## 8. Complete data flows

### 8.1 New matter or source: persist before model call

Final V1 flow:

```text
POST ChatMessage(intent=NEW_MATTER | NEW_SOURCE, clientMessageId)
-> validate size and input
-> short transaction:
   - idempotently save USER ChatMessage
   - create or explicitly reopen/select one internal LifeCase
   - NEW_SOURCE only: save immutable InboxItem
   - create RUNNING ExtractionRun
   - link all identifiers
-> commit
-> call LLM with timeout outside transaction
-> validate structured schema and source/message evidence
-> short transaction:
   - mark ExtractionRun SUCCEEDED
   - EVENT:
       create the Case's only Event as COLLECTING or READY
       save EventFieldEvidence
       create one PendingQuestion or EVENT_PREVIEW Assistant ChatMessage
   - NO_ACTION:
       close Case with NO_ACTION
       append result Assistant ChatMessage
   - MULTIPLE_MATTERS:
       create MATTER_SELECTION PendingQuestion
       append one Assistant question
-> commit
```

If provider, schema, or evidence validation fails:

```text
-> mark ExtractionRun FAILED in a short transaction
-> retain case, user message, and optional source
-> append recoverable error + Retry message
```

A direct matter or first external source normally creates a new Case. When the user enters through an explicit Update/Cancel action on a confirmed Event, a new external source attaches to that Event's existing Case and reopens the Case in the same transaction.

### 8.2 Clarification answer: replyTo binds PendingQuestion

```text
POST ChatMessage(
  intent=CLARIFICATION_ANSWER,
  replyToMessageId,
  clientMessageId,
  expectedEventVersion
)
-> resolve replyToMessageId -> OPEN PendingQuestion
-> reject answered/superseded question or Case mismatch
-> idempotently save user answer
-> if normalization needs LLM:
   create ExtractionRun and commit before provider call
-> normalize and validate answer outside long transaction
-> short transaction:
   - recheck PendingQuestion and expected Event version
   - update the same Event or its pending fields
   - version++
   - save evidence
   - mark question ANSWERED
   - rerun gate
   - create at most one next PendingQuestion
   - append Draft Progress or Preview Assistant message
-> commit
```

A stale answer returns `409` and is not applied to a newer Event version.

### 8.3 Editing an unconfirmed Event

```text
PATCH Event(eventId, expectedVersion, changes)
-> require status COLLECTING or READY
-> require expectedVersion == Event.version
-> validate command and user evidence
-> in the same transaction append case-bound EVENT_EDIT user ChatMessage
-> conditionally update the same Event row
-> replace affected EventFieldEvidence
-> version++
-> rerun gate
-> COLLECTING or READY
-> supersede obsolete question
-> append progress/preview ChatMessage
```

No separate draft/revision record exists.

The `EVENT_EDIT` ChatMessage, Event mutation, affected EventFieldEvidence, and new version commit in the same transaction.

### 8.4 Initial confirmation

```text
POST Confirm(eventId, expectedVersion, idempotencyKey)
-> short transaction
-> load Event and Case
-> require Event.status == READY
-> require expectedVersion == Event.version
-> rerun completeness and evidence gate
-> conditional READY -> CONFIRMED
-> version++
-> close Case with EVENT_CONFIRMED
-> append EventHistory before/after snapshot
-> append EVENT_CONFIRMED ChatMessage
-> commit
```

Confirmation does not export `.ics` or create an external calendar event.

A repeated command returns the original result. Reusing an Idempotency Key with a different payload returns a conflict.

### 8.5 Ignore

```text
POST Ignore(eventId, expectedVersion)
-> require COLLECTING or READY
-> require expectedVersion == Event.version
-> conditional -> IGNORED
-> version++
-> close Case with EVENT_IGNORED
-> append EventHistory + ChatMessage
```

`IGNORED` does not enter the Events tab.

### 8.6 Event query

```text
Chat intent EVENT_QUERY
-> parse bounded filters
-> validate filter schema
-> query Event table only
-> WHERE status IN (CONFIRMED, CANCELLED)
-> append EVENT_QUERY_RESULT ChatMessage
```

Queries never read InboxItems, assistant prose, or pendingChanges to re-infer the current authoritative Event.

### 8.7 Confirmed update: before-after, then apply

V1 may first support explicit update from an Event Card. Automatic routing from arbitrary new sources to historical Events may be deferred.

```text
Start update(eventId, expectedVersion, optional new source)
-> require Event.status == CONFIRMED
-> require expectedVersion == Event.version
-> if source exists, append immutable InboxItem to same Case
-> reopen Case
-> set:
   pendingOperation = UPDATE
   pendingChanges
   pendingEvidence
   pendingStatus = COLLECTING or READY
-> when values come from a Card edit, append case-bound EVENT_EDIT user ChatMessage in the same transaction
-> version++
-> ask one question or show before-after Preview in Chat
```

Before-after Card:

```text
Before = Event authoritative fields
After  = authoritative fields overlaid with pendingChanges
```

Confirmation:

```text
POST ConfirmPending(eventId, expectedVersion, idempotencyKey)
-> require status CONFIRMED
-> require expectedVersion == Event.version
-> require pendingOperation UPDATE
-> require pendingStatus READY
-> rerun pending gate
-> atomically:
   capture before snapshot
   apply pendingChanges to official fields
   materialize pendingEvidence
   clear all pending fields
   version++
   close Case with EVENT_CONFIRMED
   append UPDATE_APPLIED EventHistory before/after
   append Assistant ChatMessage
```

Official fields remain unchanged until the final transaction commits.

### 8.8 Confirmed cancellation: before-after, then cancel

```text
Start cancellation(eventId, expectedVersion, optional new source)
-> require status CONFIRMED
-> require expectedVersion == Event.version
-> attach source to same Case when present
-> reopen Case
-> pendingOperation = CANCEL
-> pendingChanges = null
-> pendingEvidence = source or explicit user evidence, including a cancellation reason when present
-> pendingStatus = COLLECTING or READY
-> when cancellation is stated directly, append case-bound EVENT_EDIT user ChatMessage in the same transaction
-> version++
-> show cancellation Preview
```

Confirmation:

```text
POST ConfirmPending(eventId, expectedVersion, idempotencyKey)
-> require expectedVersion == Event.version
-> require pendingOperation CANCEL and pendingStatus READY
-> rerun pending gate
-> atomically:
   capture before snapshot
   Event.status = CANCELLED
   clear pending fields
   version++
   close Case with EVENT_CANCELLED
   append CANCELLED EventHistory
   append Assistant ChatMessage
```

Cancelling the LifeInbox Event does not delete or cancel an Event already imported into Apple Calendar. V1 states this external boundary honestly.
A cancellation reason is displayed from `pendingEvidence`; it is not written into `pendingChanges` as a field that does not exist in the authoritative Event schema.

### 8.9 Discard a proposed update or cancellation

Rejecting a proposed update or cancellation uses one shared command:

```text
POST DiscardPending(eventId, expectedVersion, idempotencyKey)
-> require Event.status == CONFIRMED
-> require pendingOperation != null
-> require expectedVersion == Event.version
-> atomically:
   capture pendingOperation, pendingChanges, and pendingEvidence snapshot
   clear all pending fields
   version++
   close Case with EVENT_CONFIRMED
   append PENDING_DISCARDED EventHistory with pending snapshot
   append Assistant ChatMessage
```

Discard applies no candidate value and never records a proposed cancellation as completed. A repeated command returns the first result.

### 8.10 Explicit, idempotent `.ics` export

```text
POST ExportIcs(eventId, expectedVersion, idempotencyKey)
-> require Event.status == CONFIRMED
-> require expectedVersion == Event.version
-> require no unaccepted official-field mutation
-> validate current authoritative Event
-> deterministically generate bytes
-> insert CalendarExport(eventVersion, snapshot, hash, UID, sequence)
-> return text/calendar
```

Retrying the same command returns the same file. After an applied confirmed update, the user may export again; the new export uses the new eventVersion and incremented sequence.

### 8.11 Retry and recovery

- Capture transaction failure leaves no partial message, case, optional inbox, or run.
- LLM failure preserves the source and user message and marks the run `FAILED`.
- Retry creates a new run, not a second Event; `UNIQUE(event.caseId)` is the final defense.
- After process failure, mark a stale `RUNNING` run `ABANDONED` before retry.
- Duplicate Chat submission uses clientMessageId to return the original result.
- Duplicate command uses an idempotency key to return the original result.
- A stale Event version returns `409` with the current version.
- A stale PendingQuestion is not consumed and its answer cannot apply to another field.
- Default logs exclude full sources, chat content, secrets, and `.ics` bodies.

## 9. Milestone V1.0: engineering baseline and Drizzle

### Product outcome

Web and API start against PostgreSQL, migrations are reproducible, and real-database tests pass.

### Implementation

- Verify the existing Next.js and NestJS applications.
- Use `drizzle-orm`, `drizzle-kit`, and `pg`.
- Maintain one `drizzle.config.ts`.
- Establish the API's `src/database` boundary.
- Commit versioned migrations.
- Separate development and test databases.
- Add a real PostgreSQL Integration Test.
- Add CI for lint, test, and build.

### Acceptance criteria

- Migrations initialize an empty database.
- Test and development share one migration history.
- Database unavailability produces a clear error.
- At least one test executes `SELECT 1` over a real Drizzle connection.
- No TypeORM dependency/import exists.
- V1 startup does not require Redis.

## 10. Milestone V1.1: Global Chat Capture and internal Case

### Product outcome

The user directly describes a matter or submits an external source in the single Agent Chat. After refresh, the original message and saved state remain in the same global timeline, without a Case page or Cases tab.

### Implementation

- Build the global Chat timeline and stable pagination.
- Create an internal LifeCase and Case-bound ChatMessage, and create an immutable InboxItem only for external material.
- Atomically save capture data in one short transaction.
- GENERAL messages use nullable caseId.
- Add duplicate-content warning.
- Add a low-prominence Settings entry.
- Do not show Events or call an LLM in this milestone.

Candidate API:

```text
POST /chat/messages
GET  /chat/messages
GET  /settings
PATCH /settings
```

### Failure experiments

- Blank or oversized source.
- Transaction failure between message/case/optional-inbox writes.
- Retry with the same clientMessageId.
- Two identical source texts.
- Multiple messages with the same createdAt.

### Acceptance criteria

- Invalid input returns `400` without partial writes.
- Direct-matter capture creates one internal Case and one ChatMessage, with no InboxItem.
- External-source capture additionally creates one InboxItem whose text exactly matches the input.
- The UI exposes no Case/Cases navigation.
- Global timeline ordering is deterministic.
- Refresh does not require reparsing Assistant prose to recover source state.
- Real PostgreSQL Integration Tests cover capture and timeline.

## 11. Milestone V1.1b: manual Event Progress and Preview

### Product outcome

Without a model, the developer manually creates one Event in Chat. An incomplete Event shows Draft Progress; when complete, the same Event becomes a READY Preview.

### Implementation

- Create at most one Event for each Case.
- Add `UNIQUE(event.caseId)`.
- Implement `COLLECTING <-> READY`.
- Directly edit the same Event and increment version.
- Add EventFieldEvidence.
- Implement the deterministic completeness gate.
- Add PendingQuestion and the one-OPEN-question-per-Case constraint.
- Cards are Event projections.
- Do not implement Confirm or show Events yet.

### Failure experiments

- Second Event for one Case.
- Incomplete Event incorrectly marked READY.
- Edit with stale expectedVersion.
- Invalid time zone or `endAt <= startAt`.
- Confirm appears while blocking evidence is MISSING.

### Acceptance criteria

- The database rejects multiple Events for one Case.
- COLLECTING has no Confirm.
- The same row becomes READY after the gate passes.
- Editing creates no separate draft/revision.
- At most one OPEN PendingQuestion exists.
- Gate and state transitions have Unit Tests.

## 12. Milestone V1.2: AI, Router, Evidence, and clarification

### Product outcome

Within the global Chat, Agent distinguishes five intents, turns a direct matter or new source into at most one Event, and asks one question at a time when information is incomplete.

### Implementation

- Implement the fixed intent router.
- NEW_MATTER creates message/case/run in one transaction and uses ChatMessage as evidence.
- NEW_SOURCE additionally creates an immutable inbox record in that transaction.
- Provider calls remain outside transactions.
- Implement the `EVENT | NO_ACTION | MULTIPLE_MATTERS` schema.
- Validate quote/offset and evidence state.
- Implement ExtractionRun timeout, failure, abandonment, and retry.
- CLARIFICATION_ANSWER must replyTo a PendingQuestion.
- Model context loads only the target Case.
- EVENT_QUERY reads only the Event store.
- Reserve `operationHint`, `relatedEventHint`, and pending fields.
- Defer automatic historical Event update/cancellation routing; do not mutate history without an explicit target.

### Failure experiments

- Invalid JSON or schema-valid but semantically invalid output.
- Provider timeout.
- Relative date without trusted referenceDate.
- Evidence quote/offset absent from source.
- Prompt injection.
- Multiple-matter output.
- Model attempts to return multiple Events.
- Clarification answer lacks replyTo, targets a stale question, or uses a stale Event version.
- Router treats GENERAL as NEW_MATTER/NEW_SOURCE.
- Model context accidentally includes another Case's messages.

### Acceptance criteria

- Model failure preserves message/case and any existing source.
- One input creates at most one Event.
- MULTIPLE_MATTERS creates no multiple Events and asks for split/selection.
- Every blocking field has trusted evidence.
- At most one OPEN question exists per turn.
- Non-blocking missing fields appear only as warnings.
- Automated tests prove Case context isolation.
- Query never reconstructs an authoritative Event from Chat.
- UI discloses that source text is sent to the configured model provider.

## 13. Milestone V1.3: confirmation, Pending Operation, and Events

### Product outcome

The user confirms or ignores an Event. After confirmation, Events appears and queries only confirmed/cancelled authoritative state. The user can also review and confirm before-after updates or cancellation for a confirmed Event.

### Implementation

- Implement READY -> CONFIRMED and COLLECTING/READY -> IGNORED.
- Confirm uses `eventId + expectedVersion + idempotencyKey` and reruns the gate.
- Add EventHistory snapshots.
- Add Events and authoritative Event queries.
- Restrict Events query to `CONFIRMED/CANCELLED`.
- Implement explicit Start update/cancel.
- A pending operation writes only pending fields; official fields stay unchanged.
- Implement pendingStatus COLLECTING/READY.
- Implement ConfirmPending and DiscardPending.
- For either update or cancellation, DiscardPending appends `PENDING_DISCARDED` history while leaving official fields unchanged.
- Show update/cancellation before-after Preview.
- Automatic matching from arbitrary new notices to historical Events may remain deferred.

### Failure experiments

- Double-click Confirm.
- Two tabs confirm the same Event version.
- Frontend tampers with READY state.
- Failure between Confirm and EventHistory insert.
- Pending update overwrites official fields.
- Query output exposes pendingChanges as authoritative.
- Update/cancel uses stale version.
- Old cancellation command retries after Event update.

### Acceptance criteria

- An Event that fails the gate cannot be confirmed.
- Confirmation applies at most once.
- Stale writes return `409`.
- Event and History write atomically.
- Events excludes COLLECTING, READY, and IGNORED.
- Queries return official fields only.
- An update does not change official fields before confirmation.
- Confirmed cancellation produces CANCELLED.
- Discarding pending work leaves the confirmed Event's official fields unchanged and records a `PENDING_DISCARDED` audit snapshot.
- Unfinished work resumes through a Chat resume card.

## 14. Milestone V1.4: explicit `.ics` export

### Product outcome

The user explicitly exports an Apple Calendar-compatible `.ics` from a CONFIRMED Event.

### Implementation

- Generate directly from the authoritative Event snapshot.
- Add CalendarExport.
- Use stable UID, sequence, and eventVersion.
- Correctly handle timed Appointments, date-only/timed Deadlines, Reminders, DST, and text escaping.
- Return `text/calendar`.
- Use Idempotency Key for deterministic retries.
- Increment sequence on export after an applied update.
- Do not automatically generate cancellation files.

### Failure experiments

- Repeated export.
- Export while pending update exists.
- Export again after applied confirmed update.
- DST transition and event crossing midnight.
- Unicode, comma, semicolon, backslash, and newline.
- Date-only Deadline.

### Acceptance criteria

- Representative files import into Apple Calendar manually.
- The same command returns identical bytes.
- pendingChanges never enter export.
- One Event retains a stable UID.
- Sequence increases monotonically after applied updates.
- Export occurs only through explicit user action.
- The product never claims provider-confirmed import.

## 15. Milestone V1.5: evaluation and release hardening

### Product outcome

V1 is safe enough for the developer's low-risk personal notices and has reproducible routing, extraction, clarification, confirmation, query, and Calendar baselines.

### Implementation

- Versioned intent-router evaluation.
- Versioned extraction/evidence dataset.
- Completeness-gate and question-priority test matrix.
- Global Chat / Case context-isolation tests.
- MULTIPLE_MATTERS evaluation.
- Confirmed update/cancellation before-after tests.
- Authoritative-store Event-query tests.
- Deterministic ICS tests.
- Provider, validation, concurrency, and export error UI.
- Structured logs without full private content.
- Local-data deletion flow.
- Document startup, migrations, tests, and provider data boundaries in README.

The minimum evaluation set covers:

- One explicit Appointment.
- One date-only Deadline.
- One Reminder.
- Ambiguous or conflicting dates.
- Confirmable Event with missing location.
- Appointment requiring acceptance of default duration.
- One input containing multiple matters.
- NO_ACTION.
- Explicit historical update/cancellation hint.
- English, Swedish, and Chinese.
- Prompt injection and unsupported evidence.
- NEW_MATTER, GENERAL, and EVENT_QUERY creating no InboxItem.

### Acceptance criteria

- A clean database supports Chat -> Progress -> Preview -> Confirm -> Events -> Export.
- Global Chat restores deterministically after refresh.
- Model context never leaks across Cases.
- Each Case owns at most one Event.
- Each turn has at most one OPEN PendingQuestion.
- A confirmed update does not change official fields before confirmation.
- Events/query never depends on reparsing Chat.
- Safety cases never silently create or modify a CONFIRMED Event.
- Default logs exclude full source/chat/secret/ICS content.
- Evaluation records model, prompt, and policy versions.

## 16. V1 release definition

Release only when:

- The default UI is one Agent Chat, with no user-visible Cases center.
- Settings remains low prominence.
- Events appears only after confirmation capability and queries only CONFIRMED/CANCELLED.
- LifeCase and InboxItem are internal.
- Each Case has 0..* immutable InboxItems and at most one Event.
- InboxItem represents only an external source, not an ordinary ChatMessage.
- ChatMessage may have no Case, while model context is always isolated by Case.
- Event uses `COLLECTING/READY/CONFIRMED/IGNORED/CANCELLED`.
- Unconfirmed edits directly update the same Event and increment version.
- Confirmed update/cancellation uses pending fields and before-after confirmation.
- Confirmation, ignore, applied update, pending-operation discard, and confirmed cancellation append EventHistory snapshots; ordinary `COLLECTING <-> READY` changes require no history.
- One input handles at most one matter; MULTIPLE_MATTERS asks the user to select one matter or submit separately, and V1 never splits automatically.
- Confirm reruns the backend gate and uses optimistic concurrency plus idempotency.
- Event queries read only the Event store.
- `.ics` export is explicit and idempotent.
- Migrations, Integration Tests, failure experiments, and an Evaluation baseline are complete.
- V1 does not depend on Redis, pgvector, or an agent framework.

One-sentence definition:

> In one global chat, LifeInbox V1 safely converges each independent life matter into at most one evidence-backed, confirmable, queryable Event.
