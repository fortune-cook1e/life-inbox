# Project Handoff

Updated: 2026-09-02

## Current scope and priority

- V1 is Event-only; Email, memory, RAG, multi-agent work, and multiple
  conversations remain out of scope.
- Finish and verify the current frontend before starting Agent Phase 4 Slice 2.
- PostgreSQL is authoritative, and LangChain is the API's only LLM ecosystem.

## Current status

- Backend Phases 1–3 and Agent Phase 4 Slice 1 are implemented.
- The frontend has `/event-chat` and `/settings`, persisted timeline replay,
  Event Draft actions, a responsive sidebar, and light/dark/system themes.
- Frontend changes are implemented but not yet typechecked, linted, built, or
  accepted in a running browser.

## Active boundary and next work

- The frontend still calls the Phase 3 Draft Confirm/Reject endpoints. Agent
  Slice 2 must replace them with the durable HITL decision API rather than keep
  two public final-transition paths.
- Next frontend slice: local IANA timezone preference. Agent Slice 2 remains
  paused until the frontend is usable for end-to-end testing.

## Area handoffs

- [Backend](./HANDOFF-BACKEND.md)
- [Frontend](./HANDOFF-FRONTEND.md)
- [Deployment](./HANDOFF-DEPLOYMENT.md)
- Canonical design: `docs/v1/product-scope.md`,
  `docs/v1/agent-llm-contract.md`, and `docs/v1/implementation-roadmap.md`.
