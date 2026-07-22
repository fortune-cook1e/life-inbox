# LifeInbox V1 Roadmap

[中文](02-v1-roadmap.md)

## 1. V1 outcome

V1 is complete when one person can reliably follow this path:

```text
Paste a text notice
-> save the original source
-> receive a structured AI draft
-> review evidence and uncertainty
-> edit and confirm
-> preview an Apple Calendar event
-> export .ics
-> mark the action done or ignored
```

V1 is deliberately an AI-assisted workflow, not an autonomous agent. It provides a useful first product and reliable components that a future agent may call.

## 2. V1 architecture

```text
Next.js Web
    |
    | HTTP
    v
NestJS modular monolith
    |-- inbox
    |-- extraction
    |-- actions
    `-- calendar-export
          |
          |-- PostgreSQL through Drizzle ORM
          |-- one LLM provider
          `-- deterministic .ics generator
```

V1 has no runtime dependency on Redis, object storage, pgvector, or an agent framework.

## 3. Proposed V1 data model

Introduce each entity only when its milestone begins.

### InboxItem

Stores the original source and its review disposition. Extraction execution state belongs to `ExtractionRun`, not this record.

```text
id
rawText
contentHash
sourceType: PASTED_TEXT
sourceReceivedAt
referenceDate
referenceDateSource: NOTICE_METADATA | USER_PROVIDED | SUBMISSION_TIME
disposition: UNREVIEWED | ACTIONS_PROPOSED | NO_ACTION | REVIEWED | ARCHIVED
createdAt
updatedAt
version
```

`contentHash` supports duplicate-content warnings but is not unique by default. Identical text may represent two real notices, and identical content is not the same as retrying one command.

### ExtractionRun

Stores one model attempt so retries, prompt comparisons, and evaluations remain inspectable.

```text
id
inboxItemId
model
promptVersion
status: RUNNING | SUCCEEDED | FAILED | ABANDONED
structuredOutput
errorCode
latencyMs
inputTokens
outputTokens
estimatedCost
startedAt
completedAt
updatedAt
```

### ActionItem

Stores an action that is reviewed and ultimately confirmed by the user.

```text
id
inboxItemId
type: APPOINTMENT | DEADLINE | REMINDER
title
startAt
endAt
dueDate
timeZone
location
nextAction
evidence
missingFields
status: DRAFT | CONFIRMED | DONE | IGNORED
createdAt
updatedAt
version
```

`startAt` and `endAt` are instants; `dueDate` is a date-only deadline. The schema must not pretend they share the same semantics. A `DRAFT` may be incomplete; completeness rules apply at confirmation or export.

Important proposed fields carry provenance:

```text
value
provenance:
  sourceType: NOTICE | CLARIFICATION | USER_EDIT | PREFERENCE
  sourceId
  startOffset
  endOffset
  quote
```

Whether provenance uses normalized tables or JSON is decided in V1.2. The product requirement is field-level traceability, not one evidence string for an entire action.

### CalendarDraft

A deterministic event representation used to generate `.ics`:

```text
id
actionItemId
stableUid
sequence
eventFields
status: PROPOSED | EXPORTED | USER_REPORTED_IMPORTED
exportedAt
createdAt
updatedAt
```

`USER_REPORTED_IMPORTED` means only that the user reported an import; Apple Calendar did not confirm it. `ActionItem` does not duplicate this external-state claim.

## 4. Milestone V1.0: engineering baseline and Drizzle

### Product outcome

Web and API start against PostgreSQL, migrations are reproducible, and one real-database test passes.

### Implementation

- Verify the Next.js and NestJS applications.
- Add `drizzle-orm`, `drizzle-kit`, and `pg`.
- Maintain one `drizzle.config.ts`.
- Create a first-class runtime `src/database` boundary.
- Add version-controlled migration commands.
- Create separate development and test databases.
- Add one real PostgreSQL integration test.
- Add CI for lint, test, and build.

### Explicit ORM rules

- Do not install TypeORM or `@nestjs/typeorm`.
- Do not maintain TypeORM entities or migrations.
- Remove TypeORM scaffolding before product entities are created.
- Drizzle is the only application ORM.

### Learning targets

