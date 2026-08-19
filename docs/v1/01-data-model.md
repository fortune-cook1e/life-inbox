# 01 — Data Model

## 1. Goal

The database needs to preserve three kinds of state:

```text
Interaction History
Working Drafts
Confirmed Business Data
```

V1 uses:

```text
PostgreSQL
Drizzle ORM
Drizzle Kit
```

---

## 2. Tables

V1 requires:

```text
users
messages

event_drafts
events

email_drafts
emails
```

There is no `conversations` table because V1 has one persistent conversation per user.

---

## 3. Users

```text
users

id
email
timezone
created_at
updated_at
```

`timezone` stores an IANA timezone identifier, for example:

```text
Europe/Stockholm
```

The user's timezone is used as the default when an Event does not explicitly specify another timezone.

---

## 4. Messages

`messages` stores the complete interaction history, including both normal text and structured UI interactions.

```text
messages

id
user_id

role
kind

content
payload
target_id

created_at
```

### Role

```text
user
assistant
```

### Kind

```text
TEXT

EVENT_CARD
EVENT_EDIT
EVENT_CONFIRM
EVENT_REJECT

EMAIL_REQUEST
EMAIL_CARD
EMAIL_EDIT
EMAIL_CONFIRM
EMAIL_REJECT
```

`content` is mainly used for normal text.

`payload` stores structured interaction data.

Example:

```json
{
  "kind": "EVENT_CARD",
  "payload": {
    "draftId": "draft_123",
    "title": "Project Meeting",
    "startAt": "2026-08-20T15:00:00",
    "endAt": null,
    "timezone": "Europe/Stockholm",
    "location": "Ericsson",
    "description": null
  }
}
```

Historical interaction records are append-only.

If the assistant originally proposes:

```text
15:00
```

and the user later changes it to:

```text
16:00
```

the history should contain:

```text
EVENT_CARD
15:00

↓

EVENT_EDIT
15:00 → 16:00
```

The original Event Card should not be overwritten.

---

## 5. Event Draft

`event_drafts` stores the current editable Event state.

```text
event_drafts

id
user_id
source_message_id

status

title
start_at
end_at
timezone
location
description

created_at
updated_at
```

### Status

```text
PENDING
CONFIRMED
REJECTED
```

Valid transitions:

```text
PENDING → CONFIRMED
PENDING → REJECTED
```

A confirmed or rejected Draft can no longer be edited.

---

## 6. Event Fields

Required before confirmation:

```text
title
start_at
timezone
```

Optional:

```text
end_at
location
description
```

A Draft may temporarily contain missing required fields.

Example:

```text
title = null
start_at = 2026-08-20 15:00
timezone = Europe/Stockholm
```

The user completes the missing information directly in the Event Card.

---

## 7. Event

`events` stores the final confirmed Event.

```text
events

id
user_id
source_draft_id

title
start_at
end_at
timezone
location
description

created_at
```

An Event is created only after explicit user confirmation.

A reminder-style Event is valid with:

```text
start_at = 2026-08-20 15:00
end_at = null
location = null
```

There is no separate Reminder table in V1.

---

## 8. Time and Timezone

Every Event must have:

```text
start_at
timezone
```

`end_at` is optional.

Example:

```text
start_at = 2026-08-20 15:00
timezone = Europe/Stockholm
```

The LLM may interpret natural-language time expressions such as:

```text
tomorrow at 3 PM
```

but the backend is responsible for deterministic timezone handling and validation.

The exact PostgreSQL type and normalization strategy for `start_at` and `end_at` will be decided during implementation.

The important V1 rule is:

> `start_at`, `end_at`, and `timezone` remain explicit application fields.

---

## 9. Email Draft

`email_drafts` stores the current editable Email state.

```text
email_drafts

id
user_id
event_id

status

to
subject
body

created_at
updated_at
```

### Status

```text
PENDING
SENT
REJECTED
```

The Email Agent generates:

```text
subject
body
```

The recipient normally comes from user data, but the user can edit it before confirmation.

---

## 10. Email

`emails` stores the final email delivery result.

```text
emails

id
user_id
event_id
source_draft_id

to
subject
body

delivery_status
provider_message_id

sent_at
created_at
```

Initial delivery statuses:

```text
SENT
FAILED
```

The system must not report a failed email as successfully sent.

---

## 11. State Separation

The main persistence model is:

```text
messages
→ What happened?

event_drafts / email_drafts
→ What is currently being edited?

events / emails
→ What was finally confirmed?
```

Example:

```text
Assistant proposes Event
start_at = 15:00
        ↓
EVENT_CARD

User edits
15:00 → 16:00
        ↓
EVENT_EDIT

Current Event Draft
start_at = 16:00
        ↓
Confirm

Final Event
start_at = 16:00
```

This allows the application to preserve both accurate interaction history and simple current business state.

---

## 12. Main Relationships

```text
User
 │
 ├── Messages
 │
 ├── Event Draft
 │      ↓
 │     Event
 │
 └── Email Draft
        ↓
       Email
```

Email Drafts are created from confirmed Events:

```text
Event
  ↓
Email Draft
  ↓
Email
```

Traceability should remain possible:

```text
Event
→ Event Draft
→ Original User Message
```

and:

```text
Email
→ Email Draft
→ Event
```

---

## 13. Core Rules

- Interaction history is append-only.
- Drafts are mutable only while `PENDING`.
- Confirmed or rejected Drafts are read-only.
- Events are created only after explicit user confirmation.
- Emails are sent only after explicit user confirmation.
- `title`, `start_at`, and `timezone` are required before Event confirmation.
- `end_at`, `location`, and `description` are optional.
- Event time validation is handled by the backend.
- Timezone handling is deterministic application logic, not LLM responsibility.
- Final business state is stored separately from interaction history.
