# Calendar Clarification Continuation

Status: approved for implementation | Approved: 2026-08-03

This plan describes future work. Until it is implemented and verified,
[`../features/calendar-assistant.md`](../features/calendar-assistant.md) remains the source of truth
for current behavior.

## 1. Goal and boundary

When a user answers an earlier clarification question, continue the original `COLLECTING` Event
instead of creating a new Case. The backend exposes at most two recent pending questions, and the
Agent may update only one candidate through a validated tool.

Today each `POST /messages` starts with only the current text. `ask_user` does not persist the field
it is waiting for, and `propose_calendar_event` cannot patch an Event. A reply such as `10 AM`
therefore starts a duplicate Case. This slice closes that gap.

| Input                              | Agent route                                                   | Result                                                    |
| ---------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| Complete new matter                | `create_case -> propose_calendar_event -> show_event_preview` | One new Case and one `READY` Event                        |
| Incomplete new matter              | `create_case -> propose_calendar_event -> ask_user`           | One `COLLECTING` Event and one `OPEN` pending question    |
| One compatible pending question    | Search, then apply answer                                     | Update the original Event and bind the answer to its Case |
| Multiple compatible questions      | Search, then request restatement                              | Change nothing; ask for `matter + additional information` |
| No candidate, meaningful fragment  | Search, then request restatement                              | Create no Case or Event                                   |
| Meaningless or non-actionable text | Finish message-only                                           | Store only the original user message                      |

Approved limits:

- Required fields only: `title`, `startAt`, and `timeZone`; one open question per Event.
- No `replyToMessageId`, `caseId` request field, or `CASE_SELECTION` state.
- No general historical Case matching, arbitrary old Event edit, embeddings, RAG, or backfill.
- No auth, multi-user isolation, confirmation, export, provider write, web work, or run recovery.
- No new package, Nest module, generic memory layer, or optional-field clarification.

The database has no owner column, so candidate search is global. This is safe only for the current
single-user prototype. Multi-user use requires owner filtering on every query and transition.

## 2. Candidate search and context

`search_pending_questions` accepts one to three possible fields. The backend must:

1. Select only `OPEN` pending questions joined to `OPEN` Cases and `COLLECTING` Events.
2. Filter by the requested fields and order by `createdAt DESC, id DESC`.
3. Read three rows, return at most two, and set `hasMore` when a third exists.
4. Replace database IDs with run-local aliases such as `candidate_1`.
5. Keep the alias mapping only in `AgentExecutionState`.

Each returned candidate contains:

- alias, `expectedField`, question content, and question timestamp;
- current Event snapshot and version;
- the first Case-bound user message;
- the six most recent Case messages, deduplicated and ordered chronologically.

Case messages preserve partial evidence. If the original input says `next Friday` and the answer
says `10 AM`, resolve each phrase against the `createdAt` of the message containing it. Do not use
one global reference date.

The model decides semantic compatibility only inside this candidate set. A compatible answer must
supply a concrete value for `expectedField` and plausibly refer to that matter. Routing is:

- Exactly one compatible candidate: apply it.
- Multiple compatible candidates: request a self-contained restatement.
- `hasMore` with no explicit matter identity: request a restatement.
- No compatible candidate but a clear new matter: use the new-Case flow.
- No candidate and only a meaningful fragment: request a restatement.
- Meaningless or non-actionable text: return `MESSAGE_ONLY`.

A single database candidate is not sufficient evidence. `Thanks` does not answer `startAt`.

## 3. Persistent state

Add PostgreSQL enums:

- `pending_question_field`: `title`, `startAt`, `timeZone`
- `pending_question_status`: `OPEN`, `RESOLVED`

Add `pending_questions`:

| Column                   | Definition                                              |
| ------------------------ | ------------------------------------------------------- |
| `id`                     | UUID primary key, random default                        |
| `event_id`               | Required FK to `events.id`, `ON DELETE RESTRICT`        |
| `question_message_id`    | Required FK to `chat_messages.id`, `ON DELETE RESTRICT` |
| `expected_field`         | Required `pending_question_field`                       |
| `status`                 | Required `pending_question_status`, default `OPEN`      |
| `event_version`          | Required positive integer                               |
| `resolved_by_message_id` | Nullable FK to `chat_messages.id`, `ON DELETE RESTRICT` |
| `created_at`             | Required timestamp with time zone, default now          |
| `resolved_at`            | Nullable timestamp with time zone                       |

Do not store `case_id`; derive it through `event_id -> events.case_id`.

Constraints and indexes:

- One `OPEN` row per Event through a partial unique index.
- Unique `question_message_id` and unique non-null `resolved_by_message_id`.
- `event_version > 0`.
- `OPEN` requires both resolution columns to be null; `RESOLVED` requires both to be non-null.
- Open-row index on `(created_at DESC, id DESC)`.

Backend tools must also validate referenced messages: `question_message_id` points to an
`ASSISTANT / CLARIFICATION_QUESTION`, and `resolved_by_message_id` points to the current user input.
Generate the migration with `pnpm db:generate`, inspect its SQL and metadata, and do not backfill
old `COLLECTING` Events.

## 4. Tool contracts

Keep `create_case`, `propose_calendar_event`, and `show_event_preview` unchanged.
`propose_calendar_event` remains create-only.

### `ask_user` extension

In one transaction, lock and reload the Event, run Event Gate, write the case-bound
`CLARIFICATION_QUESTION`, and insert its `OPEN` pending row with the current Event version. Return an
identical existing open question instead of duplicating it. Reject a different open question for
the same Event.

### `search_pending_questions`

- Input: unique `fields` from `title`, `startAt`, and `timeZone`.
- Output: zero to two bounded candidates plus `hasMore`.
- This tool is read-only and never binds the input message.

