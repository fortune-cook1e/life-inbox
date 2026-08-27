# 03: Event Agent Architecture

This is the canonical design document for the Event Agent. Update it in the
same slice whenever the Agent context, memory model, tools, limits, HITL flow,
state ownership, persistence, or public API changes.

## Status

The design is approved. Implementation has not started.

V1 is Event-only and uses LangChain and LangGraph. The existing fixed Event
extraction workflow remains active until Slice 1 replaces it.

## Goals

The Event Agent should:

- understand new Event requests and clarification replies;
- inspect incomplete pending Event Drafts when context is ambiguous;
- create or update one pending Draft through narrow backend tools;
- ask a focused question when required information is missing;
- pause before confirming or rejecting a Draft;
- resume the same Agent run after a human decision;
- keep NestJS and PostgreSQL authoritative over every state transition.

V1 does not include long-term memory, automatic summarization, vector search,
external calendar writes, Email features, or generic database tools.

## Architecture

```text
POST /messages
  -> MessagesService persists the user message
  -> backend loads recent timeline and pending Draft context
  -> EventAgentService starts a bounded LangGraph run
  -> the model may call Event tools
  -> backend validates every tool operation
  -> incomplete Draft: persist an assistant clarification and finish
  -> complete Draft: propose confirm_event_draft and interrupt
  -> Postgres checkpointer saves the paused run
  -> frontend submits approve, deny, or reject_event
  -> the same run resumes or terminates
  -> EventDraftsService performs the final transaction
```

The model chooses what to attempt. Application services decide whether the
attempt is allowed. PostgreSQL stores the resulting business state.

## Ownership and dependency direction

| Capability | Owner | Responsibility |
| --- | --- | --- |
| HTTP message intake and public timeline | `MessagesModule` | Persist user-visible interactions and map public responses |
| Agent graph, prompt, tools, limits, HITL, and checkpointer | `AgentsModule` | Run and resume the Event Agent |
| Draft and Event lifecycle | `EventsModule` | Validate and execute Draft and Event transitions |
| PostgreSQL client and lifecycle | `DatabaseModule` | Own the application database connection |

`AgentsModule` may depend on the public Event capability exposed by
`EventsModule`. `EventsModule` must not depend on Agent code. Tool adapters call
`EventDraftsService`; they do not import repositories or Drizzle schemas.

## Sources of state

The system has separate state for separate responsibilities.

| State | Storage | Authority |
| --- | --- | --- |
| User-visible timeline | `messages` | Product conversation history |
| Draft and Event state | `event_drafts`, `events` | Business truth |
| Agent run lifecycle | `agent_runs` | Public run status and decision idempotency |
| Model messages, tool calls, tool results, and interrupts | LangGraph checkpoints | Internal execution state for one Agent run |

Checkpoint messages are not the product timeline. Clearing Agent checkpoints
must not remove Messages, Drafts, or Events.

## Context and short-term memory

Each new user message creates a new Agent run. Before invocation, the backend
supplies:

1. backend-owned current date/time;
2. the request timezone;
3. up to 10 recent timeline interactions before the current message;
4. incomplete pending Drafts;
5. the source user message for each candidate Draft;
6. the current user message exactly once.

LangChain short-term memory holds the messages and tool results produced inside
that run. If the run is interrupted, the checkpointer preserves this state and
the same `threadId` resumes it.

A normal clarification finishes the current run. The user's answer starts a new
run and rebuilds context from `messages` and `event_drafts`. This avoids using
checkpoint tables as a second product conversation database.

For V1, `agentRunId` is also the LangGraph `threadId`. The product still has one
timeline and no separate conversation entity.

## Agent tools

The final allow-list contains five tools.

### `find_incomplete_event_drafts`

Returns pending Drafts whose `title` or `startAt` is missing, together with the
source message needed to understand each Draft. It is read-only.

### `create_event_draft`

Creates one pending Draft for the current source message. The backend supplies
the source message ID and default timezone through trusted runtime context. The
model cannot choose either value.

### `update_event_draft`

Updates one pending candidate Draft. The backend validates its ID, current
status, field schema, timezone, and temporal ordering before persistence.

