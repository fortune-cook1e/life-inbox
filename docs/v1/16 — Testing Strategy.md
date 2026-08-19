# 16 — Testing Strategy

## 1. Goal

V1 testing should focus on:

- business rules
- persistence
- state transitions
- API behavior
- interaction replay
- LLM integration boundaries

The goal is not to test framework internals.

---

## 2. Testing Layers

Use three main levels:

```text
Unit Tests
Integration Tests
End-to-End Tests
```

---

## 3. Unit Tests

Use unit tests for deterministic application logic.

Examples:

```text
Event validation
Draft state transitions
Time validation
Error mapping
```

Example rules:

```text
PENDING → CONFIRMED
PENDING → REJECTED
```

and:

```text
end_at > start_at
```

These tests should not call OpenAI or PostgreSQL.

---

## 4. Integration Tests

Integration tests should verify:

```text
NestJS
+
PostgreSQL
```

Important flows:

```text
Create Message
Create Event Draft
Edit Event Draft
Confirm Event
Reject Event
Create Email Draft
Edit Email Draft
Reject Email Draft
```

Tests should verify both:

```text
API response
+
Database state
```

---

## 5. Mock the LLM

Most tests should not call OpenAI.

Instead, mock:

```text
EventAgentService
EmailAgentService
```

Example mocked Event result:

```json
{
  "kind": "event",
  "event": {
    "title": "Project Meeting",
    "startAt": "2026-08-20T15:00:00",
    "endAt": null,
    "timezone": "Europe/Stockholm",
    "location": "Ericsson",
    "description": null
  }
}
```

This allows application logic to be tested deterministically.

---

## 6. LLM Evaluation Tests

LLM behavior should be tested separately from business logic.

Maintain a small evaluation set.

Examples:

```text
Meeting tomorrow at 3 PM.
```

```text
Remind me to submit my assignment Friday at 10 AM.
```

```text
Meeting Friday at 3 PM London time.
```

```text
I had a good day today.
```

Evaluate whether the model returns the expected structured shape and reasonable interpretation.

These tests may call the real model manually or in a separate evaluation workflow.

---

## 7. Event Tests

At minimum test:

```text
Event Draft creation
Event edit
Event confirmation
Event rejection
Missing title
Missing start_at
Missing timezone
Invalid end_at
Duplicate confirmation
Confirmed Draft cannot be edited
Rejected Draft cannot be confirmed
```

---

## 8. Email Tests

At minimum test:

```text
Email Draft generation
Email edit
Email rejection
Email confirmation
Missing recipient
Missing subject
Missing body
Duplicate send
Provider failure
Rejected Draft cannot be sent
```

The email provider should usually be mocked in automated tests.

---

## 9. Replay Tests

Create a history such as:

```text
TEXT
EVENT_CARD
EVENT_EDIT
EVENT_CONFIRM
EMAIL_REQUEST
EMAIL_CARD
EMAIL_EDIT
EMAIL_CONFIRM
```

Then load:

```http
GET /messages
```

Verify that the complete interaction sequence can be reconstructed.

This is one of the most important V1 tests.

---

## 10. End-to-End Test

At least one E2E scenario should cover:

```text
Submit User Message
→ Event Card
→ Edit Event
→ Confirm Event
→ Create Email Reminder
→ Edit Email
→ Confirm Email
→ Reload Page
→ Full History Still Exists
```

The real OpenAI API does not need to be involved in this test.

---

## 11. Failure Tests

Explicitly test:

```text
Database failure
LLM failure
Invalid LLM output
Email provider failure
Invalid state transition
Duplicate action
```

The main question is:

> Does the application fail without corrupting state?

---

## 12. Testing Principle

Prefer:

```text
Many deterministic business tests
+
Few real LLM evaluation tests
```

instead of:

```text
Every test
→ real OpenAI request
```

The LLM is only one dependency of the system.

Most V1 correctness should remain testable without it.
