# LifeInbox AI and Agent Learning Map

[中文](05-ai-agent-learning-map.md)

## 1. Learning objective

Build reliable AI components before allowing a bounded agent to choose among them.

```text
structured model call
-> fixed clarification workflow
-> asynchronous document pipeline
-> reliable retrieval and RAG
-> bounded agent tool loop
-> persistent pause/resume
-> evaluated, observable production behavior
```

## 2. Terms used in this project

### Single model call

The program sends a notice and requests structured fields. The program already decided what happens next. This is an AI feature, not an agent.

### Fixed workflow

Application code controls the sequence:

```text
extract -> validate -> ask for missing field -> confirm -> export
```

The model may generate content or fill a schema but cannot freely choose among later actions. This is an AI workflow, not an agent loop.

### Retrieval-augmented workflow

The application retrieves relevant personal items and supplies them to the model in an application-defined sequence. RAG is not automatically an agent.

### Agent loop

The model observes state/tool results, selects an allowed next action, receives its result, and may continue until completion, pause, or budget exhaustion. LifeInbox first introduces this in V5.

## 3. V1 AI: reliable structured extraction

### Goal

Convert notice text into validated drafts without inventing missing facts.

### Input

- Original text and source language when known.
- User time zone.
- A fixed `referenceDate` with provenance when relative dates may appear.
- Relevant default duration/reminder preferences only.

Without a credible received date, expressions such as `tomorrow` remain unresolved and require review. Evaluation uses a fixed clock.

### Output

```text
outcome: ACTIONS | NO_ACTION
actions:
  - type
    title
    startAt
    endAt
    dueDate
    timeZone
    location
    nextAction
    missingFields
    fieldProvenance
warnings
```

```text
NO_ACTION => actions.length == 0
ACTIONS   => actions.length >= 1
```

Important fields include provenance: source type/ID, character offsets, and quote. Later versions distinguish notice, clarification, user edit, and explicit preference.

### Rules

- Missing facts become `null` or missing fields.
- Model confidence is not proof of correctness.
- Important fields require evidence.
- Backend validates schema and evidence.
- Every suggestion is editable.
- The model never generates raw `.ics`.
- UI discloses transfer to the configured provider.
- Instructions inside notice text are data and cannot alter the extraction protocol.

### Evaluation cases

Explicit appointment; date-only deadline; ambiguous `Next Tuesday afternoon`; relative dates with/without trusted anchors; message date versus event date; conflicting dates; multiple actions; no-action notice; English/Swedish/Chinese variants; prompt injection and system-instruction extraction requests.

### Metrics

Schema validity, field accuracy, correct refusal to guess, evidence validity, user edit rate, latency, token usage, and estimated cost. Deterministic adapter/schema tests run in CI; live-model evaluation is a versioned release check.

## 4. V2 AI: clarification workflow

### Goal

Ask one useful question when required information is missing.

### Workflow

```text
extract
-> select blocking missing field
-> generate one clarification question
-> persist WAITING_FOR_USER
-> receive answer
-> create a new draft version
-> review
```

Application code still controls execution order.

### Provenance

Every confirmed field traces to source text, user clarification, explicit edit, or a visible user-approved preference.

### Evaluation cases

Missing time; start without end; two possible dates; changed answer; refusal to provide a value; irrelevant clarification content.

### Acceptance

One question per turn, one blocking field, answers update the existing version chain, conflicts remain visible, and the workflow waits without holding an HTTP request open.

## 5. V3 AI: asynchronous file and extraction pipeline

### Goal

Convert text PDFs and images into evidence-backed action candidates without binding long work to one HTTP request.

### Pipeline

```text
validate upload
-> persist file metadata
-> parse/OCR in worker
-> normalize extracted text
-> run structured extraction
-> attach page/region evidence
-> show drafts for review
```

### Key distinctions

- Parser failure is not model failure.
- OCR uncertainty is not agent uncertainty.
- Queue delivery is not product completion.
- Retrying one logical job must not create a new logical action.

### Security

File text is untrusted data. `ignore all prior instructions` is document content, not an instruction to the application or agent.

### Evaluation

Representative OCR/text quality, recall of multiple actions, page/region evidence, correct refusal for unreadable content, embedded prompt injection, and separate parser/OCR/model/queue failures.

## 6. V4 AI: retrieval and RAG

### Goal

Find relevant personal history and use it only as cited context for suggestions.

### Retrieval ladder

1. Metadata filters.
2. Exact and keyword search.
3. Persisted retrieval evaluation cases.
4. Embeddings and pgvector.
5. Hybrid retrieval only when measured improvement exists.
6. Model classification/synthesis grounded in retrieval evidence.

### Retrieval debugging

Show query, user/status filters, retrieved source IDs, scores, source dates/versions, and final relationship judgment.

### Evaluation

