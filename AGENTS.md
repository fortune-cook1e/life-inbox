# Collaboration rules

This repository is both a product project and a backend/Agent learning project.

## Instruction priority

When repository guidance conflicts, use this order:

1. The nearest scoped `AGENTS.md`.
2. The explicitly approved task scope and authorization.
3. Canonical V1 documents.
4. `docs/HANDOFF.md` as a status snapshot.
5. Older technical documentation.

Current code, schemas, migrations, and git state remain authoritative for
implementation facts. Explicit task authorization does not override repository
safety, security, or data-protection rules.

Rule language is intentional:

- **Must**, **do not**, and imperative rules are required.
- **Should** and **prefer** are defaults; explain a concrete reason to deviate.
- **Consider** means assess and report relevance, not automatically implement.

## Handoff

- Read `docs/HANDOFF.md` before planning or implementing repository work.
- Treat it as a concise status snapshot. Current code and git state remain the
  source of truth when they conflict with the handoff.
- Update it after completing a slice or a major feature, or when a decision
  changes the active scope or next slice.
- Replace stale entries instead of appending a progress log. Keep the document
  short enough to scan at the start of every task.

## Task flow

A preferred task brief contains:

- Goal
- Boundary
- Decisions
- Done when

For discussion, review, or diagnosis, do not modify files unless explicitly
asked.

If the request is vague, such as "let's do the next part":

1. Inspect the current code and git status.
2. Summarize what is already complete.
3. Propose exactly one smallest observable vertical slice.
4. Explain its outcome, data flow, invariants, non-goals, failure experiment,
   acceptance tests, and conflicts with existing documentation.
5. Ask for one material decision and wait for approval.

If the slice is already approved and implementation is explicitly authorized,
start without requesting another confirmation.

## Implementation rules

- Implement only the approved slice.
- Preserve unrelated staged, unstaged, and untracked changes.
- Prefer an observable end-to-end path over speculative infrastructure.
- Do not add packages, schema fields, or abstractions without a current
  requirement.
- Review schema constraints and migration impact before generating migrations.
- Keep LLM and other external calls outside database transactions.
- Do not commit or push unless explicitly requested.

## Agent rules

- Keep `docs/v1/03-agent-llm-contract.md` synchronized with every change to the
  Agent's context, action contract, validation boundary, tools, loop limits, or
  persistence flow.
- Use bounded Agent loops with explicit stop conditions.
- The LLM may interpret input, choose tools, ask questions, and propose changes.
- Backend tools validate every state transition before persistence.
- PostgreSQL and tool results are authoritative over model claims.
- Do not expose generic database-write tools to the Agent.
- Use deterministic mock models in normal tests; do not consume paid API credits.

## Verification and learning

- Follow the nearest scoped `AGENTS.md` for test-first and learning workflow.
- Provide the relevant verification commands that are actually defined by the
  affected package.
- Run verification only when the user explicitly authorizes it, and report what
  was and was not run.
- Verify the happy path and one important failure path proportionally to the
  change.
- Explain the final data flow, the main invariant, and one prevented failure.
- Ask one short conceptual question before another slice only when the current
  slice introduced a meaningful concept.
