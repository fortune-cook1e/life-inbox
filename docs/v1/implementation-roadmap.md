# V1 Implementation Roadmap

## 1. Purpose

Implement the Event-only V1 as a sequence of small, observable vertical slices.
Each phase must leave the application in a usable and replayable state before
the next phase begins.

This document defines implementation order and phase acceptance scope. It is not
a status log:

- use `docs/HANDOFF.md` and the area handoffs for current progress;
- use `product-scope.md` for product behavior and boundaries;
- use `agent-llm-contract.md` for the complete Event Agent design.

Email, memory, RAG, multi-agent collaboration, and the other exclusions in
`product-scope.md` are not V1 phases.

## 2. Phase 0: Project bootstrap

Establish the pnpm workspace and the minimum end-to-end development foundation:

```text
Next.js
  -> NestJS
  -> PostgreSQL through Drizzle
```

Done when:

- the web and API applications start;
- the browser can call API health endpoints;
- the API can connect to PostgreSQL;
- a reviewed Drizzle migration can be applied;
- environment-specific values remain outside application code.

## 3. Phase 1: Persistent interaction timeline

Implement the first observable product path with a deterministic assistant
response:

```text
Submit text
  -> persist user interaction
  -> persist assistant interaction
  -> render timeline
  -> refresh
  -> replay the same history
```

Done when:

- `POST /messages` and `GET /messages` support the development user;
- user and assistant text interactions persist in database order;
- invalid input is rejected by the API;
- refresh reconstructs the timeline from PostgreSQL rather than React state.

## 4. Phase 2: Structured Event extraction

Introduce LangChain model integration behind an injectable Agent boundary. The
initial fixed workflow establishes the Event interpretation and persistence
contracts before a tool loop is added.

```text
Persist user message
  -> invoke validated model output
  -> no Event: persist Event-only fallback
  -> Event: create Draft and Event Card atomically
```

Done when:

- runtime time and timezone context are supplied by the backend;
- model output is runtime validated;
- unsupported or missing Event fields are not invented;
- one source message creates at most one Event Draft;
- model failure cannot remove the persisted user message;
- Event Cards survive refresh.

## 5. Phase 3: Deterministic Event human-in-the-loop

Implement backend-owned Event Draft transitions and editable Event Cards:

```text
Pending Draft
  -> Edit
  -> Confirm -> exactly one final Event
  -> Reject  -> no final Event
```

Done when:

- edits update the pending Draft and append a historical interaction atomically;
- title, start time, IANA timezone, and temporal ordering are validated;
- confirmation creates one Event and marks the Draft confirmed in one
  transaction;
- rejection marks the Draft rejected without creating an Event;
- duplicate or invalid transitions cannot create duplicate business state;
- the complete interaction history remains replayable.

## 6. Phase 4: Bounded Event Agent

Replace fixed extraction with the bounded LangGraph Event Agent defined in
`agent-llm-contract.md`. Deliver it in two independently usable slices.

### Slice 1: Tool Calling and clarification

Add bounded model and tool execution with backend-owned context and narrow Event
tools:

```text
find incomplete Drafts
create one Draft
update one Draft
ask one focused clarification when required
```

The loop has explicit model-call, tool-call, mutation, timeout, and fallback
limits. PostgreSQL and backend validation remain authoritative.

Done when:

- complete Event input produces a persisted Event Card;
- incomplete input produces one focused clarification;
- a clarification reply can update the intended incomplete Draft;
- ambiguous candidates are not mutated arbitrarily;
- routine tests use deterministic injected models and no paid credits;
- a successful Draft mutation is not reported as failed because of a later
  model failure.

### Slice 2: Durable HITL and resume

Add durable Agent runs, PostgreSQL LangGraph checkpoints, and a public decision
boundary:

```text
Agent proposes confirmation
  -> interrupt and persist waiting state
  -> approve | deny | reject_event
  -> resume or terminate the same run
```

Done when:

- waiting runs survive process restart;
- status lookup supports page refresh and recovery;
- repeated decisions are rejected safely;
- clients cannot submit arbitrary tools, Draft IDs, or tool arguments;
- approve confirms exactly one Event;
- deny leaves the Draft pending and ends the run;
- reject_event rejects the same proposed Draft;
- direct public Draft Confirm and Reject endpoints are removed when the decision
  path becomes public.

## 7. Phase 5: Hardening

Harden the implemented Event workflow without adding product capabilities.
Prioritize observed risks rather than implementing an infrastructure checklist.

Relevant work may include:

- timeline pagination based on actual history size;
- integration coverage for database constraints and transactions;
- deterministic Agent regression cases and opt-in live evaluation;
- structured logging and request correlation without user content;
- timeout and safe error mapping review;
- environment validation;
- idempotency or operation-status contracts for uncertain client outcomes;
- database constraint, index, migration, and recovery review;
- authentication, authorization, CORS, and abuse boundaries before public use.

Done when the current product's important happy path and failure paths have
proportionate automated and operational evidence. Do not call V1 production
ready without testing deployment, security, recovery, and data-preservation
behavior.

## 8. Phase 6: V1 completion review

Verify the complete Event-only flow:

```text
Natural-language input
  -> persisted user interaction
  -> bounded Event Agent
  -> clarification when required
  -> persisted Event Card
  -> Edit / Confirm / Reject
  -> final Event or cancellation
  -> refresh
  -> complete historical replay
```

At minimum verify:

- complete and incomplete Event requests;
- an unrelated message and Event-only fallback;
- Event edit, approval/confirmation, denial, and rejection;
- invalid fields, temporal ordering, and IANA timezone handling;
- duplicate and invalid transitions;
- model, database, and checkpoint failure boundaries;
- process restart while an Agent run is waiting;
- preservation of original Event Card snapshots after edits;
- no paid model calls in routine verification.

V1 is complete only when the acceptance criteria in `product-scope.md` are met
and the remaining production-readiness gaps are explicitly documented.

## 9. Implementation order

```text
Phase 0  Project bootstrap
  -> Phase 1  Persistent timeline
  -> Phase 2  Structured Event extraction
  -> Phase 3  Deterministic Event HITL
  -> Phase 4  Bounded Event Agent
       -> Slice 1  Tool Calling and clarification
       -> Slice 2  Durable HITL and resume
  -> Phase 5  Hardening
  -> Phase 6  V1 completion review
```

Do not begin Memory, RAG, Email, or multi-agent work until this Event vertical
slice is complete and a new product requirement explicitly changes the scope.