Environment configuration, connection pools, schema/migration lifecycle, dev/test differences, NestJS module boundaries, integration tests, and cleanup.

### Failure experiments

Use an invalid URL; run before migrations; migrate a fresh database; run tests that contaminate each other without isolation.

### Acceptance criteria

- Committed migrations initialize an empty database.
- Test and development share one migration history.
- Database unavailability produces a clear error.
- A real Drizzle connection executes `SELECT 1`.
- No TypeORM dependency or import exists.
- V1 startup does not require Redis.

## 5. Milestone V1.1: manual inbox

### Product outcome

The user pastes a notice and later sees the fully preserved source.

### Implementation

- Create and read `InboxItem`.
- List with stable order: `createdAt DESC, id DESC`.
- Warn about identical source content without rejecting it.
- Build minimal inbox and source-detail views.

Candidate API:

```text
POST   /inbox-items
GET    /inbox-items
GET    /inbox-items/:id
```

### Learning targets

HTTP methods/status codes, DTO validation, Drizzle inserts/selects, constraints, content hashes, stable ordering, service/persistence boundaries, and real-database testing.

### Failure experiments

Blank or oversized text; missing resource; identical submissions; identical timestamps that test deterministic sorting.

### Acceptance criteria

- Invalid input returns `400` without writes.
- Missing resources return `404`.
- Returned source text exactly matches the submission.
- List order is deterministic.
- Duplicate content is flagged but not treated as an idempotency key.
- Create, list, and detail paths use real PostgreSQL integration tests.

### Deferred

LLM calls, authentication, files, action drafts/confirmation, and `.ics` generation.

## 6. Milestone V1.1b: manual action drafts

### Product outcome

The user manually creates and edits an incomplete action draft for an `InboxItem`. Confirmation waits until V1.3.

### Implementation

- Add `ActionItem` with `DRAFT` status.
- Create and edit manual drafts beside immutable source text.
- Add the first foreign key and relation query.
- Validate fields by state; drafts may be incomplete.

```text
POST  /inbox-items/:id/actions
PATCH /actions/:id
```

### Learning targets

Foreign keys and deletion behavior, Drizzle relations versus PostgreSQL constraints, state-dependent validation, and an early version field for optimistic concurrency.

### Failure experiments

Draft for a missing inbox item; unknown action type; incomplete appointment; attempt to modify source text through an action route.

### Acceptance criteria

- Every draft references an existing `InboxItem`.
- An incomplete appointment remains a visible `DRAFT`.
- Editing a draft never changes source text.
- No confirmation, completion, or calendar-export endpoint exists yet.

## 7. Milestone V1.2: AI-extracted drafts

### Product outcome

After pasting a notice, the user receives zero or more editable action drafts with visible evidence and uncertainty.

### Reference time

Relative expressions require a trustworthy anchor. Model input includes an explicit `referenceDate` and provenance. If a pasted notice says `tomorrow` without a credible received date, LifeInbox asks for clarification instead of silently using paste time. Evaluation uses a fixed clock.

### Structured output

```text
outcome: ACTIONS | NO_ACTION
actions:
  - type: APPOINTMENT | DEADLINE | REMINDER
    title
    startAt
    endAt
    dueDate
    timeZone
    location
    nextAction
    missingFields
    fieldProvenance
warnings
```

Hard invariants:

```text
NO_ACTION => actions.length == 0
ACTIONS   => actions.length >= 1
```

### Data flow

```text
save InboxItem and commit
-> create RUNNING ExtractionRun and commit
-> call LLM with timeout
-> validate structured output and source evidence
-> in a new transaction mark SUCCEEDED and save drafts

provider/validation failure
-> mark ExtractionRun FAILED
```

Never hold a database transaction open across the LLM call. A later request may mark a stale `RUNNING` attempt `ABANDONED` and create a new attempt. Before prompt implementation, create a versioned 15-30-case gold dataset; V1.5 expands it and defines release thresholds.

### Learning targets

Structured outputs, schema validation, timeouts and cancellation, external error classification, prompt/model versioning, latency/token/cost records, product state versus model output, retry boundaries, and provider data-retention boundaries.

### Failure experiments

Invalid JSON; schema-valid but incomplete output; provider timeout; invented date for `next week`; relative date without a trusted anchor; unsupported evidence; action for an informational notice; `NO_ACTION` with non-empty actions; prompt-injection text inside the notice.

