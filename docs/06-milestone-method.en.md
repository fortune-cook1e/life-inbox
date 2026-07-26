# LifeInbox Milestone Method

[中文](06-milestone-method.md)

## 1. Purpose

This document defines how to learn and deliver through LifeInbox without allowing generated code or a large roadmap to replace engineering judgment. Progress is measured by a product capability that can prove its correctness, not by weeks, chapters, or framework count.

The product-interaction baseline is:

```text
one Agent Chat
-> show an Event Preview Card when evidence is complete
-> user explicitly confirms
-> Chat queries or a later Events tab show authoritative Events
```

LifeCase and InboxItem are internal models, not navigation concepts the user must learn.
`LifeCase` is the canonical domain name; the documents abbreviate it to `Case` when unambiguous.

## 2. Fixed milestone loop

```text
define requirement
-> define invariants
-> implement the smallest happy path
-> inject one real failure
-> observe incorrect behavior
-> read targeted documentation
-> improve the design
-> add automated tests
-> explain the result without looking at code
```

Do not ask Codex to implement the complete product at the beginning. Every slice should produce an observable user outcome and independent evidence.

## 3. Five-line feature card

Create this before implementation:

```markdown
## Feature card

Goal:

Data flow:

Rules that must always hold:

Possible failure points:

How correctness will be proven:
```

The feature card should fit on one screen. If it does not, the milestone is probably too large.

## 4. Design questions before coding

Answer only questions relevant to the current slice:

- What changes for the user in the single Agent Chat?
- Is this message a directly expressed new matter, external new source, clarification answer, Event query, or general message?
- Must the message associate with a LifeCase, and how does the system ask when no unique target exists?
- Which LifeCase owns the current matter?
- Which content is an immutable InboxItem and which content is only a ChatMessage?
- Does LifeCase allow `0..* InboxItem`, creating one only when external material exists?
- When one source contains several independent matters, does V1 ask the user to select one or submit them separately instead of splitting Cases automatically?
- How is the at-most-one-Event-per-Case invariant proven?
- Is the Event `COLLECTING`, `READY`, `CONFIRMED`, `IGNORED`, or `CANCELLED`?
- Does the UI show only Draft Progress before the gate passes and a Preview Card afterward?
- Which fields are `BLOCKING`, `NON_BLOCKING`, or `OPTIONAL`?
- Is each important field `SUPPORTED_BY_SOURCE`, `PROVIDED_BY_USER`, `DEFAULT_ACCEPTED`, `MISSING`, or `CONFLICTING`?
- Which `eventId + expectedVersion` does confirmation bind?
- Does a proposed operation on a confirmed Event stay only in the embedded pending area without overwriting official fields? Does an update use `pendingChanges` for its field diff while a cancellation leaves it empty?
- Which writes must be atomic?
- What may repeat, arrive out of order, or lose its response after success?
- Which failures are safely retryable?
- Who may read or modify these records?
- Which evidence proves the behavior?

Do not design queues, caches, Agent state, pgvector, or microservices before the current milestone needs them.

## 5. Definition of done

A milestone is complete only when:

- The visible path works through the single Chat and never requires a user-facing Case or table.
- Product and data invariants are written down.
- Reload reconstructs Messages, Draft Progress, Preview Cards, or confirmed Events from structured records without reparsing Assistant prose.
- Event queries read only the authoritative Event store.
- Case-context isolation is tested; the global Chat does not cause the model to read an unrelated Case.
- At least one real failure has been reproduced.
- Automated tests prove important behavior.
- Users or operators can see error and retry states.
- Logs are useful without leaking private source content.
- Meaningful choices have a short ADR.
- The developer can explain the data flow and trade-offs without reading code.
- Deferred work is explicit.

A passing happy path alone is not completion.

## 6. Required evidence package

Every milestone leaves:

1. Runnable code.
2. Automated tests.
3. One fully documented failure experiment.
4. An updated feature card.
5. A short ADR for a real decision.
6. Updated data-flow or state documentation.
7. A 60-120 second technical explanation.
8. One concise portfolio or interview statement.

A conversational milestone must make the branches explicit instead of treating InboxItem or Event as mandatory for every message:

```text
ChatMessage
-> routing decision
   -> NEW_MATTER
      -> internal LifeCase + ChatMessage evidence
      -> Event | NO_ACTION | MULTIPLE_MATTERS
   -> NEW_SOURCE
      -> internal LifeCase + immutable InboxItem
      -> Event | NO_ACTION | MULTIPLE_MATTERS
   -> CLARIFICATION_ANSWER
      -> exact PendingQuestion
      -> Event + EventFieldEvidence
   -> EVENT_QUERY
      -> authoritative Event query
   -> GENERAL
      -> ChatMessage only

Event COLLECTING/READY
-> Draft Progress / Preview Card
-> confirm(eventId, expectedVersion)
-> authoritative Event
```

Suggested technical explanation:

```text
The user need was...
The system had to guarantee...
My initial approach was...
It failed when...
I changed the design by...
I verified it with...
The main trade-off was...
```

## 7. Failure-experiment template

```markdown
## Failure experiment

Expected invariant:

Injected failure:

Behavior observed before the fix:

Root cause:

Design change:

Automated proof after the fix:

Remaining limitations:
```

Target a real correctness boundary such as duplicate submission, stale version, incorrect Case association, or LLM timeout rather than throwing an arbitrary exception.

## 8. ADR template

```markdown
# ADR NNNN: Decision title

## Status

Proposed | Accepted | Superseded

## Context

What product needs and constraints exist?

## Options

Which realistic options were considered?

## Decision

What was selected, and why?

## Consequences

What becomes easier, harder, or deferred?

## Verification

Which test, metric, or experiment proves this decision works?
```

An ADR records a decision rather than teaching a technology. A replaced ADR is marked `Superseded` and links to the new ADR instead of deleting historical rationale.

## 9. Review workflow

### 9.1 Product review

- Can the user complete the primary task only through Agent Chat?
- Does the UI leak internal concepts such as LifeCase or InboxItem?
- With a blocker, are Draft Progress and one question the only active UI?
- Does a Preview Card represent only a `READY` Event that passed the gate?
- Is Confirm the only path from candidate content to authoritative fact?
- Can unfinished matters resume through an in-chat resume card?
- Does the Events tab read only confirmed/cancelled authoritative data?
- Are uncertainty and errors understandable?
- Did extra functionality enter scope?

### 9.2 Data review

- Which tables and constraints changed?
- Are global ChatMessage order, optional caseId, and reply target explicit?
- Does LifeCase represent one concrete matter?
- Does InboxItem contain only immutable external source material?
- Does `UNIQUE(event.caseId)` prove at most one Event per Case?
- Are official Event fields clearly separated from the pending area, with `pendingChanges` holding only an update's proposed field diff and remaining empty for cancellation?
- Is every important field's evidence and source inspectable?
- Do Event version, transitions, confirmation snapshot, and Calendar export bind accurately?
- Are time, ignore, cancellation, and deletion semantics explicit?

### 9.3 Failure review

- What happens when one `clientMessageId` is replayed?
- What happens when “18:00” cannot target a unique question?
- Does the original InboxItem survive LLM timeout?
- What happens when two clients answer or confirm concurrently?
- Is stale `expectedVersion` rejected?
- Can any pending field leak into confirmed Event queries?
- Can Calendar export read the wrong version?
- Which failures were verified against real PostgreSQL or worker behavior?

### 9.4 Security review

- Can global Chat put another user's or another Case's content into a prompt?
- Can a user or Agent tool exceed ownership?
- Do logs or errors expose complete source content?
- Are external effects explicitly confirmed, bound to an exact version, and idempotent?

### 9.5 Learning review

- Can the developer explain purpose, failure, fix, test, and trade-off?
- Can the developer make an adjacent change without step-by-step guidance?

## 10. Codex collaboration boundary

Codex may:

- Explain concepts and errors.
- Compare design options.
- Propose invariants, edge cases, and failure experiments.
- Scaffold repetitive setup after the design is settled.
- Generate or review tests, migrations, and SQL.
- Check Chinese/English documentation consistency.

The developer should personally understand and make the final decision for:

- User-visible Chat/Events/Settings boundaries.
- LifeCase, InboxItem, ChatMessage, and Event responsibilities.
- Message-routing and ambiguity rules.
- The at-most-one-Event-per-Case invariant.
- Completeness gates, field requirements, and default acceptance.
- EventFieldEvidence and provenance.
- Event status, version, all four pending fields, and confirmation boundaries.
- Drizzle schema, migrations, and transactions.
- Time semantics.
- Authentication and authorization.
- Retry, idempotency, and conflict handling.
- Agent tool permissions.
- Evaluation sets, release thresholds, and final acceptance.

