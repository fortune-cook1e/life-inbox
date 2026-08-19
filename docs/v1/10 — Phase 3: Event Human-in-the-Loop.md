# 10 — Phase 3: Event Human-in-the-Loop

## 1. Goal

Add user control over Event Drafts.

The Event Agent proposes data, but the user decides whether to:

```text
Edit
Confirm
Reject
```

A real Event is created only after explicit confirmation.

---

## 2. Event Draft States

Use:

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

Confirmed or rejected Drafts are read-only.

---

## 3. Event Card

The Event Card displays:

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

---

## 4. Edit Flow

Endpoint:

```http
PATCH /event-drafts/:id
```

Flow:

```text
User edits Event Card
      ↓
Frontend validates input
      ↓
NestJS validates again
      ↓
Verify Draft is PENDING
      ↓
Update Event Draft
      ↓
Persist EVENT_EDIT
      ↓
Return updated Draft
```

The original `EVENT_CARD` must remain unchanged.

Example history:

```text
EVENT_CARD
Start: 15:00

↓

EVENT_EDIT
15:00 → 16:00
```

---

## 5. Confirm Flow

Endpoint:

```http
POST /event-drafts/:id/confirm
```

Flow:

```text
Load Event Draft
      ↓
Verify PENDING
      ↓
Validate required fields
      ↓
Validate time values
      ↓
Create Event
      ↓
Mark Draft CONFIRMED
      ↓
Persist EVENT_CONFIRM
      ↓
Return confirmed Event
```

The database operations should run as one transaction.

---

## 6. Event Table

Add:

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

The Event stores the final confirmed values.

---

## 7. Time Validation

Backend rules should include:

```text
start_at is required
timezone is required
```

If `end_at` exists:

```text
end_at > start_at
```

Timezone handling must be deterministic application logic.

The LLM should not decide whether the final Event time is valid.

---

## 8. Reject Flow

Endpoint:

```http
POST /event-drafts/:id/reject
```

Flow:

```text
Load Draft
      ↓
Verify PENDING
      ↓
Mark Draft REJECTED
      ↓
Persist EVENT_REJECT
      ↓
Persist Assistant cancellation message
```

No Event is created.

---

## 9. Frontend States

### Pending

```text
Editable
Confirm enabled when required fields are complete
Reject available
```

### Confirmed

```text
Read-only
Show confirmed status
```

### Rejected

```text
Read-only
Show rejected status
```

Backend status remains authoritative.

---

## 10. Duplicate Actions

The backend must protect against duplicate confirmation.

Example:

```text
User double-clicks Confirm
```

Expected result:

```text
Only one Event is created
```

The second request should see that the Draft is already `CONFIRMED`.

The same rule applies to Reject.

---

## 11. Interaction History

This phase adds:

```text
EVENT_EDIT
EVENT_CONFIRM
EVENT_REJECT
```

Example complete history:

```text
User Message
      ↓
EVENT_CARD
      ↓
EVENT_EDIT
      ↓
EVENT_CONFIRM
```

or:

```text
User Message
      ↓
EVENT_CARD
      ↓
EVENT_REJECT
      ↓
Assistant cancellation message
```

All interactions must survive refresh.

---

## 12. Failure Handling

Examples:

### Missing Required Field

```text
title = null
```

Result:

```text
VALIDATION_ERROR
```

### Invalid End Time

```text
start_at = 16:00
end_at = 15:00
```

Result:

```text
VALIDATION_ERROR
```

### Invalid State

```text
Draft already REJECTED
→ Confirm attempted
```

Result:

```text
INVALID_STATE_TRANSITION
```

---

## 13. Learning Focus

This phase should teach:

- state transitions
- transactional writes
- mutable Draft vs immutable history
- backend validation
- idempotency basics
- time and timezone validation
- UI state vs backend state

---

## 14. Acceptance Criteria

Phase 3 is complete when:

- [ ] Event Draft can be edited
- [ ] `EVENT_EDIT` is persisted
- [ ] Original `EVENT_CARD` remains unchanged
- [ ] Required fields are validated
- [ ] Invalid time ranges are rejected
- [ ] Event can be confirmed
- [ ] Confirmation creates exactly one Event
- [ ] Draft becomes `CONFIRMED`
- [ ] Event can be rejected
- [ ] Rejection creates no Event
- [ ] Draft becomes `REJECTED`
- [ ] Confirmed/rejected Cards become read-only
- [ ] Full interaction history survives refresh

---

## 15. Next Phase

After Event HITL is complete:

```text
Phase 4
Email Agent
```

The next flow becomes:

```text
Confirmed Event
      ↓
Create Email Reminder
      ↓
Email Agent
      ↓
Email Card
```