### Acceptance criteria

- Model failure never deletes the `InboxItem`.
- Invalid output never enters `ActionItem`.
- Important evidence exists in source text or explicit clarification.
- Ambiguous values remain drafts with missing-field markers.
- `NO_ACTION` and multiple actions are unambiguous.
- Retry creates an `ExtractionRun`, not duplicate confirmed actions.
- Stale attempts remain visible and recoverable.
- Evaluations record validity, accuracy, refusal-to-guess, evidence validity, latency, and cost by model/prompt version.
- UI discloses that notice text is sent to the configured provider.

### Deferred

Open-ended agent loops, retrieval/personal memory, PDF, and image parsing.

## 8. Milestone V1.3: review, confirmation, and concurrency

### Product outcome

The user reviews source and draft, edits uncertain fields, and turns one reviewed draft version into an authoritative confirmed action.

### Implementation

- Show source and draft side by side with evidence and missing fields.
- Support draft edits and version history.
- Add explicit confirm and ignore commands.
- Conditionally update the same `ActionItem` from `DRAFT` to `CONFIRMED`; do not insert another confirmed item.
- Use version-based optimistic concurrency.
- Add audit entries only if full history is genuinely required.

### Learning targets

State machines, transaction boundaries, optimistic locking, idempotent commands, and append-only history versus mutable product state.

### Failure experiments

Double-click confirm; concurrent browser tabs; stale edit; failure between state update and audit write; retry after a lost response.

### Acceptance criteria

- A draft version is confirmed at most once.
- Stale concurrent writes return `409`.
- Failed confirmation leaves no partial state.
- Confirmation does not duplicate an `ActionItem`.
- User-confirmed values remain distinguishable from model proposals.
- The backend validates every transition.

## 9. Milestone V1.4: Apple Calendar `.ics` export

### Product outcome

The user previews a confirmed action and explicitly exports an `.ics` file that Apple Calendar can import.

### Implementation

- Deterministically generate `CalendarDraft`.
- Support timed appointments and all-day deadlines.
- Support default and edited reminder offsets.
- Handle `Europe/Stockholm`, stable ICS `UID`, event `SEQUENCE`, and escaping.
- Return `text/calendar` and store honest export history.
- The model proposes structured fields; application code generates `.ics`.

### Learning targets

Dates versus timestamps, UTC instants versus IANA zones, DST, deterministic files, idempotency, and external-system boundaries.

### Failure experiments

Repeat export; modify time and re-export; DST transition; event crossing midnight; commas, semicolons, slashes, Unicode, and newlines; date-only deadline.

### Acceptance criteria

- Representative files import into Apple Calendar manually.
- Repeated export reuses the logical UID.
- Event changes increment sequence/version consistently.
- Timed appointments and all-day deadlines keep distinct semantics.
- Export requires explicit user action.
- Database state says `EXPORTED`, never falsely claims provider-confirmed creation.

## 10. Milestone V1.5: evaluation and release hardening

### Product outcome

V1 is safe enough for the developer's low-risk personal notices and has a reproducible quality baseline.

### Implementation

- Expand the versioned extraction dataset and define release thresholds.
- Add automated schema tests and deterministic ICS tests.
- Add structured logs without full notice content.
- Show provider and validation errors.
- Add local data deletion.
- Document startup and development.

The minimum dataset covers explicit appointments, date-only deadlines, ambiguous and conflicting dates, multiple actions, no-action notices, and English, Swedish, and Chinese examples.

### Acceptance criteria

- The complete V1 path works from a clean database.
- Important failures are visible and recoverable.
- Evaluation records model and prompt versions.
- Safety cases never silently create confirmed actions.
- Default logs exclude full source text and secrets.
- The developer can explain the data flow without reading code.

## 11. V1 release definition

Release only when:

- The user-facing end-to-end path works.
- All migrations initialize a fresh database.
- Core API behavior has PostgreSQL integration tests.
- Deterministic calendar logic has focused unit tests.
- At least one concurrency failure and one LLM failure have been reproduced and fixed.
- An evaluation baseline is recorded.
- Deferred capabilities have not leaked into V1 architecture.