### `confirm_event_draft`

Creates the final Event and moves the Draft from `pending` to `confirmed` in one
transaction. The Agent may propose this tool only after backend readiness
validation succeeds. HITL interrupts before execution.

### `reject_event_draft`

Moves the Draft from `pending` to `rejected` and persists the timeline outcome
in one transaction. It runs only after an explicit `reject_event` decision.

The Agent never receives a generic query or write tool.

## Readiness

The model does not decide that a Draft is ready. After every create or update,
the backend validates at least:

- a non-empty title;
- a valid local start datetime;
- a valid IANA timezone;
- an end datetime that is not before the start;
- `pending` Draft status.

An incomplete result returns missing or invalid field information to the Agent,
which may ask one focused clarification. A complete result allows the Agent to
propose `confirm_event_draft`.

## Bounded execution

One Agent run has these limits:

- `parallelToolCalls` is disabled;
- at most three model calls before completion or interrupt;
- at most three tool calls in the thread;
- at most one create or update mutation before human review;
- after human review, at most one final confirm or reject transition;
- model calls use the existing 15 second timeout and one provider retry;
- model and other external calls stay outside database transactions.

Three tool calls are required for the longest normal path:

```text
find incomplete Drafts
  -> update one Draft
  -> propose confirm_event_draft
```

Confirm and Reject return a deterministic application outcome after execution;
the graph does not need another model call to describe the transition.

## HITL decisions

When the Agent proposes `confirm_event_draft`, LangChain HITL pauses the run and
returns an approval request. The frontend exposes three product decisions.

| Public decision | Internal handling | Draft result |
| --- | --- | --- |
| `approve` | Approve the proposed `confirm_event_draft` call | `confirmed` |
| `deny` | Do not execute the tool; finish the run | remains `pending` |
| `reject_event` | Replace the proposed call with `reject_event_draft` for the same Draft | `rejected` |

`reject_event` is an application decision, not a native LangChain decision. The
backend maps it to a controlled tool edit. The client cannot submit a tool name,
Draft ID, or arbitrary arguments. The only allowed edit is:

```text
confirm_event_draft(draftId)
  -> reject_event_draft(the same draftId)
```

`deny` ends the run so the Agent cannot immediately retry confirmation.

## Agent run lifecycle

The application owns a small `agent_runs` table:

```text
id
source_message_id
status: running | waiting | completed | failed
created_at
updated_at
```

The run ID is the public identifier and LangGraph thread ID. The table supports
status lookup, page refresh, decision idempotency, and future ownership checks.
It does not copy model messages, tool calls, or interrupt payloads from the
checkpoint.

Expected transitions are:

```text
running -> completed
running -> waiting
running -> failed
waiting -> completed
waiting -> failed
```

A completed or failed run cannot accept another decision.

## Public API direction

`POST /messages` returns one of two outcomes inside the existing API envelope:

```ts
type EventAgentRunResponse =
  | {
      status: "completed";
      runId: string;
      userMessage: MessageResponse;
      assistantMessage: MessageResponse;
    }
  | {
      status: "requires_decision";
      runId: string;
      userMessage: MessageResponse;
      preview: EventCardMessageResponse;
      decisions: ["approve", "deny", "reject_event"];
    };
```

`POST /agent-runs/:runId/decision` accepts one decision enum and either resumes
or terminates the waiting run.

`GET /agent-runs/:runId` returns the current public status and pending approval
view so the client can recover after a refresh.

When Slice 2 ships, the public Draft Confirm and Reject endpoints are removed.
`EventDraftsService.confirmDraft()` and `rejectDraft()` remain internal business
capabilities used by the resumed Agent workflow.

## Persistence and transactions

The application continues to use Drizzle migrations for product tables.
`@langchain/langgraph-checkpoint-postgres` owns checkpoint tables in a dedicated
`langgraph` PostgreSQL schema. Its setup runs as an explicit deployment command,
not as hidden DDL during an HTTP request.

The checkpointer is an injectable provider owned by `AgentsModule`. Its
connection closes during Nest application shutdown.

The following writes remain atomic:

- Draft creation and its initial Event Card snapshot;
- Draft update and its Event Card snapshot;
- final Event creation, Draft confirmation, and timeline interaction;
- Draft rejection and its timeline interactions.

The user message is persisted before the Agent runs. If the provider or graph
fails later, that user message remains in the timeline.

## Failure behavior

- Invalid model tool arguments are rejected before business persistence.
- A missing or non-pending Draft produces a controlled tool failure.
- A model or provider failure maps through the existing Event Agent error
  boundary without exposing internal diagnostics.
- A checkpointer failure cannot execute a final transition.
- Repeated decisions are rejected by `agent_runs.status` and existing Draft and
  Event constraints.
- A server restart can resume a waiting run through the Postgres checkpointer.

V1 deliberately does not compare the approval preview with a later Draft
version. If the Draft changes while approval is waiting, Confirm or Reject acts
on the latest valid pending Draft state. The repository still locks the row and
rechecks status and readiness. This trade-off is acceptable for the current
single-user V1 and must be revisited before concurrent editing or multi-user
access.

## Verification

Normal automated tests use deterministic injected models and do not consume API
credits. Core coverage includes:

- tool routing for a complete Event;
- clarification for missing title or start time;
- updating the intended incomplete pending Draft;
- no update when multiple candidates remain ambiguous;
- tool limits and disabled parallel calls;
- no final Event before approval;
- approve, deny, and reject_event outcomes;
- repeated decision rejection;
- resume after recreating the application with the same Postgres checkpoint;
- atomic Draft and Event transitions.

A separate opt-in command runs a small real-model acceptance suite. It is not
part of normal CI. It checks five scenarios: complete Event, missing start time,
missing meaningful title, clarification reply, and ambiguous multiple Drafts.
Assertions inspect tool choice, arguments, persistence, and interrupt state, not
exact natural-language wording. The Agent under test does not judge its own
correctness.

## Delivery slices

### Slice 1: bounded Tool Calling and clarification

Slice 1 replaces fixed extraction with the three read and Draft tools, context
assembly, bounded execution, clarification, and the opt-in real-model acceptance
entry point. Existing public Confirm and Reject endpoints remain available, so
the backend stays usable before Slice 2.

### Slice 2: Postgres checkpointer and HITL

Slice 2 adds `agent_runs`, Postgres checkpoints, approval and status APIs,
approve/deny/reject_event handling, restart recovery, and removal of the public
Draft Confirm and Reject endpoints.

Each slice updates this document and `docs/HANDOFF.md` when completed.

## Trade-offs

### Tool Calling instead of one structured action

Tool Calling lets the model inspect data, react to tool results, and ask a
question within one bounded run. It costs more model calls and adds loop failure
modes. Strict call limits, narrow tools, and backend validation contain that
risk.

### LangChain HITL instead of direct Event Card transitions

HITL preserves the exact proposed tool call and supports pause and resume across
HTTP requests. It also requires a checkpointer, Agent run lifecycle, and new API
states. This complexity is accepted because learning and implementing a real
Agent workflow is part of the project goal.

### Product history outside Agent memory

`messages` remains queryable and independent of LangGraph internals. The Agent
must rebuild context for every new run, but the product avoids two competing
conversation databases.

### An application run record beside checkpoints

`agent_runs` duplicates only public lifecycle status, not graph state. This
small duplication makes idempotency, recovery, and future authorization explicit
without exposing checkpoint internals through the API.

### PostgreSQL checkpointer instead of in-memory persistence

An in-memory saver is easier to start with but loses waiting approvals on
restart. PostgreSQL supports the behavior that HITL promises. Its package-managed
tables live in a separate schema to keep them distinct from product tables.

### Stale preview protection deferred

Version matching would ensure that users approve exactly the snapshot they saw.
It adds a concurrency contract that the current single-user V1 does not need.
The accepted consequence is that a decision applies to the latest valid pending
Draft if it changes while waiting.

### Two independently usable slices

Shipping Tool Calling first keeps clarification work reviewable. HITL then adds
pause and resume without blocking the Agent learning path or requiring an
all-at-once rewrite.
