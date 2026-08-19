# 05 — Implementation Roadmap

## 1. Goal

Implement V1 incrementally.

Do not build the whole system at once.

Each phase should produce a working result before moving to the next one.

---

## 2. Phase 0 — Project Bootstrap

Set up:

```text
Next.js
NestJS
PostgreSQL
Drizzle
Environment configuration
```

Acceptance criteria:

```text
Next.js starts
NestJS starts
Frontend can call backend
Backend can connect to PostgreSQL
Drizzle migration works
```

Do not add OpenAI yet.

---

## 3. Phase 1 — Persistent Interaction Timeline

Build:

```text
users
messages

POST /messages
GET /messages

Basic timeline UI
```

Use a temporary deterministic assistant response.

Example:

```text
User:
hello

Assistant:
received
```

Both messages must persist and survive page refresh.

### Learning Focus

- NestJS modules/controllers/services
- Zod request validation
- Drizzle basics
- PostgreSQL migrations
- Next.js → NestJS API calls

### Acceptance Criteria

```text
Submit text
→ Persist
→ Render
→ Refresh
→ Same history appears
```

---

## 4. Phase 2 — Event Agent Extraction

Add:

```text
LangChain
@langchain/openai
OpenAI
Zod structured output
```

Implement:

```text
User Message
      ↓
Event Agent
      ↓
Event or Normal Text
```

If Event:

```text
Create Event Draft
→ Persist EVENT_CARD
→ Render Event Card
```

If no Event:

```text
Persist Assistant TEXT
→ Render response
```

### Acceptance Criteria

Example:

```text
"Meeting tomorrow at 3 PM"
→ Event Card
```

Example:

```text
"The weather is nice today"
→ Normal Assistant Message
```

The Event Card must survive refresh.

---

## 5. Phase 3 — Event Human-in-the-Loop

Add:

```text
event_drafts
events
```

Implement:

```text
Edit
Confirm
Reject
```

### Edit

```text
Event Card
→ User edits fields
→ Save Draft
→ Persist EVENT_EDIT
```

### Confirm

```text
Validate Draft
→ Create Event
→ Mark Draft CONFIRMED
→ Persist EVENT_CONFIRM
```

### Reject

```text
Mark Draft REJECTED
→ Persist EVENT_REJECT
→ No Event created
```

Also implement timezone validation and normalization.

### Learning Focus

- state transitions
- transactions
- draft vs final state
- validation
- idempotency
- timezone handling

---

## 6. Phase 4 — Email Agent

Add:

```text
email_drafts
Email Agent
Email Card
```

Flow:

```text
Confirmed Event
      ↓
Create Email Reminder
      ↓
Email Agent
      ↓
Email Draft
      ↓
Email Card
```

Implement:

```text
Edit
Reject
```

Do not send real email yet.

### Acceptance Criteria

```text
Confirmed Event
→ Generate Email Card
→ Edit Email
→ Refresh
→ Email Card and edits remain
```

---

## 7. Phase 5 — Email Delivery

Choose an email provider.

Implement:

```text
Email Confirm
Real email send
emails table
Delivery result
Failure handling
```

Flow:

```text
User Confirm
      ↓
Validate Email Draft
      ↓
Send Email
      ↓
Persist result
```

If sending succeeds:

```text
Mark Draft SENT
→ Persist EMAIL_CONFIRM
```

If sending fails:

```text
Do not mark SENT
→ Return EMAIL_DELIVERY_FAILED
```

### Learning Focus

- external APIs
- side effects
- secrets
- failure handling
- duplicate-send protection

---

## 8. Phase 6 — Hardening

Only after the full workflow works.

Add:

```text
Pagination
Integration tests
LLM test cases
Logging
Timeout handling
Improved idempotency
Error mapping
Configuration validation
```

Do not introduce new product features in this phase.

---

## 9. Phase 7 — V1 Completion Review

Verify the complete flow:

```text
User Message
→ Persist
→ Event Agent
→ Event Card
→ Edit
→ Confirm
→ Event
→ Create Email Reminder
→ Email Card
→ Edit
→ Confirm
→ Send Email
→ Refresh
→ Full interaction replay
```

Also verify:

```text
No-event message
Event Reject
Email Reject
Missing Event fields
Invalid Event time
LLM failure
Email failure
Duplicate Confirm
Timezone handling
```

---

## 10. Development Method

For each phase, work one small step at a time.

Recommended workflow:

```text
Understand one requirement
      ↓
Design one small part
      ↓
Implement it
      ↓
Run it
      ↓
Observe result
      ↓
Debug if necessary
      ↓
Continue
```

When using AI during implementation, prefer prompts such as:

```text
"We are implementing Phase 1.
Explain how to design the messages table first.
Do not continue to the API yet."
```

Then:

```text
"Now give me the complete code for this schema only,
and explain the important decisions."
```

The goal is to understand and implement each layer yourself rather than generate the entire project at once.

---

## 11. V1 Implementation Order

```text
Phase 0
Project Bootstrap
      ↓
Phase 1
Persistent Timeline
      ↓
Phase 2
Event Agent
      ↓
Phase 3
Event HITL
      ↓
Phase 4
Email Agent
      ↓
Phase 5
Email Delivery
      ↓
Phase 6
Hardening
      ↓
Phase 7
V1 Review
```

Do not move to Memory, RAG, or Multi-Agent development until this vertical slice is stable.
