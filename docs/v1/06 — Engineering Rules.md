# 06 — Engineering Rules

## 1. Persist User Input First

Always persist the user's message before calling the LLM.

```text
User Message
→ Database
→ LLM
```

If the LLM fails, the original input is still preserved.

---

## 2. Treat LLM Output as Untrusted Input

LLM output must be validated before entering application logic.

```text
LLM
→ Zod
→ Application Logic
```

Never write raw model output directly into final business tables.

---

## 3. Human Confirmation Before Side Effects

Real actions require explicit confirmation.

```text
Event creation
→ User Confirm

Email sending
→ User Confirm
```

The LLM may propose actions, but it cannot execute them directly.

---

## 4. Backend Validation Is Authoritative

Frontend validation improves UX.

NestJS must still validate:

- required fields
- Event time
- timezone
- state transitions

Do not trust frontend validation as the final rule.

---

## 5. Keep Historical State Append-Only

Do not overwrite previous interaction records.

For example:

```text
EVENT_CARD
15:00

↓

EVENT_EDIT
15:00 → 16:00
```

The original Card remains part of history.

---

## 6. Separate Draft State From Final State

Use:

```text
Event Draft
→ Event

Email Draft
→ Email
```

Drafts are editable.

Final entities represent confirmed results.

---

## 7. Keep Deterministic Logic Out of the LLM

Application code should handle:

- required-field checks
- timezone validation
- time comparison
- state transitions
- database IDs
- transactions
- authorization

The LLM should focus on semantic interpretation and generation.

---

## 8. Protect Against Duplicate Actions

Actions such as:

```text
Confirm
Reject
Send
```

must not produce duplicate side effects.

Example:

```text
double-click Confirm
```

must not create two Events.

---

## 9. Use Transactions When State Changes Belong Together

For Event confirmation:

```text
Create Event
+
Update Draft status
+
Persist EVENT_CONFIRM
```

should be treated as one logical operation.

If one critical database step fails, the operation should not leave partial state.

---

## 10. Keep Secrets Server-Side

Examples:

```text
OPENAI_API_KEY
DATABASE_URL
EMAIL_PROVIDER_API_KEY
```

These values must never be exposed to the Next.js browser bundle.

---

## 11. Keep Provider Details Behind the Backend

The frontend should not depend on:

- raw OpenAI responses
- LangChain objects
- Drizzle internals
- email provider response formats

NestJS should expose stable application-level DTOs.

---

## 12. Model Choice Is Configuration

Use configuration such as:

```text
OPENAI_MODEL
```

instead of hard-coding a specific model throughout the application.

---

## 13. Keep Prompts Focused

Use separate prompts for separate responsibilities.

Examples:

```text
event-extraction:v1
email-generation:v1
```

Avoid one large global prompt controlling every feature.

Prompts should be version controlled and easy to test.

---

## 14. Avoid Premature Infrastructure

Do not add technologies without a concrete requirement.

V1 does not need:

```text
Redis
BullMQ
Kafka
Microservices
Vector Database
LangGraph
WebSockets
```

Introduce them only when the product creates a real need.

---

## 15. Prefer Correctness Before Real-Time UX

Normal HTTP request/response is enough initially.

Do not prioritize streaming before:

```text
Persistence
Replay
Validation
HITL
Error handling
```

work reliably.

---

## 16. Inspect Database Migrations

When changing the Drizzle schema:

```text
Change schema
→ Generate migration
→ Read generated SQL
→ Apply migration
→ Verify database
```

Understanding the PostgreSQL produced by Drizzle is part of the learning goal.

---

## 17. Keep State Categories Clear

Do not mix these three concepts:

### UI State

```text
editing
loading
selected input
```

### Application State

```text
current Event Draft
current Email Draft
```

### Historical State

```text
Event Card
Event Edit
Event Confirm
```

Each has a different purpose.

---

## 18. External Failures Must Be Explicit

External systems can fail.

Examples:

```text
OpenAI request failure
Email provider failure
Database failure
```

The application must not pretend that an action succeeded when it did not.

---

## 19. Business Logic Should Be Testable Without the Real LLM

Core application flows should eventually be testable using mocked Agent results.

For example:

```text
Event Edit
Event Confirm
Event Reject
Email Edit
Timeline Replay
```

should not require a real OpenAI request every time.

---

## 20. Core V1 Rule

The overall engineering principle is:

> **Use the simplest architecture that correctly satisfies the current product requirements.**

Build the smallest reliable version first, then introduce additional complexity only when a real requirement justifies it.
