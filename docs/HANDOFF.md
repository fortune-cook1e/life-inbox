# LifeInbox Handoff

Updated: 2026-08-24

## Scope and working agreement

- V1 is Event-only. Email features are out of scope.
- Current work is backend-only in `apps/api`; frontend work is paused.
- Build the fixed, single-pass Event extraction workflow first. Add a bounded
  LangGraph tool loop only after that workflow is complete.
- Use the LangChain ecosystem for new LLM work. Do not add AI SDK usage.
- Codex provides reference code and design explanations; the user handwrites it.
- Use test-first development for core business behavior. Codex provides the test
  first and waits for the expected failure before providing implementation code.
- Use proportional verification instead of forced TDD for configuration,
  boilerplate, simple wiring, and generated artifacts. The user runs commands
  unless Codex is explicitly asked to run them.

## Current implementation

- NestJS bootstrap, API-owned environment loading, PostgreSQL, Drizzle, and
  graceful database shutdown are implemented.
- `HealthModule` exposes `GET /health`.
- Global request validation uses `ZodValidationPipe` through `APP_PIPE`.
- `MessagesModule` exposes `POST /messages` and `GET /messages`.
- `POST /messages` persists a user message and deterministic assistant reply.
- `GET /messages` returns persisted history ordered by backend-generated
  `sequence`.
- `EventAgentService` owns prompt/schema composition and receives its model
  through a private Nest injection token.
- Deterministic service tests cover structured Event output and model-failure
  mapping without calling OpenAI.
- `event_drafts` and its migration are implemented. PostgreSQL enforces one
  Draft per source message through a named unique constraint.
- The Event Draft database integration test covers the duplicate-source
  failure path.
- `EventsModule` owns pending Event Draft creation, IANA timezone resolution,
  and the private Drizzle repository. Its PostgreSQL-backed service tests cover
  persistence and invalid-timezone rejection.
- Vitest loads the API environment once per test worker through `test/setup.ts`.
- Drizzle schemas live under `src/database/schemas`.

## Current stage

Phase 1 backend, Persistent Interaction Timeline, is complete. Frontend timeline
integration is outside the current backend chat.

Phase 2, Structured Event Extraction, is in progress.

## Next slice

Approved but deferred. Next, add the smallest durable Event Card representation
to the message timeline before connecting `MessagesService`,
`EventAgentService`, and `EventsService`.

## Known follow-ups

- Existing AI SDK dependencies are unused and should be removed in an approved
  cleanup slice.
- `MessagesRepository` currently imports internal turn types from the HTTP DTO
  file. Move those types to the feature's internal boundary when message flow is
  changed.
- The user reported all Event Agent and Events tests/checks passing. Codex did
  not rerun them.

## Canonical documents

- `docs/v1/product-scope.md`
- `docs/v1/05-implementation-roadmap.md`
- `apps/api/AGENTS.md`

Older Email-related V1 content is obsolete when it conflicts with these files.