## 11. Next milestone: V1.0

Do not start AI extraction yet.

### 11.1 Draft feature card

```text
Goal:
Start a NestJS API connected to PostgreSQL through Drizzle, make migrations reproducible,
and provide one real integration test.

Data flow:
environment config -> pg Pool -> Drizzle client -> PostgreSQL -> test assertion.

Rules that must always hold:
Drizzle is the only ORM; committed migrations bring an empty database to the current
schema; tests never target the development database.

Possible failure points:
invalid URL, unavailable database, missing migration, stale test schema, unclosed pool,
or accidental TypeORM installation.

How correctness will be proven:
Initialize an empty test database, apply migrations, run a real Drizzle query such as
SELECT 1, and verify that no TypeORM package or import exists. V1.1 adds the first table.
```

### 11.2 Decisions required before implementation

- Exact Node and pnpm versions.
- Drizzle and PostgreSQL-driver versions verified against official documentation.
- Schema and migration directories.
- Development and test database names.
- Test-isolation method.
- Development and production migration commands.
- Health/readiness behavior when PostgreSQL is unavailable.

V1.1 adds LifeCase, InboxItem, and ChatMessage only after V1.0 passes.

## 12. First product milestone: V1.1

### 12.1 Draft feature card

```text
Goal:
Directly describe one matter or paste one life notice in the single Agent Chat. After reload,
the same timeline still shows the exact message and saved result, with no Cases page.

Data flow:
Next.js Chat input
-> POST /messages with clientMessageId
-> NestJS validation
-> transaction
-> NEW_MATTER: ChatMessage + internal LifeCase
-> NEW_SOURCE: ChatMessage + internal LifeCase + immutable InboxItem
-> Drizzle -> PostgreSQL
-> deterministic Assistant acknowledgement
-> reload global Chat timeline.

Rules that must always hold:
LifeCase is an internal concrete matter with `0..* InboxItem`; only external material creates
an InboxItem, whose text is non-empty, bounded, and immutable. A direct matter uses
ChatMessage evidence only; the user never needs to know caseId; one clientMessageId creates
one logical input.

Possible failure points:
invalid payload, a partially written transaction, unavailable database, duplicate request,
unstable global Message ordering, Case identifiers leaking into UI, or source content
leaking into logs.

How correctness will be proven:
Real-PostgreSQL integration tests separately prove that NEW_MATTER atomically writes
Message + Case with no InboxItem, while NEW_SOURCE atomically writes Message + Case +
InboxItem. Replaying clientMessageId creates no duplicate. A minimal browser flow creates
and reloads Chat, verifies exact message/source text, and proves no Cases navigation exists.
```

V1.1 does not contain LLM calls, Event, Draft Progress, Preview Cards, Redis, files, authentication, vector search, Events tab, or Calendar export. A deterministic Assistant response provides the conversational appearance but is not an Agent.

Starting in V1.2, if one source contains several independent matters, fixed orchestration must ask the user to select the current matter or submit them separately. V1 neither creates multiple Cases automatically nor shares one InboxItem across Cases.

V1-V4 continue to use fixed workflows controlled by application code. A bounded agent loop with budgets, checkpoints, and approval boundaries appears only after V5 proves measurable value from dynamic tool selection.

## 13. Progress ledger

```markdown
| Milestone                | Status      | Failure reproduced | Automated proof | Explanation complete |
| ------------------------ | ----------- | ------------------ | --------------- | -------------------- |
| V1.0 Drizzle baseline    | Not started | No                 | No              | No                   |
| V1.1 Global Chat capture | Not started | No                 | No              | No                   |
| V1.1b Manual Event/Card  | Not started | No                 | No              | No                   |
| V1.2 AI fixed workflow   | Not started | No                 | No              | No                   |
| V1.3 Confirm/Events view | Not started | No                 | No              | No                   |
```

Allowed states are `Not started`, `Design review`, `Happy path`, `Failure reproduced`, `Fix under test`, and `Complete`.

This prevents a partially implemented slice from being marked complete merely because code exists.
