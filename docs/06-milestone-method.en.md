# LifeInbox Milestone Method

[中文](06-milestone-method.md)

## 1. Purpose

This document defines how to learn through LifeInbox without allowing generated code or a large roadmap to replace engineering judgment. Progress is measured by a product capability that can prove its correctness, not by weeks, chapters, or frameworks.

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

Do not ask Codex to implement everything at the beginning.

## 3. Five-line feature card

Create this card before implementation:

```markdown
## Feature card

Goal:

Data flow:

Rules that must always hold:

Possible failure points:

How correctness will be proven:
```

The card should fit on one screen. If it does not, the milestone is probably too large.

## 4. Design questions before coding

Answer only questions relevant to the current slice:

- Which user-visible outcome changes?
- Which data is authoritative?
- Which data is draft, derived, cached, or external?
- Which operations must be atomic?
- What may happen more than once or arrive out of order?
- Which failures are retryable?
- Which state transitions are legal?
- Who may read or modify the resource?
- What evidence proves the behavior?

Do not design queues, caches, agent state, or microservices before the milestone needs them.

## 5. Definition of done

A milestone is complete only when:

- The user-visible path works.
- Product and data invariants are written down.
- At least one real failure has been reproduced.
- Automated tests prove important behavior.
- Users/operators can see error state.
- Logs are useful without leaking sensitive data.
- Meaningful choices have a short architecture decision.
- The developer can explain flow and tradeoffs without reading code.
- Deferred work is explicit.

A passing happy path alone is not completion.

## 6. Required evidence package

Each milestone leaves:

1. Runnable code.
2. Automated tests.
3. One documented failure experiment.
4. Updated feature card.
5. A short ADR for a real choice.
6. Updated data-flow or state documentation.
7. A 60-120 second technical explanation.
8. One concise portfolio/interview statement.

Suggested explanation:

```text
The user need was...
The system had to guarantee...
My initial approach was...
It failed when...
I changed the design by...
I verified it with...
The main tradeoff was...
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

Target a real correctness boundary rather than throwing an arbitrary exception.

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

An ADR records a decision; it is not a technology tutorial.

## 9. Review workflow

### Product review

- Does visible behavior match the milestone?
- Did extra functionality enter scope?
- Are uncertainty and errors understandable?

### Data review

- Which tables and constraints changed?
- Are authoritative state, model drafts, and external state distinct?
- Are time and deletion semantics explicit?

### Failure review

- What happens under duplicates, timeouts, crashes, stale updates, and invalid input?
- Which failures were tested against real PostgreSQL or worker behavior?

### Security review

- Can a user or agent tool exceed its scope?
- Do logs/errors expose private content?
- Are external effects confirmed and idempotent?

### Learning review

- Can the developer explain purpose, failure, fix, test, and tradeoff?
- Can the developer make an adjacent change without step-by-step guidance?

## 10. Codex collaboration boundary

Codex may explain concepts/errors, compare options, propose invariants and edge cases, scaffold repetitive setup after design, generate/review tests, review migrations/SQL, and design failure injection.

The developer owns the data model, Drizzle schema/migration review, transaction boundaries, time semantics, authentication/authorization strategy, retry/idempotency policy, agent permissions, evaluation cases/release thresholds, and final acceptance.

## 11. Next milestone: V1.0

Do not start AI extraction yet.

### Draft feature card

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
accidental TypeORM installation.

How correctness will be proven:
Initialize an empty test database, apply migrations, run a real Drizzle query such as
SELECT 1, and verify that no TypeORM package or import exists. V1.1 adds the first table.
```

### Decisions required before V1.0 implementation

- Exact Node and pnpm versions.
- Drizzle and PostgreSQL-driver versions verified against official documentation.
- Schema and migration directories.
- Development and test database names.
- Test-isolation method.
- Development and production migration commands.
- Health/readiness behavior when PostgreSQL is unavailable.

V1.1 cannot add `InboxItem` until V1.0 passes.

## 12. First product milestone: V1.1

### Draft feature card

```text
Goal:
Paste and save a life notice, then view it in the inbox.

Data flow:
Next.js form -> POST /inbox-items -> NestJS validation -> service -> Drizzle ->
PostgreSQL -> response -> inbox list.

Rules that must always hold:
Original text is non-empty, within a hard size limit, preserved exactly, and has a stable
identifier and creation time.

Possible failure points:
invalid payload, unavailable database, missing resource, duplicate-content warning
semantics, unstable list ordering.

How correctness will be proven:
API integration tests against real PostgreSQL plus a minimal browser path that creates
and reloads a notice.
```

V1.1 does not contain LLM calls, Redis, files, authentication, vector search, or calendar export.

## 13. Progress ledger

```markdown
| Milestone             | Status      | Failure reproduced | Automated proof | Explanation complete |
| --------------------- | ----------- | ------------------ | --------------- | -------------------- |
| V1.0 Drizzle baseline | Not started | No                 | No              | No                   |
| V1.1 Manual inbox     | Not started | No                 | No              | No                   |
| V1.1b Manual draft    | Not started | No                 | No              | No                   |
```

Allowed status values: `Not started`, `Design review`, `Happy path`, `Failure reproduced`, `Fix under test`, and `Complete`.

This prevents partially implemented work from being marked complete merely because code exists.