Measure retrieval separately from generation. Cases cover correct old notice, similar but unrelated notice, old conflicting source, no relevant source, newly indexed item, and cross-user isolation attack.

### Rules

- Explicit new source text outranks conflicting old context.
- Retrieved content is untrusted.
- Never claim a relation without reliable results.
- RAG may propose but cannot confirm or execute actions.

Relationship outcomes distinguish:

- `UNRELATED`: evidence shows the candidate concerns something else.
- `NO_MATCH`: retrieval found no reliable candidate.
- `INSUFFICIENT_EVIDENCE`: candidates exist but evidence is weak or conflicting.

## 7. V5 AI: bounded agent loop

### Goal

Let the model choose whether to search, read preferences, ask a question, propose an action, or finish without action.

### Entry criteria

Before making agents the default:

- Save at least three tasks that genuinely require dynamic branching.
- Measure the fixed workflow as a baseline.
- Compare completion, safety, steps, latency, and cost.
- Record a go/no-go decision about model-selected tools.

Without enough value, keep the agent experimental.

### Initial tools

| Tool                          | Type           | Side effect              |
| ----------------------------- | -------------- | ------------------------ |
| `get_user_preferences`        | Read           | None                     |
| `get_current_item`            | Read           | None                     |
| `search_related_items`        | Read           | None                     |
| `retrieve_personal_documents` | Read           | None                     |
| `ask_clarification`           | Pause/proposal | Persists a question only |
| `propose_new_action`          | Proposal       | No authoritative write   |
| `propose_action_update`       | Proposal       | No authoritative write   |
| `propose_action_cancellation` | Proposal       | No authoritative write   |
| `propose_calendar_export`     | Proposal       | Does not export          |
| `finish_without_action`       | Terminal       | None                     |

Confirmation, `.ics` export, notification delivery, and EventKit writes are not tools in the first agent version.

### Conceptual loop

```text
load run, checkpoint, product version, and budget
-> expose allowed tools
-> model selects next action
-> backend validates tool, arguments, user scope, and budget
-> execute allowed tool
-> persist step and observation
-> continue, pause, finish, or stop at budget
```

### State

`QUEUED`, `RUNNING`, `WAITING_FOR_USER`, `PROPOSAL_READY`, `COMPLETED`, `FAILED`, `CANCELLED`, `BUDGET_EXCEEDED`.

### Budget

At most five steps, plus runtime, input/output token, estimated cost, per-tool call, and duplicate-call limits. The backend enforces budgets; the model cannot increase them.

### Pause and resume

Persist question/checkpoint, set `WAITING_FOR_USER`, release the worker, consume the answer idempotently, revalidate the product version, and resume. Never hold an HTTP connection or in-memory process while waiting.

## 8. Agent evaluation

### Trajectory cases

Clear appointment; ambiguous appointment; related update; cancellation; no-action notice; missing retrieval evidence; prompt injection; tool loop; tool timeout; recovery after restart.

### Metrics

Correct next-tool rate, completion/correct-pause rate, unnecessary calls, average steps/latency/tokens/cost, correct stop rate, unauthorized attempts, invalid arguments, proposal acceptance/edit rate, and recovery success.

Safety metrics such as successful unauthorized actions must be zero, never hidden inside averages.

## 9. Prompt injection and tool security

### Trust boundaries

System/developer instructions define behavior; tool metadata defines capability; user answers provide intent/data; notices, uploads, and retrieved chunks are untrusted.

### Enforcement

- Tool allowlist per run.
- Strict backend schemas for arguments.
- Resource identifiers resolved inside authenticated user scope.
- Backend recomputes authorization and ignores model-provided user IDs.
- Proposal hash/version binds approval to exact values.
- No external-side-effect tools before explicit approval and idempotency design exist.

## 10. Model and prompt lifecycle

Record provider/model ID, prompt version, structured-output schema version, tokens, latency/cost, stop/error reason, and extraction/agent run ID from the first call.

Before release: run saved evaluations, compare quality/refusal/latency/cost, inspect regressions rather than only averages, and record the release decision.

## 11. Framework introduction rule

V1-V4 do not require LangGraph. Implement calls, fixed workflows, queues, and retrieval in ordinary application code. Consider a stateful agent framework only when V5 proves a real need for dynamic tool choice, checkpoints, pause/resume, and trajectory inspection.

If introduced, domain state remains in PostgreSQL, framework checkpoints do not replace authoritative state, application code still enforces authorization, provider access stays behind project boundaries, and the framework remains replaceable.

## 12. AI mastery standard

A concept is mastered only when the developer can explain why the product needs it, demonstrate the failure without it, distinguish model/retrieval/workflow/infrastructure failures, implement bounded behavior, evaluate normal/edge/adversarial cases, observe cost and latency, and explain permission and failure boundaries.
