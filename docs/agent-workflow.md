# Personal AI Software Development Workflow

This document defines my default workflow for software development with Pi. It
is stored in this repository but is not specific to one product or architecture;
it can be adapted to the conventions of another project.

The current project's `AGENTS.md`, canonical documents, and safety rules always
take precedence. Skills strengthen the workflow but do not override project
boundaries or authorization requirements.

Use English by default for code, identifiers, comments, technical documents,
Feature Briefs, and Handoffs. End-user language follows the product requirement,
and conversation language may follow the user.

## 1. Context and document layers

| Information source | Question it answers | Lifetime |
| --- | --- | --- |
| `AGENTS.md` | How should work be performed in this project? | Long-lived |
| Canonical documents | How should the system behave and evolve? | Long-lived |
| Feature Brief | What does a large feature require and how is it sliced? | Feature lifetime |
| Root/Area Handoff | Where is active work now and what comes next? | Replaceable snapshot |
| Code/Schema/Contracts/Tests | What is implemented and proven now? | Evolves with code |
| Pi Session | What is being explored in the current conversation? | Disposable |

The repository is long-term memory; a Session is a temporary workbench. If
losing the Session could cause a future implementation error, the information
must have another owner.

### Common authoritative owners

- Product behavior, boundaries, and acceptance criteria: product scope.
- System, Agent, and module responsibilities: architecture or contract docs.
- Approved implementation order: roadmap.
- Hard-to-reverse decisions with real trade-offs: ADRs.
- Exact API payloads: shared contracts and runtime validation.
- Database structure: schema and migrations.
- Behavioral evidence: tests.
- Current progress: handoff or issue tracker.

Canonical documents are not a system encyclopedia. Each class of durable
information should have one owner. Conflicts between documentation, code, and
tests must be surfaced rather than resolved silently.

## 2. Classifying a change

### Small change

A Feature Brief is normally unnecessary when most of these are true:

- the change can finish in one Session;
- it has few decisions and failure paths;
- it delivers one clear observable behavior;
- losing the conversation would not lose an important decision.

### Large change

Create a Feature Brief when any material condition applies:

- work spans sessions, applications, or teams;
- frontend, backend, Agent, or database behavior must coordinate;
- the feature contains multiple states, failure paths, or vertical slices;
- reasonable alternatives would materially change architecture, data, or risk;
- context loss could cause repeated decisions, scope drift, or incorrect work.

Size is determined by decision density and the cost of forgetting, not lines of
code.

## 3. Small-change workflow

```text
Inspect
-> /skill:grilling
-> confirm shared understanding
-> /skill:tdd when appropriate
-> verify
-> update durable docs or Handoff only when needed
```

1. Read relevant instructions, Handoff, code, tests, and Git status.
2. Use `grilling` only for questions that materially change behavior, scope,
   data, or risk.
3. Confirm observable behavior, failure behavior, and non-goals.
4. Use TDD for business rules, state transitions, transactions, security
   constraints, public contracts, and bug regressions.
5. Do not force TDD for ordinary wiring, declarations, simple mappings, or
   behavior-preserving structural work.
6. Review the final diff and run only the checks authorized by the project and
   user.

A small change does not need a Feature Brief, but it still updates the relevant
canonical owner when it changes a durable rule.

## 4. Large-change workflow

```text
Inspect existing truth
-> /skill:grilling
-> confirm behavior and technical direction
-> update changed canonical truths
-> create one shared Feature Brief
-> split into observable vertical slices
-> select one slice
-> /skill:tdd
-> verify
-> update Handoff
-> stop before the next slice
```

Frontend, backend, and Agent work serving one user-visible capability normally
share one Feature Brief. Do not let technical layers define separate versions
of product behavior or a public contract. Separate Area Handoffs are useful only
when multiple independent workstreams are active.

## 5. Feature Brief structure

A Feature Brief is a large feature's requirement and temporary implementation
map. It is not a canonical document, detailed coding plan, or progress log.

Use the following information checklist. Keep each section minimum-sufficient;
do not expand a section merely to complete the template.

