# 04 — Frontend Interaction and Replay

## 1. Goal

The frontend provides one persistent Personal Assistant timeline.

V1 uses:

```text
Next.js
TypeScript
Zod
```

The UI must support:

- text messages
- Event Cards
- Email Cards
- Edit / Confirm / Reject
- full replay after refresh

---

## 2. Main Screen

The main page contains:

```text
Interaction Timeline
+
Message Composer
```

Conceptually:

```text
┌──────────────────────────────┐
│ Personal Assistant           │
├──────────────────────────────┤
│ User Message                 │
│ Assistant Message            │
│ Event Card                   │
│ Email Card                   │
│                              │
├──────────────────────────────┤
│ Message Input        [Send]  │
└──────────────────────────────┘
```

No conversation sidebar is needed in V1.

---

## 3. Timeline Rendering

The frontend renders each stored interaction according to its `kind`.

Example mapping:

```text
TEXT
→ TextMessage

EVENT_CARD
→ EventCard

EVENT_EDIT
→ EventEditItem

EVENT_CONFIRM
→ EventStatusItem

EVENT_REJECT
→ EventStatusItem

EMAIL_REQUEST
→ EmailRequestItem

EMAIL_CARD
→ EmailCard

EMAIL_EDIT
→ EmailEditItem

EMAIL_CONFIRM
→ EmailStatusItem

EMAIL_REJECT
→ EmailStatusItem
```

The UI should be driven by persisted interaction data rather than temporary local state.

---

## 4. Event Card

The Event Card contains:

```text
Title *
Start Time *
End Time
Timezone *
Location
Description
```

Example:

```text
Project Meeting

Start
2026-08-20 15:00

End
2026-08-20 16:00

Timezone
Europe/Stockholm

Location
Ericsson

[Confirm] [Edit] [Reject]
```

---

## 5. Event Card States

### Pending

```text
Editable
Confirm available
Reject available
```

### Confirmed

```text
Read-only
Confirmed status shown
```

### Rejected

```text
Read-only
Rejected status shown
```

The backend is the source of truth for Draft status.

---

## 6. Event Editing

When the user chooses Edit:

```text
Event Card
    ↓
Edit Mode
    ↓
Modify Fields
    ↓
Save
```

The frontend sends the updated values to:

```http
PATCH /event-drafts/:id
```

After success:

- render the updated Draft state
- keep the historical `EVENT_CARD`
- preserve the new `EVENT_EDIT` interaction

---

## 7. Event Confirmation

The Confirm button should be disabled when required fields are incomplete.

Required:

```text
title
start_at
timezone
```

However, frontend validation is only for UX.

NestJS must validate again.

Flow:

```text
User clicks Confirm
      ↓
POST /event-drafts/:id/confirm
      ↓
Backend confirms
      ↓
UI becomes read-only
```

---

## 8. Event Rejection

Flow:

```text
User clicks Reject
      ↓
POST /event-drafts/:id/reject
      ↓
Draft becomes REJECTED
      ↓
Card becomes read-only
```

The timeline also displays the assistant cancellation message.

---

## 9. Email Reminder Action

After an Event is confirmed, the UI displays:

```text
[Create Email Reminder]
```

This action is deterministic UI behavior.

It does not require another LLM decision.

Clicking it calls:

```http
POST /events/:eventId/email-draft
```

---

## 10. Email Card

The Email Card contains:

```text
To *
Subject *
Body *
```

Example:

```text
To
user@example.com

Subject
Project Meeting Reminder

Body
You have a project meeting tomorrow at 3 PM.

[Confirm] [Edit] [Reject]
```

---

## 11. Email Card States

### Pending

```text
Editable
Confirm available
Reject available
```

### Sent

```text
Read-only
Sent status shown
```

### Rejected

```text
Read-only
Rejected status shown
```

---

## 12. Replay

When the page loads:

```text
GET /messages
      ↓
Receive stored interactions
      ↓
Render timeline
```

Refreshing the page must preserve:

```text
Messages
Cards
Edits
Confirmations
Rejections
```

The frontend must not rely on previous React state to reconstruct history.

---

## 13. Client Timezone

The browser can detect the user's current IANA timezone using:

```ts
Intl.DateTimeFormat().resolvedOptions().timeZone;
```

Example:

```text
Europe/Stockholm
```

This timezone can be sent with a new user message.

The backend decides the effective timezone used for Event interpretation.

---

## 14. Loading States

At minimum, distinguish:

```text
Submitting message
Saving Event edit
Confirming Event
Rejecting Event
Generating Email Draft
Saving Email edit
Sending Email
Rejecting Email
```

Disable repeated clicks while an action is being processed.

Backend idempotency is still required.

---

## 15. Error Handling

The frontend should use backend error codes.

Examples:

```text
VALIDATION_ERROR
INVALID_STATE_TRANSITION
LLM_REQUEST_FAILED
EMAIL_DELIVERY_FAILED
```

Possible behaviors:

```text
VALIDATION_ERROR
→ show field/card error

LLM_REQUEST_FAILED
→ keep user message visible and allow retry

EMAIL_DELIVERY_FAILED
→ keep Email Draft visible and show send failure
```

Do not remove existing interaction history because a later operation failed.

---

## 16. No Streaming in Initial V1

Normal HTTP request/response is sufficient initially.

Do not add streaming until the basic flow works reliably.

V1 priority:

```text
Persistence
→ Replay
→ Event HITL
→ Email HITL
→ Error handling
```

Streaming can be introduced later if it improves the product.

---

## 17. Core Frontend Rule

> **The frontend renders application state; it does not own application truth.**

Next.js is responsible for:

```text
Display
Interaction
Temporary UI state
```

NestJS/PostgreSQL remain responsible for:

```text
Business state
Persistent state
State transitions
```

This keeps refresh, replay, and user actions predictable.
