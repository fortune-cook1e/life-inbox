# 23 — Development Workflow

## 1. Goal

Use the project primarily as a learning vehicle.

The implementation process should optimize for:

```text
Understanding
Correctness
Incremental progress
```

rather than maximum coding speed.

---

## 2. Work One Step at a Time

Do not implement an entire phase in one pass.

Preferred workflow:

```text
Understand requirement
      ↓
Design one small piece
      ↓
Implement
      ↓
Run
      ↓
Inspect result
      ↓
Debug
      ↓
Continue
```

---

## 3. How to Use AI During Development

A good request is:

```text
We are implementing Phase 1.

Explain how the messages table should be implemented with Drizzle.
Do not continue to the API yet.
```

After understanding the design:

```text
Now give me the complete code for this schema only.
Explain the important parts.
```

Then implement and run it locally.

---

## 4. Recommended Step Size

A single step should usually contain one clear goal.

Examples:

```text
Set up Drizzle connection

Create users schema

Create messages schema

Generate migration

Create MessagesModule

Implement POST /messages

Implement GET /messages

Render timeline
```

Avoid combining all of them into one implementation request.

---

## 5. Bring Real Results Back

After implementing a step, provide actual results when continuing.

Useful inputs include:

```text
Current code
Compiler errors
Runtime errors
Migration SQL
Database output
API response
Logs
Unexpected UI behavior
```

Then debug the real implementation instead of designing hypothetically.

---

## 6. Understand Generated Code

When complete code is provided, do not treat it as a black box.

For important code, understand:

```text
Why this abstraction exists
What data flows through it
What framework feature is being used
What would break if it were removed
```

Especially for:

```text
NestJS dependency injection
Drizzle schema definitions
Zod schemas
Transactions
LangChain structured output
```

---

## 7. Database Workflow

For every schema change:

```text
Modify Drizzle schema
      ↓
Generate migration
      ↓
Read migration SQL
      ↓
Apply migration
      ↓
Inspect PostgreSQL
```

Do not skip reading the generated SQL.

---

## 8. API Workflow

For each endpoint:

```text
Define request contract
      ↓
Validate input
      ↓
Implement service logic
      ↓
Persist state
      ↓
Return application DTO
      ↓
Test with real request
```

Build backend behavior before polishing frontend UX.

---

## 9. Agent Workflow

When implementing an Agent:

```text
Define responsibility
      ↓
Define Zod output schema
      ↓
Write prompt
      ↓
Test representative inputs
      ↓
Integrate with application service
```

Do not start by writing a large prompt.

Define the structured contract first.

---

## 10. Debugging Order

When something fails, identify the failing boundary.

For example:

```text
Frontend
↓
HTTP
↓
NestJS
↓
Application logic
↓
Database / LLM / Email provider
```

Check one boundary at a time.

Avoid changing several unrelated parts simultaneously.

---

## 11. Commit Strategy

Prefer small commits with one clear purpose.

Examples:

```text
feat: add messages table

feat: add message submission endpoint

feat: persist event draft

feat: add event confirmation

fix: prevent duplicate event confirmation
```

This makes the project history useful for learning and debugging.

---

## 12. Phase Completion

Do not move to the next phase because the code "mostly works."

Complete the phase acceptance criteria first.

Example:

```text
Phase 1 is not complete

if messages render

but disappear after refresh.
```

Each phase should leave the application in a working state.

---

## 13. Avoid Premature Refactoring

During early implementation:

```text
Correct duplication
>
Wrong abstraction
```

Do not immediately create generic abstractions for:

```text
Cards
Drafts
Agents
Repositories
Providers
```

Wait until repeated patterns actually appear.

Then refactor based on real code.

---

## 14. Learning Notes

When a useful backend or Agent concept appears, record it briefly.

Examples:

```text
Why transactions are needed

Why Draft and Event are separate

Why LLM output requires runtime validation

Why external side effects are difficult to make atomic

Why timezone needs an IANA identifier
```

The goal is to connect implementation decisions with general engineering concepts.

---

## 15. Core Principle

> **Use AI as a technical mentor and implementation assistant, not as a replacement for doing the engineering yourself.**

The preferred cycle is:

```text
Understand
→ Implement
→ Observe
→ Debug
→ Reflect
→ Continue
```

With this document, the initial V1 documentation set is complete.