### `apply_clarification_answer`

Input is `candidateToken` plus exactly one field value:

- `title`: nonblank string
- `startAt`: offset-aware ISO 8601 timestamp
- `timeZone`: valid IANA time zone

Reject database IDs and aliases not issued in the current run. Before writing, validate that:

- the input is an unbound `USER / USER_TEXT` message;
- the pending row is still `OPEN` and `field` equals `expectedField`;
- the Event is still `COLLECTING` at `pending_questions.event_version`;
- the expected field is still missing and the normalized value is valid.

One transaction must:

1. Lock the pending row, Event, and input message.
2. Patch only `expectedField`.
3. Recalculate status through Event Gate.
4. Update by `id + version` and increment the version once.
5. Bind the input to the Case and change it to `CLARIFICATION_ANSWER`.
6. Resolve the pending row with that message and a timestamp.

Any failed check rolls back every write. After success, `READY` leads to `show_event_preview`;
`COLLECTING` leads to `ask_user` for one backend-reported missing field. Copy the authoritative Case
and Event IDs into `AgentExecutionState` before that next step.

### `request_restatement`

Store a case-less `ASSISTANT / CLARIFICATION_QUESTION` and return `RESTATEMENT_REQUIRED`. Ask for the
matter and missing value in one message, for example `dentist at 10 AM`. Do not change pending
state. The next input starts a new search; a one-word selection is not remembered.

### `finish_message_only`

Perform no write beyond the user message already stored. Return `MESSAGE_ONLY` with no assistant
message or Event.

## 5. Agent, API, and backend invariants

Keep one tool call per step and the four-step limit. All normal paths in section 1 use at most three
steps; searching before the existing three-tool new-matter path uses all four. The Agent must end
through a terminal tool, never plain text. Event Gate overrides model confidence.

`POST /messages` remains HTTP 201 and adds an `outcome` discriminator:

| Outcome                  | `assistantMessage`   | `event`  |
| ------------------------ | -------------------- | -------- |
| `EVENT_PREVIEW`          | Required             | Required |
| `CLARIFICATION_QUESTION` | Required, Case-bound | Required |
| `RESTATEMENT_REQUIRED`   | Required, Case-less  | `null`   |
| `MESSAGE_ONLY`           | `null`               | `null`   |

Reload the input after the Agent run because continuation changes it from unbound `USER_TEXT` to
case-bound `CLARIFICATION_ANSWER`. Never expose Case or pending-question IDs.

Backend invariants:

- Save raw input before the first model call; keep all model calls outside transactions.
- Persist question plus pending state atomically.
- Persist Event patch, answer binding, and pending resolution atomically.
- Recheck the stored Event before preview; concurrent answers allow at most one success.
- Provider or step-limit failure preserves raw input and no partial transaction.
- A failure after a committed Event update keeps that authoritative state; recovery is out of scope.
- Delete a Case graph in this order: pending rows, Case messages, Events, then Case.

## 6. Implementation map

1. Add schema and generated migration files in `apps/api/src/database/schema.ts` and Drizzle's
   migration directory; extend `apps/api/test/database-schema.test.ts`.
2. Add aliases, candidate context, and terminal result types in
   `apps/api/src/agent/agent.types.ts`.
3. Implement all pending-question reads and writes in
   `apps/api/src/agent/agent-tools.service.ts`.
4. Update routing, tools, aliases, and stop conditions in
   `apps/api/src/agent/life-inbox-agent.service.ts`.
5. Return the discriminated result and reload the input in
   `apps/api/src/agent/agent-run.service.ts`; map it in
   `apps/api/src/messages/messages.controller.ts`.
6. Update deletion in `apps/api/src/cases/cases.service.ts`; add integration coverage in
   `apps/api/test/messages.integration.test.ts` and `apps/api/test/cases.integration.test.ts`.
7. After verification, update `docs/features/calendar-assistant.md` and mark this plan implemented.

Preserve unrelated worktree changes. Do not commit or push without explicit authorization.

## 7. Acceptance and verification

Use deterministic mock models. Normal tests must not call a paid model.

| Scenario                   | Required assertions                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Complete input             | One new Case and `READY` Event; preview; no pending row                                |
| Incomplete input           | One `COLLECTING` Event, Case-bound question, and versioned `OPEN` pending row          |
| Unique answer              | No new Case/Event; original Event updated once; answer bound; pending row resolved     |
| Still incomplete           | Old pending row resolved; Event remains `COLLECTING`; one new pending row opened       |
| Two compatible candidates  | `RESTATEMENT_REQUIRED`; input Case-less; no Event or pending change                    |
| Self-contained restatement | Only the identified candidate changes; the other remains `OPEN`                        |
| No candidate for `10 AM`   | Ask for matter plus value; create no Case, Event, or pending row                       |
| `Thanks` or noise          | Store only input; return `MESSAGE_ONLY`                                                |
| Stale or concurrent answer | At most one atomic update; losing input remains unbound                                |
| Regressions                | Provider failure, step limit, deletion, DTO, pagination, timezone, and date tests pass |

Primary failure experiment: create two Events with open `startAt` questions, then submit only
`10 AM`. The API must return `RESTATEMENT_REQUIRED`; both Events and pending rows stay unchanged,
and the new message stays Case-less.

Run from the repository root:

```bash
pnpm db:up
pnpm db:check
pnpm db:migrate
pnpm --filter @life-inbox/api test
pnpm --filter @life-inbox/api lint
pnpm --filter @life-inbox/api typecheck
pnpm --filter @life-inbox/api build
pnpm format:check
```

Inspect the generated migration before `pnpm db:migrate`. Update the feature document only after
all checks and the primary failure experiment pass.
