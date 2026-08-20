# 05: Implementation Roadmap

## 1. Goal

Implement V1 incrementally.

This roadmap and `product-scope.md` define the current Event-only V1. Other technical documents may still contain details from the earlier Email scope. Those details are not V1 requirements and should be removed or revised only when the related Event slice begins.

Do not build the whole system at once.

Each phase should produce a working result before moving to the next one.

---

## 2. Phase 0: Project Bootstrap

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

## 3. Phase 1: Persistent Interaction Timeline

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

## 4. Phase 2: Structured Event Extraction

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
Event Extractor
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

This phase is a fixed workflow, not an Agent loop.

---

## 5. Phase 3: Event Human-in-the-Loop

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

## 6. Phase 4: Bounded Event Agent

Add:

```text
LangGraph
Focused Event clarification
Explicit stop conditions
```

Flow:

```text
Incomplete Event Draft
        ↓
Bounded Event Agent
        ↓
Ask one focused question or show the Event Card
```

The Agent may interpret the user's answer and choose between a small set of Event tools. Backend handlers still validate every state transition and database write.

Define the exact tools and limits only when this phase begins. At minimum, the loop must have a model-call limit, a tool-call limit, a time limit, and a deterministic fallback.

### Acceptance Criteria

```text
Missing required Event information
→ Ask one focused question
→ User answers
→ Update the Event Draft
→ Show the Event Card
```

### Learning Focus

- LangGraph state and routing
- bounded Agent loops
- backend-owned tools
- deterministic fallbacks

---

## 7. Phase 5: Hardening

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

## 8. Phase 6: V1 Completion Review

Verify the complete flow:

```text
User Message
→ Persist
→ Event Agent
→ Event Card
→ Edit
→ Confirm
→ Event
→ Refresh
→ Full interaction replay
```

Also verify:

```text
No-event message
Event Reject
Missing Event fields
Invalid Event time
LLM failure
Duplicate Confirm
Timezone handling
```

---

## 9. Development Method

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

## 10. V1 Implementation Order

```text
Phase 0
Project Bootstrap
      ↓
Phase 1
Persistent Timeline
      ↓
Phase 2
Structured Event Extraction
      ↓
Phase 3
Event HITL
      ↓
Phase 4
Bounded Event Agent
      ↓
Phase 5
Hardening
      ↓
Phase 6
V1 Review
```

Do not move to Memory, RAG, or Multi-Agent development until this vertical slice is stable.
