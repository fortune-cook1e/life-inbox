# ADR 0002: Use a Conversation-first, Card-confirmed, Case-organized Interaction Model

[中文](0002-conversation-first-interaction.md)

| Item          | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Status        | Superseded by [ADR 0003](0003-single-chat-internal-cases.en.md)                        |
| Decision date | 2026-07-25                                                                             |
| Scope         | LifeInbox product interaction, state boundaries, and frontend/backend responsibilities |

> This ADR retains the previous decision and rationale as design history. ADR 0003 defines the current interaction and domain boundaries.

## Context

LifeInbox's core job is not to make users maintain data tables. It helps them understand a life notice, supply critical missing facts, and safely form the next action.

A conventional inbox or dashboard displays many records efficiently, but makes the user interpret state, find missing information, and complete fields. A pure chat interface has the opposite problem: results become buried in message history, while evidence, versions, confirmation state, and external side effects are difficult to query accurately.

The product must support all of the following:

- A user starts with natural language or a pasted notice.
- The system identifies actions, missing fields, conflicts, and evidence.
- Clarification stays lightweight and handles only one genuinely blocking question at a time.
- AI output remains a draft until user confirmation.
- The confirmation target is exact, structured, and versioned.
- Users can later query every case, source, conversation, action, and export state.
- A conversational experience must not force V1 to implement an open-ended agent loop prematurely.

## Decision

LifeInbox adopts this product interaction model:

> **Conversation-first, Card-confirmed, Case-organized.**

### Conversation-first

The `Agent Workspace` is the default entry point. The user starts a new `LifeCase` by pasting a notice or describing it naturally, then answers clarification questions inside that Case.

In V1, application code orchestrates the conversation deterministically:

```text
receive source
-> extract structured draft
-> check field and evidence completeness
-> ask one blocking question, or render an Action Preview Card
```

The model does not freely choose tools in V1. A chat interface is a product interaction pattern; it is not equivalent to an autonomous agent.

### Card-confirmed

Chat messages do not directly become authoritative actions. While blocking fields exist, conversation and Draft Progress show the current understanding, evidence, and one active question; this is not a confirmable Card. Once the completeness gate passes, the candidate result is rendered as an `Action Preview Card`, backed by an `ActionItem DRAFT` with an immutable revision.

The Card shows at least:

- Action type.
- Title.
- Date, time, and time zone.
- Location and next action.
- Evidence or origin for every important field.
- Non-blocking warnings, resolved-conflict history, and accepted defaults.
- Current ActionItem revision identifier/number.

The user may edit, ignore, or confirm the Card. Only the exact confirmed revision becomes an authoritative Action and becomes eligible for follow-up operations such as `.ics` export.

Confirmation binds the `ActionItem` identifier, revision identifier, and aggregate `expectedVersion`. An edit creates a new immutable revision; if it introduces a blocker, the interface returns to Draft Progress. The new revision must be confirmed again, and an old confirmation never applies automatically to changed content.

### Case-organized

`LifeCase` is the main container through which the user understands one matter. In V1, a Case contains:

- One immutable primary `InboxItem` source.
- A sequence of `CaseMessage` conversation records.
- Zero or more extraction attempts.
- Zero or more `ActionItem` records.
- Related Calendar Draft and export records.

V1 allows one primary source per Case. Later versions may attach update/cancellation notices or related documents to the same Case.

`Cases` is a secondary information center rather than the primary work entry. It defaults to searchable lists or cards grouped by `Needs input`, `Ready for review`, `Planned`, `Done`, and `Ignored`. `Planned` means confirmed but unfinished action; Calendar export and user-reported import are separate badges. A table may appear later as an advanced dense view, but it is not the default experience.

### Chat does not replace structured state

Conversation records explain the process; they are not the only source of product state:

- `InboxItem` stores the original source.
- `CaseMessage` stores conversation.
- `ExtractionRun` stores extraction attempts.
- `ActionItem` stores action identity and current state; immutable `ActionItemRevision` records preserve every user-visible version.
- `CalendarDraft`, append-only `CalendarExport`, and `CalendarImportReport` records store Calendar output.

The chat timeline may reference these structured objects, but the system must not store an entire Card, approval, or export result only as natural-language text.

### Field and evidence completeness

Important fields use these evidence states:

```text
SUPPORTED_BY_SOURCE
PROVIDED_BY_USER
DEFAULT_ACCEPTED
MISSING
CONFLICTING
```

The application applies deterministic completeness rules by action type. For example, an Appointment requires a date, start time, time zone, and either an end time or a user-accepted default duration.

The system asks only about fields that block confirmation:

- Ask the highest-priority question one at a time.
- Do not ask again when reliable evidence already exists.
- Explain why the information is needed.
- Allow the user to answer “I don't know” or cancel.
- Show a warning for missing optional fields rather than forcing an answer.
- Store user answers as new provenance without modifying the original source.

### External side-effect boundary

Confirming an Action and executing an external operation are separate steps. Even after a Card is confirmed, `.ics` export requires another explicit user action. The product may record that it generated a file and may record an explicit user report of import, but the latter must be labeled `USER_REPORTED_IMPORTED` rather than claimed as Apple Calendar provider confirmation.

## Primary interaction flow

```text
Agent Workspace
-> user pastes a notice
-> create LifeCase and immutable InboxItem
-> Agent shows its understanding
-> completeness gate
   -> blocking field missing: ask one question
   -> information complete: show Action Preview Card
-> user edits or confirms the exact version
-> explicitly export .ics
-> Case enters the Cases information center for later retrieval
```

## Consequences

### Benefits

- Users communicate around real intent instead of filling administrative forms.
- Uncertainty and evidence are resolved before confirmation.
- Cards create a clear boundary for confirmation, concurrency, and external effects.
- Cases keep sources, conversation, state, and history queryable.
- V1 can feel agent-like while retaining deterministic workflow reliability.
- V5 can introduce dynamic tool selection without replacing the product-state model.

### Costs

- Conversation messages and authoritative domain state require separate models.
- The UI must support both natural language and structured Card editing.
- Case recovery, message idempotency, and draft versions need explicit design.
- Agent language may disagree with product state, so the backend must revalidate the Card.
- Chat transcripts alone cannot prove correctness; state and evidence require dedicated tests.

## Rejected alternatives

### Table-first dashboard

Rejected as the default experience. It supports dense querying but gives the work of understanding notices and filling gaps back to the user.

### One infinitely growing global chat

Rejected. Unrelated notices would share ambiguous context, making evidence, permissions, state, and later updates difficult to isolate.

### Store only chat history

Rejected. Natural-language transcripts cannot replace validated, concurrency-controlled, auditable structured state.

### Implement an open-ended agent in V1

Rejected. V1 tool selection and state transitions can be implemented as a fixed workflow. A bounded agent loop belongs in V5 only when evaluated dynamic branching adds value over the fixed baseline.

## Verification

This decision is verified when:

- A user creates a Case from the Agent Workspace without first completing a structured form.
- A complete notice produces a Preview Card directly.
- A missing blocking field produces one focused question per turn.
- Missing optional fields do not cause endless questioning.
- Every important field shows source evidence, a user answer, or an accepted default.
- Editing a Card prevents confirmation of the old revision while preserving the old history for audit.
- An unconfirmed Card cannot export a calendar event.
- Cases can reopen source, conversation, Card, and export history.
- Refresh or service restart does not require the model to re-infer authoritative state.
