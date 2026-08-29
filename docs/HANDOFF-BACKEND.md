# Backend Handoff

Updated: 2026-08-28

## Current status

- NestJS, Drizzle, PostgreSQL, global Zod validation, request IDs, safe API
  envelopes, and persisted interaction replay are implemented.
- Message and Event workflows persist text, Event Cards, edits, confirmations,
  and rejections. Draft transitions and their timeline interactions are atomic;
  one source Message creates at most one Draft and one Draft at most one Event.
- Agent Phase 4 Slice 1 uses bounded LangGraph tool calling to find, create, or
  update pending Drafts and ask one clarification when required. PostgreSQL and
  backend validation remain authoritative.

## Active boundaries

- Runs allow at most three model calls, three tool calls, and one Draft mutation;
  OpenAI parallel tool calls are disabled and routine tests use model doubles.
- Public Draft Edit/Confirm/Reject endpoints remain the temporary Phase 3 HITL
  path. Slice 2 must replace Confirm/Reject with durable Agent decisions.
- CORS currently allows all origins for credential-free development. Add an
  explicit allowlist before credentialed authentication or public production.

## Next slice

Agent Phase 4 Slice 2 is paused until frontend verification. It adds durable
`agent_runs`, PostgreSQL checkpoints, status/recovery APIs, and bounded
`approve`, `deny`, and `reject_event` decisions.

## Verification gaps

- Normal API suite passed 24/24 on 2026-08-28; five paid live-Agent scenarios
  were skipped as intended.
- Typecheck, lint, build, deployment, authentication, recovery, and production
  security have not been verified.

See `docs/v1/agent-llm-contract.md` for the authoritative Agent design.
