# LifeInbox Handoff

Updated: 2026-08-28

## Scope

- V1 is Event-only. Email features are out of scope.
- The current priority is completing the frontend against the implemented
  backend before starting the next Agent slice.
- LangChain is the only LLM ecosystem used by the API.

## Working agreement

- Read this file first, then read the handoff for the area being changed.
- Current code, schemas, migrations, and git state remain authoritative.
- Codex may implement explicitly approved feature work and approved tests.
- Run verification only when explicitly authorized; otherwise provide the
  package commands for the user to run.
- Keep LLM calls outside database transactions and keep backend tools
  authoritative over model claims.

## Area handoffs

- [Backend handoff](./HANDOFF-BACKEND.md)
- [Frontend handoff](./HANDOFF-FRONTEND.md)

## Current status

- Backend Phases 1 through 3 and Agent Phase 4 Slice 1 are implemented.
- The frontend contract and Event Draft interaction alignment is implemented
  but has not yet been verified.
- Agent Phase 4 Slice 2, LangChain HITL and durable checkpointing, is paused
  until the current frontend is usable for end-to-end testing.

## Canonical documents

- `docs/v1/product-scope.md`
- `docs/v1/03-agent-llm-contract.md`
- `docs/v1/05-implementation-roadmap.md`
- `apps/api/AGENTS.md`

Older Email-related V1 content is obsolete when it conflicts with these files.
