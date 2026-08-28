# Backend Handoff

Updated: 2026-08-28

## Implemented

- NestJS bootstrap, API environment loading, PostgreSQL, Drizzle, graceful
  shutdown, `HealthModule`, and global Zod validation are implemented.
- NestJS currently allows all CORS origins and exposes `x-request-id` to browser
  clients. This fits the credential-free development V1; restore an explicit
  origin allowlist before credentialed authentication or public production use.
- The shared package owns the API envelope and numeric error codes. Successes
  use `{ code: 0, data, message: "success" }`; safe errors preserve the HTTP
  status and request ID without exposing internal diagnostics.
- `POST /api/messages` persists the user message, loads up to 10 prior timeline
  interactions, and invokes the bounded Event Agent with backend time and the
  request timezone. It returns `{ userMessage, assistantMessage }`.
- `GET /api/messages` returns the persisted timeline ordered by database
  sequence.
- Messages persist text, `event_card`, `event_edit`, `event_confirm`, and
  `event_reject` interactions with database-enforced shapes.
- `EventsModule` owns Event Draft creation, Agent updates, manual edits,
  confirmation, rejection, and final Event creation.
- `PATCH /api/event-drafts/:draftId`, `POST .../confirm`, and `POST .../reject`
  expose the current Event human-in-the-loop workflow.
- Draft mutations and their timeline interactions are atomic. One source
  message creates at most one Draft; one Draft creates at most one Event.

## Event Agent

- Phase 4 Slice 1 uses a bounded LangGraph Tool Calling loop with no AI SDK.
- The tools find incomplete Drafts, create one Draft, or update one Draft.
- Runs allow at most three model calls, three tool calls, and one Draft
  mutation. OpenAI parallel tool calls are disabled.
- Middleware injects up to 10 recent interactions and logs tool lifecycle
  metadata without user content, Event values, arguments, or raw errors.
- Pending Draft state remains in PostgreSQL and is read through a tool.
- The terminal response uses a Zod response format containing one public
  message. Missing title or start time produces clarification text.
- Date-only input must leave `startAt` null. It must not become midnight unless
  the user explicitly says midnight.

## Verification snapshot

- The normal API suite passed 24/24 on 2026-08-28.
- Five paid live-Agent scenarios are excluded from normal verification.
- Typecheck, lint, and build were not run for the Agent slice.
- Routine Agent tests use deterministic model doubles and no paid credits.

## Paused next slice

Phase 4 Slice 2 adds `agent_runs`, a PostgreSQL LangGraph checkpointer,
approval/status APIs, and `approve`, `deny`, and `reject_event` decisions. It
then removes the public Draft Confirm and Reject endpoints so resumed Agent
runs become the only public final-transition path.

See `docs/v1/03-agent-llm-contract.md` for the complete Agent design and
trade-offs.
