# LifeInbox Handoff

Updated: 2026-08-22

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
- The isolated LangChain `EventAgentService` boundary has been handwritten but
  has not been verified yet.
- `event_drafts` and its migration are implemented. PostgreSQL enforces one
  Draft per source message through a named unique constraint.
- The Event Draft database integration test covers the duplicate-source
  failure path.
- Vitest loads the API environment once per test worker through `test/setup.ts`.
- Drizzle schemas live under `src/database/schemas`.

## Current stage

Phase 1 backend, Persistent Interaction Timeline, is complete. Frontend timeline
integration is outside the current backend chat.

Phase 2, Structured Event Extraction, is in progress.

## Next slice

Not approved yet. Add a minimal injectable model boundary and deterministic
tests for `EventAgentService` before connecting extraction to Event Draft
persistence or `MessagesService`.

## Known follow-ups

- Existing AI SDK dependencies are unused and should be removed in an approved
  cleanup slice.
- `MessagesRepository` currently imports internal turn types from the HTTP DTO
  file. Move those types to the feature's internal boundary when message flow is
  changed.
- Latest verification: formatting, workspace lint, workspace typecheck,
  workspace build, Drizzle migration check, and API Vitest all pass. API Vitest
  currently contains two passing tests.

## Canonical documents

- `docs/v1/product-scope.md`
- `docs/v1/05-implementation-roadmap.md`
- `apps/api/AGENTS.md`

Older Email-related V1 content is obsolete when it conflicts with these files.
