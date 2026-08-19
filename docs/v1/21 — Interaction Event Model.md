# 21 — Interaction Event Model

## 1. Goal

The assistant timeline must preserve both:

```text
Natural-language messages
Structured user interactions
```

Every visible interaction should be persisted and replayable.

---

## 2. Interaction Types

V1 uses:

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

Each interaction is stored in `messages`.

---

## 3. Base Shape

Conceptually:

```ts
type Interaction = {
  id: string;
  userId: string;

  role: "user" | "assistant";
  kind: InteractionKind;

  content: string | null;
  payload: unknown | null;
  targetId: string | null;

  createdAt: Date;
};
```

`content` is mainly for normal text.

`payload` is used for structured interactions.

---

## 4. Text Interaction

Example:

```json
{
  "role": "user",
  "kind": "TEXT",
  "content": "Meeting tomorrow at 3 PM"
}
```

Assistant example:

```json
{
  "role": "assistant",
  "kind": "TEXT",
  "content": "Event creation was cancelled."
}
```

---

## 5. Event Card

```json
{
  "role": "assistant",
  "kind": "EVENT_CARD",
  "targetId": "event-draft-123",
  "payload": {
    "title": "Project Meeting",
    "startAt": "2026-08-20T15:00:00",
    "endAt": null,
    "timezone": "Europe/Stockholm",
    "location": "Ericsson",
    "description": null
  }
}
```

The payload is a historical snapshot.

It must not be updated after later edits.

---

## 6. Event Edit

```json
{
  "role": "user",
  "kind": "EVENT_EDIT",
  "targetId": "event-draft-123",
  "payload": {
    "before": {
      "startAt": "2026-08-20T15:00:00"
    },
    "after": {
      "startAt": "2026-08-20T16:00:00"
    }
  }
}
```

The current Event Draft is updated separately.

---

## 7. Event Confirm / Reject

Confirm:

```json
{
  "role": "user",
  "kind": "EVENT_CONFIRM",
  "targetId": "event-draft-123",
  "payload": {
    "eventId": "event-456"
  }
}
```

Reject:

```json
{
  "role": "user",
  "kind": "EVENT_REJECT",
  "targetId": "event-draft-123"
}
```

---

## 8. Email Interactions

Email Card:

```json
{
  "role": "assistant",
  "kind": "EMAIL_CARD",
  "targetId": "email-draft-123",
  "payload": {
    "to": "user@example.com",
    "subject": "Project Meeting Reminder",
    "body": "You have a project meeting tomorrow at 3 PM."
  }
}
```

Email Edit follows the same pattern:

```text
before
→ after
```

Confirmation and rejection reference the same Email Draft through `targetId`.

---

## 9. Replay

The frontend loads:

```http
GET /messages
```

and renders each record by `kind`.

Example:

```text
TEXT
→ TextMessage

EVENT_CARD
→ EventCard

EVENT_EDIT
→ EventEditItem

EVENT_CONFIRM
→ EventStatus

EMAIL_CARD
→ EmailCard
```

The frontend should not reconstruct historical interactions from current Draft state.

---

## 10. Current State vs Historical Snapshot

Example:

```text
EVENT_CARD
start_at = 15:00

↓

EVENT_EDIT
15:00 → 16:00
```

Current Draft:

```text
start_at = 16:00
```

Historical Card:

```text
start_at = 15:00
```

Both are correct because they answer different questions.

---

## 11. Core Principle

> **Interaction records describe what happened; Draft tables describe what is currently true.**

Do not use the timeline as the only source of current business state.

Do not overwrite history to reflect current state.
