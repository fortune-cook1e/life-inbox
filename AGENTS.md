# LifeInbox repository instructions

## Repository purpose

LifeInbox is a V1 Event Assistant with one persistent conversation per user. It
is both a product project and a backend/Agent learning project, so work should
optimize for understanding, correctness, and small observable progress rather
than maximum implementation speed.

## Product scope and invariants

- V1 is Event-only. Email generation or delivery, memory, RAG, document upload,
  multi-agent collaboration, task management, recurring Events, proactive
  actions, and multiple conversations are out of scope.
- A user can submit natural-language text, receive an editable Event Draft, and
  edit, confirm, or reject it.
- Every visible interaction must be persisted and replayable after refresh.
- Interaction history records what happened; Event business data records the
  final confirmed result. Do not collapse these into one representation.
- PostgreSQL and validated backend tool results are authoritative over client or
  model claims.
- Keep LLM and other external calls outside database transactions.

See `docs/canonical/product-scope.md` for the complete V1 behavior and
acceptance criteria.

## Workspace and technology map

This is a pnpm TypeScript monorepo:

```text
apps/web          Next.js App Router, React, Tailwind CSS, shadcn/ui
apps/api          NestJS, Drizzle ORM, PostgreSQL, LangChain/LangGraph
packages/shared   Shared API envelope and error contracts
```

Infrastructure used in local development:

- PostgreSQL is the system of record.
- Redis is available through Docker Compose but must not be used without a
  current requirement.
- The browser calls the NestJS API directly; there is no Next.js BFF.

Package manifests and the current code are authoritative for exact dependency
versions and implemented structure.

## Architecture and ownership

The main data flow is:

```text
Browser
  -> NestJS controller and runtime validation
  -> application service
  -> PostgreSQL and/or Event Agent
  -> validated, persisted interactions and Event state
  -> browser reloads the authoritative timeline
```

Ownership boundaries:

- React owns rendering, forms, and temporary interaction state.
- NestJS owns public API validation, application workflows, and state
  transitions.
- PostgreSQL owns persisted interaction and Event state.
- The Event Agent interprets input and may select bounded tools; it does not own
  persistence decisions.
- Backend tools validate every Agent-requested state transition before
  persistence.
- `packages/shared` owns only contracts that have real consumers in more than
  one application.

Prefer dependencies that point from delivery layers toward capability-owned
services and explicit infrastructure boundaries. Do not let the frontend or an
Agent write directly to the database.

## Common commands

Run commands from the repository root unless a scoped instruction says
otherwise.

```bash
pnpm dev              # run web and API
pnpm dev:web          # run Next.js only
pnpm dev:api          # run NestJS only
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check
pnpm test:api         # deterministic API test suite

pnpm db:up
pnpm db:down
pnpm db:generate
pnpm db:migrate
pnpm db:check
pnpm db:studio
```

Use committed migrations for shared and production environments. `pnpm db:push`
is reserved for approved local schema experimentation and is not a production
migration mechanism.

Normal tests must use deterministic model doubles and must not consume paid API
credits. Do not run paid live-Agent scenarios unless explicitly requested.

## Instruction and documentation authority

For working instructions, use this order:

1. The nearest scoped `AGENTS.md`.
2. The explicitly approved task scope and authorization.
3. This repository `AGENTS.md`.
4. Canonical documents.
5. The current Handoff.
6. Older technical documentation.

Explicit task authorization does not override repository safety, security, or
data-protection rules. Current code, schemas, migrations, package manifests,
and Git state remain authoritative for implementation facts.

The canonical documentation set is:

- `docs/canonical/product-scope.md`: V1 product behavior, invariants, and
  boundaries.
- `docs/canonical/agent-llm-contract.md`: Agent context, tools, limits, HITL,
  validation, public API direction, and persistence flow.
- `docs/canonical/implementation-roadmap.md`: V1 implementation order and
  phase acceptance scope.
- `docs/canonical/deployment.md`: approved deployment architecture, identity,
  delivery, cost, and data boundaries.

Current status is separate from canonical design:

- `docs/HANDOFF.md`: the active workstream, minimum system status, next slice,
  verification gaps, blockers, and links to relevant canonical documents.
- `docs/future-plan.md`: non-active possibilities that are not approved roadmap
  or implementation authorization.
- `docs/features/`: temporary briefs for approved large features.

Do not create another canonical document when an existing canonical document
has the correct ownership. Update the owning document in the same slice.
Surface conflicts between documentation and current code instead of silently
choosing one.

## Scoped instructions

- Read `docs/HANDOFF.md` before planning or implementing repository work.
- Follow `apps/api/AGENTS.md` for backend, database, NestJS, and Agent learning
  work.
- Follow `apps/web/AGENTS.md` for work under `apps/web`.
- Keep scoped framework details out of this root file unless they establish a
  cross-application invariant.

The Handoff is a minimum-sufficient status snapshot, not a progress log or
implementation inventory. Update `docs/HANDOFF.md` after completing a slice or
major feature, or when a decision changes the active scope or next slice. Add
Area Handoffs only when independent active workstreams make one Root Handoff
insufficient. Replace stale entries instead of appending history. Keep only
information whose removal could cause incorrect continuation, duplicate work, a
violated boundary, or a false verification claim.

## Task flow and authorization

A preferred task brief contains:

- Goal
- Boundary
- Decisions
- Done when

For discussion, review, explanation, or diagnosis, do not modify files unless
explicitly asked.

If a request is vague, such as "let's do the next part":

1. Inspect the current code, instructions, handoffs, and Git status.
2. Summarize what is already complete.
3. Propose exactly one smallest observable vertical slice.
4. Explain its outcome, data flow, main invariant, non-goals, failure
   experiment, acceptance tests, and documentation conflicts.
5. Ask for one material decision and wait for approval.

If a slice is already approved and implementation is explicitly authorized,
start without requesting another confirmation.

During implementation:

- Implement only the approved slice.
- Preserve unrelated staged, unstaged, and untracked changes.
- Prefer an observable end-to-end path over speculative infrastructure.
- Do not add packages, schema fields, services, queues, caches, or abstractions
  without a current requirement.
- Review schema constraints and migration impact before generating migrations.
- Do not commit, push, deploy, publish, or perform destructive data operations
  unless explicitly authorized.

## Agent-specific rules

- Keep `docs/canonical/agent-llm-contract.md` synchronized with every change to
  the Agent's context, action contract, validation boundary, tools, loop
  limits, or persistence flow.
- Use bounded Agent loops with explicit stop conditions.
- The LLM may interpret input, choose tools, ask questions, and propose changes;
  backend tools remain authoritative for state transitions.
- Do not expose generic database-write tools to the Agent.
- Preserve one validated production write path rather than adding alternate
  paths for tests or Agent convenience.

## Verification and completion

Verification commands may be run only when the user explicitly authorizes it.
Otherwise, provide the exact commands defined by the affected package and report
them as not run.

When verification is authorized:

- verify the happy path and the most important failure path proportionally to
  the change;
- use the smallest test layer that proves the affected invariant;
- use test-first development for changed core business rules, important state
  transitions, transaction behavior, security constraints, and bug regressions;
- do not weaken assertions or use paid model calls to make routine tests pass.

Before reporting completion:

- review the final diff for unrelated changes;
- update affected contracts and handoffs when required;
- report what changed and why;
- report exactly which checks ran and their results;
- report what was not verified and any remaining risk;
- explain the final data flow, main invariant, and one prevented failure for a
  non-trivial slice.
