# 02 — API Contracts

## 1. Goal

NestJS exposes application-oriented APIs for:

- message submission
- interaction history
- Event editing
- Event confirmation/rejection
- Email Draft generation
- Email editing
- Email confirmation/rejection

Prefer explicit domain actions over generic CRUD.

For example:

```http
POST /event-drafts/:id/confirm
```

instead of:

```http
PATCH /event-drafts/:id
```

with:

```json
{
  "status": "CONFIRMED"
}
```

---

## 2. Message APIs

### Submit Message

```http
POST /messages
```

Request:

```json
{
  "content": "Meeting at Ericsson tomorrow at 3 PM",
  "timezone": "Europe/Stockholm"
}
```

Flow:

```text
Validate request
→ Persist User Message
→ Call Event Agent
```

If an Event is detected:

```text
Create Event Draft
→ Persist EVENT_CARD
→ Return Event Card
```

Otherwise:

```text
Persist Assistant TEXT
→ Return Assistant Message
```

---

### Get Interaction History

```http
GET /messages
```

Purpose:

```text
Restore the persistent assistant timeline.
```

The API returns stored interactions ordered by `created_at`.

---

## 3. Event Draft APIs

### Edit Event Draft

```http
PATCH /event-drafts/:id
```

Example request:

```json
{
  "title": "Project Meeting",
  "startAt": "2026-08-20T16:00:00",
  "endAt": "2026-08-20T17:00:00",
  "timezone": "Europe/Stockholm",
  "location": "Ericsson",
  "description": null
}
```

Backend flow:

```text
Validate input
→ Verify Draft is PENDING
→ Update Draft
→ Persist EVENT_EDIT
→ Return updated Draft
```

---

### Confirm Event Draft

```http
POST /event-drafts/:id/confirm
```

No Event fields need to be sent again.

The backend confirms the current server-side Draft.

Flow:

```text
Load Draft
→ Verify PENDING
→ Validate required fields
→ Validate Event time
→ Create Event
→ Mark Draft CONFIRMED
→ Persist EVENT_CONFIRM
```

Required fields:

```text
title
start_at
timezone
```

---

### Reject Event Draft

```http
POST /event-drafts/:id/reject
```

Flow:

```text
Load Draft
→ Verify PENDING
→ Mark Draft REJECTED
→ Persist EVENT_REJECT
→ Persist Assistant cancellation message
```

No Event is created.

---

## 4. Email Draft APIs

### Create Email Draft

```http
POST /events/:eventId/email-draft
```

Triggered when the user chooses:

```text
Create Email Reminder
```

Flow:

```text
Load confirmed Event
→ Call Email Agent
→ Create Email Draft
→ Persist EMAIL_REQUEST
→ Persist EMAIL_CARD
→ Return Email Draft
```

The Email Agent uses confirmed Event data rather than the original user message.

---

### Edit Email Draft

```http
PATCH /email-drafts/:id
```

Example:

```json
{
  "to": "user@example.com",
  "subject": "Project Meeting Reminder",
  "body": "You have a project meeting tomorrow at 4 PM."
}
```

Flow:

```text
Validate input
→ Verify Draft is PENDING
→ Update Draft
→ Persist EMAIL_EDIT
```

---

### Confirm Email Draft

```http
POST /email-drafts/:id/confirm
```

Flow:

```text
Load Draft
→ Verify PENDING
→ Validate required fields
→ Send Email
→ Persist Email result
→ Mark Draft SENT
→ Persist EMAIL_CONFIRM
```

If sending fails:

```text
Do not mark Draft as SENT
Do not return fake success
```

---

### Reject Email Draft

```http
POST /email-drafts/:id/reject
```

Flow:

```text
Load Draft
→ Verify PENDING
→ Mark Draft REJECTED
→ Persist EMAIL_REJECT
→ Persist Assistant cancellation message
```

No email is sent.

---

## 5. Validation

Zod should validate data entering important application boundaries.

Examples:

```text
HTTP request
→ Zod
→ Application logic
```

and:

```text
LLM structured output
→ Zod
→ Application logic
```

Frontend validation is useful for UX, but NestJS remains authoritative.

---

## 6. State Transition Rules

### Event Draft

Valid:

```text
PENDING → CONFIRMED
PENDING → REJECTED
```

Invalid:

```text
CONFIRMED → REJECTED
REJECTED → CONFIRMED
```

### Email Draft

Valid:

```text
PENDING → SENT
PENDING → REJECTED
```

Invalid:

```text
SENT → REJECTED
REJECTED → SENT
```

Invalid transitions should return an explicit error.

---

## 7. Error Format

Use a consistent application-level error structure.

Example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Event title is required."
  }
}
```

Recommended initial error codes:

```text
VALIDATION_ERROR
NOT_FOUND
INVALID_STATE_TRANSITION
LLM_REQUEST_FAILED
LLM_OUTPUT_INVALID
EMAIL_DELIVERY_FAILED
INTERNAL_ERROR
```

The frontend should use `code` for behavior rather than parsing the human-readable message.

---

## 8. Idempotency

Confirmation and rejection endpoints must protect against duplicate actions.

For example:

```text
User double-clicks Confirm
```

must not create:

```text
Event A
Event B
```

The backend must verify the current Draft status before performing the action.

Example:

```text
PENDING
→ create Event
→ CONFIRMED
```

A second confirm request sees:

```text
CONFIRMED
```

and must not create another Event.

The same principle applies to Email sending.

---

## 9. API Boundary Principle

The frontend communicates with application concepts:

```text
Message
Event Draft
Event
Email Draft
Email
```

It should not receive raw:

```text
OpenAI responses
LangChain objects
Drizzle query results
```

NestJS converts internal/provider data into stable application responses.

---

## 10. V1 API Summary

```text
POST   /messages
GET    /messages

PATCH  /event-drafts/:id
POST   /event-drafts/:id/confirm
POST   /event-drafts/:id/reject

POST   /events/:eventId/email-draft

PATCH  /email-drafts/:id
POST   /email-drafts/:id/confirm
POST   /email-drafts/:id/reject
```

These endpoints are sufficient for the complete V1 interaction flow.