```markdown
# Feature: <name>

Status: Draft | Approved | Completed

Canonical references:
- <relevant canonical documents>

## 1. Goal

The current problem, intended outcome, and user value.

## 2. Observable behaviors

- Behavior visible to a user or caller.

## 3. Invariants

- Rules that must hold on both success and failure.

## 4. High-level data flow

Client -> Delivery Layer -> Application Workflow
-> External Capability -> Validation -> Persistence -> Response

## 5. Ownership and boundaries

- Client: ...
- Backend: ...
- External capability: may ..., must not ...
- System of record: ...

## 6. Technical direction

- Confirmed cross-slice decisions that implementation sessions must not reopen.

## 7. Failure behavior

- Observable outcomes and data state for material failures.

## 8. Non-goals

- Work explicitly excluded from this feature.

## 9. Test strategy

- Critical behavior, invariants, and candidate public seams to prove.

## 10. Vertical slices

### Slice 1: <observable capability>

Outcome:
- The capability added when this slice finishes.

Boundary:
- What this slice includes and excludes.

Done when:
- An observable, verifiable completion condition.

Dependencies:
- Include only when needed.
```

### Feature Brief rules

- Technical direction captures data flow, ownership, public contracts,
  transaction boundaries, and external-call boundaries. It does not prescribe
  private functions, file-by-file steps, mocks, or query details.
- Test strategy states what must be proven and suggests a test layer. Confirm
  the actual seam immediately before TDD begins.
- Slice by observable capability, not by database, service, controller, and
  frontend layers.
- Keep the Brief in `Draft` while a blocking decision is unresolved. Only the
  decision owner can approve it.
- Move durable outcomes to canonical docs, contracts, tests, or ADRs. Do not
  leave them solely in a completed Brief.
- Keep current progress in Handoff; do not append daily history to the Brief.

## 6. Handoff structure

A Handoff is a replaceable snapshot of active state. It is not a history log and
must not introduce durable product or architecture decisions.

Use one Root Handoff when one active workstream can be summarized clearly. It
contains:

- current priority;
- the minimum system status needed to continue;
- active boundary;
- exactly one next slice;
- verification gaps and blockers;
- links to canonical docs and any active Feature Brief.

Add Area Handoffs only when independent workstreams are active and a single
Handoff is no longer sufficient. Each Area Handoff contains its current scope,
stable dependencies, next slice, verification state, risks, and references.

Replace stale content instead of appending a timeline. Git preserves history,
the Feature Brief preserves the feature map, and Handoff preserves only the
minimum state needed by the next Session.

## 7. TDD execution

TDD does not mean unit-testing every function. It is a red-green loop at the
lowest-cost public seam that sufficiently proves the behavior.

```text
extract behavior from the confirmed conversation or Feature Brief
-> agent proposes observable testing behaviors
-> agent proposes a public test seam
-> user confirms the seam
-> write one test
-> run it and observe the expected failure (red)
-> write the minimum implementation
-> rerun and observe success (green)
-> repeat only when another behavior belongs to the same slice
-> review and run the authorized related checks
```

The user confirms expected system behavior and grants the permissions required
by the current project. The agent proposes tests and the seam. Do not write a
test before seam confirmation, change production code before observing the
expected red, or implement a later slice speculatively.

Typical invocation:

```text
/skill:tdd

Use the confirmed conversation or referenced Feature Brief. Implement only
[named slice]. First propose:
1. observable testing behaviors;
2. the lowest-cost sufficient public seam;
3. the first minimal test.

Wait for confirmation. You may modify [scope] and run [explicit commands].
```

## 8. Architecture maintenance

Architecture review is independent of normal feature delivery:

```text
/skill:improve-codebase-architecture
-> read-only survey
-> choose one evidence-backed candidate
-> grill its boundary
-> implement and verify it as a separate authorized slice
```

Do not run it after every feature or mix opportunistic refactoring into an
active TDD slice. Add an abstraction only when current change pressure,
observed friction, or test difficulty demonstrates its value.

## 9. Pi Skills

Use explicit commands for predictable activation:

```text
/skill:grilling
/skill:tdd
/skill:improve-codebase-architecture
```

Matt Pocock's `grill-me` is a wrapper around `grilling`. Its upstream version
calls a `Skill` tool that Pi does not provide, so invoke `/skill:grilling`
directly in Pi.

The upstream `tdd` skill may refer to `codebase-design` when the public seam is
unclear. `improve-codebase-architecture` also refers to `codebase-design` and
`domain-modeling` through another harness's `Skill` tool. Until the local copies
are adapted for Pi, do not assume those internal calls compose automatically;
invoke the next phase explicitly or adjust the local skill first.

## 10. Completion report

A slice is complete only when the final report states:

- what changed and why;
- the observable data flow and main invariant;
- one important failure prevented;
- the tests and checks actually run;
- what was not verified;
- remaining risks or decisions;
- whether the final diff contains unrelated work;
- whether required canonical docs and Handoff were synchronized.
