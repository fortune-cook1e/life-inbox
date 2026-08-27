# LifeInbox Handoff

Updated: 2026-08-27

## Scope and working agreement

- V1 is Event-only. Email features are out of scope.
- Current work is backend-only in `apps/api`; frontend work is paused.
- Build the fixed, single-pass Event extraction workflow first. Add a bounded
  LangGraph tool loop only after that workflow is complete.
- Use the LangChain ecosystem for new LLM work. Do not add AI SDK usage.
- Codex provides reference code and design explanations; the user handwrites
  production and feature implementation unless direct implementation is
  explicitly authorized.
- Codex directly adds approved unit, integration, and end-to-end tests to the
  codebase without requiring a separate confirmation. Use test-first development
  for core behavior and wait for the expected failure before implementation.
- Use proportional verification instead of forced TDD for configuration,
  boilerplate, simple wiring, and generated artifacts. The user runs commands
  unless Codex is explicitly asked to run them.

## Current implementation

- NestJS bootstrap, API-owned environment loading, PostgreSQL, Drizzle, and
  graceful database shutdown are implemented.
- `HealthModule` exposes `GET /api/health` through the global API prefix.
- Global request validation uses `ZodValidationPipe` through `APP_PIPE`.
- The `@life-inbox/shared` workspace package owns the three-field API envelope
  and numeric application error-code contract. The API consumes it now; frontend
  adoption remains paused.
- A global interceptor wraps successful responses as `{ code, data, message }`;
  the global exception filter preserves HTTP statuses and uses the same envelope
  for safe errors. Validation and controlled HTTP failures return an explicit
  public message, while internal diagnostics and unexpected-error stacks stay
  in request-ID-correlated logs. Request IDs remain in the `x-request-id` header.
- Typed application service failures such as Event Agent provider failures map
  to `503/ServiceUnavailable`; invalid Event Draft transitions map to
  `422/ValidationError` without leaking feature errors into common HTTP code.
- `MessagesModule` exposes `POST /api/messages` and `GET /api/messages`.
- `POST /api/messages` persists user input and runs the fixed Event extraction
  workflow using the request timezone and backend-owned current time.
- Its response returns the persisted turn as the named object
  `{ userMessage, assistantMessage }`, not a positional tuple.
- `GET /api/messages` returns persisted history ordered by backend-generated
  `sequence`.
- `EventAgentService` owns prompt/schema composition and receives its model
  through a private Nest injection token.
- Deterministic service tests cover structured Event output and model-failure
  mapping without calling OpenAI.
- `event_drafts` and its migration are implemented. PostgreSQL enforces one
  Draft per source message through a named unique constraint.
- The Event Draft database integration test covers the duplicate-source
  failure path.
- `EventsModule` owns the Event lifecycle. Its public API is currently organized
  around `EventDraftsController` and `EventDraftsService`; no standalone final
  Event service/repository exists before a real query or update use case needs it.
- The message timeline stores text, assistant Event Card snapshots, and user
  Event Edit, Confirm, and Reject interactions. PostgreSQL enforces their
  role/content/payload shapes.
- `MessagesService` validates Event Card payloads before persistence, and
  message history maps text and Event Card rows through a discriminated response.
- The fixed message workflow persists user input, invokes `EventAgentService`,
  and routes text results or Event results without an Agent loop.
- `EventDraftIntakeRepository` owns atomic Draft-plus-initial-Card creation.
- `EventDraftTransitionsRepository` owns Edit, Confirm, and Reject transactions.
  `EventDraftsService` returns application outcomes; the controller alone maps
  them to HTTP exceptions.
- Event action response contracts and mappers belong to `EventsModule`.
  `MessagesModule` depends on them only to render the combined timeline; Events
  does not import Messages presentation code.
- `events.source_draft_id` is unique, so one Draft can create at most one final
  Event.
- `PATCH /api/event-drafts/:draftId`, `POST .../confirm`, and `POST .../reject`
  expose the complete Event human-in-the-loop workflow.
- Database invariant tests share one transaction helper and roll back each test
  on the same PostgreSQL connection.
- Vitest loads the API environment once per test worker through `test/setup.ts`.
- Drizzle schemas live under `src/database/schemas`.

## Current stage

Phase 1 backend, Persistent Interaction Timeline, is complete. Frontend timeline
integration is outside the current backend chat.

Phase 2, Structured Event Extraction, is complete for the backend. A real HTTP
acceptance test proves Event extraction, atomic Draft-plus-Card persistence,
history replay, and rejection of an invalid request before persistence.

Phase 3, Event Human-in-the-Loop, is complete for the backend. Edit, Confirm,
and Reject allow only pending Draft transitions and persist their state change
and timeline interaction atomically.

## Next slice

Begin Phase 4 by defining the first bounded Event clarification slice, including
its allowed tools, stop limits, fallback, and one missing-field acceptance case.

## Known follow-ups

- Frontend proxy and API-envelope contract reconciliation remains paused with
  the rest of frontend work.
- For clean databases, migration `0004` performs the single final `message_kind`
  rebuild and `0005` only creates `events`. The existing local database already
  has the final schema; no database command was run while consolidating the files.
- AI SDK dependencies were removed; API LLM code is LangChain-only.
- The current post-review changes have not been run yet. Tests are limited to
  core workflows, business state transitions, transaction rollback, and database
  invariants; duplicate framework, schema-shape, and health wiring tests were
  removed.

## Canonical documents

- `docs/v1/product-scope.md`
- `docs/v1/05-implementation-roadmap.md`
- `apps/api/AGENTS.md`

Older Email-related V1 content is obsolete when it conflicts with these files.
