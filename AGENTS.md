# Collaboration rules

This repository is both a product project and a backend/Agent learning project.

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

- Use bounded Agent loops with explicit stop conditions.
- The LLM may interpret input, choose tools, ask questions, and propose changes.
- Backend tools validate every state transition before persistence.
- PostgreSQL and tool results are authoritative over model claims.
- Do not expose generic database-write tools to the Agent.
- Use deterministic mock models in normal tests; do not consume paid API credits.

## Verification and learning

- Run formatting, lint, typecheck, Vitest, build, and relevant database checks.
- Verify the happy path and one important failure path.
- Explain the final data flow, the main invariant, and one prevented failure.
- Ask the user one short conceptual question before starting another slice.
