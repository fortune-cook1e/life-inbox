# 14 — Phase 7: V1 Completion Review

## 1. Goal

Verify that the full V1 vertical slice works correctly from end to end.

No new features should be added in this phase.

The purpose is to confirm that the system is:

- functionally complete
- persistent
- replayable
- safe against invalid state transitions
- reliable enough to become the foundation for V2

---

## 2. Full V1 Flow

The complete happy path should work as:

```text
User submits natural-language text
        ↓
User Message is persisted
        ↓
Event Agent interprets the message
        ↓
Event Draft is created
        ↓
Event Card is persisted and rendered
        ↓
User edits Event if necessary
        ↓
EVENT_EDIT is persisted
        ↓
User confirms Event
        ↓
Final Event is created
        ↓
EVENT_CONFIRM is persisted
        ↓
User chooses Create Email Reminder
        ↓
Email Agent generates Email Draft
        ↓
Email Card is persisted and rendered
        ↓
User edits Email if necessary
        ↓
EMAIL_EDIT is persisted
        ↓
User confirms Email
        ↓
Email is sent
        ↓
EMAIL_CONFIRM is persisted
        ↓
Application is refreshed
        ↓
Complete interaction history is replayed
```

---

## 3. Event Scenarios

Verify all major Event flows.

### Complete Event

```text
Meeting at Ericsson tomorrow at 3 PM.
```

Expected:

```text
Event Card
→ Confirm
→ Event created
```

### Missing Required Field

```text
Remind me tomorrow at 3 PM.
```

Expected:

```text
Event Card
→ Missing title
→ User edits title
→ Confirm
```

### Reminder-Style Event

```text
Remind me to submit my assignment Friday at 10 AM.
```

Expected:

```text
start_at exists
end_at = null
location = null
```

The Event can still be confirmed.

### Event Edit

```text
LLM proposes 15:00
→ User changes to 16:00
```

Expected:

```text
Original EVENT_CARD remains 15:00
EVENT_EDIT records the change
Final Event stores 16:00
```

### Event Reject

Expected:

```text
Draft → REJECTED
No Event created
EVENT_REJECT persisted
```

---

## 4. Email Scenarios

### Email Draft Generation

After Event confirmation:

```text
Create Email Reminder
→ Email Draft
→ Email Card
```

The Email Agent must use the confirmed Event data.

### Email Edit

Expected:

```text
Original EMAIL_CARD remains unchanged
EMAIL_EDIT records the modification
Current Draft contains edited values
```

### Email Confirm

Expected:

```text
Email sent once
Draft → SENT
Email record created
EMAIL_CONFIRM persisted
```

### Email Reject

Expected:

```text
Draft → REJECTED
No email sent
EMAIL_REJECT persisted
```

---

## 5. Replay Verification

Create a realistic interaction history:

```text
User Message
EVENT_CARD
EVENT_EDIT
EVENT_CONFIRM
Assistant Message
EMAIL_REQUEST
EMAIL_CARD
EMAIL_EDIT
EMAIL_CONFIRM
```

Refresh the application.

The UI should reconstruct the same interaction sequence.

Historical Cards must preserve their original values.

---

## 6. State Transition Verification

Verify invalid transitions are blocked.

### Event Draft

Invalid examples:

```text
CONFIRMED → REJECTED
REJECTED → CONFIRMED
```

### Email Draft

Invalid examples:

```text
SENT → REJECTED
REJECTED → SENT
```

Expected:

```text
INVALID_STATE_TRANSITION
```

No additional side effect should occur.

---

## 7. Duplicate Action Verification

Test repeated requests.

Examples:

```text
Confirm Event twice
Confirm Email twice
Reject Event twice
```

Expected:

```text
No duplicate Event
No duplicate email
No duplicate business side effect
```

---

## 8. Failure Verification

Test at least:

```text
OpenAI failure
Invalid structured output
Database failure
Email provider failure
Invalid Event time
Missing required field
```

Expected behavior:

- existing interaction history is preserved
- no fake success is shown
- invalid business state is not created
- stable application errors are returned

---

## 9. Timezone Verification

Test:

```text
User timezone:
Europe/Stockholm
```

with inputs such as:

```text
Tomorrow at 3 PM
```

and:

```text
Tomorrow at 3 PM London time
```

Verify that:

- default timezone is applied correctly
- explicit timezone overrides the default
- timezone remains visible in the Event Card
- confirmed Event time is stored consistently

Also test at least one date around a daylight-saving transition.

---

## 10. Persistence Verification

Restart:

```text
Next.js
NestJS
PostgreSQL connection
```

and verify that previously persisted data remains available.

The application must not depend on in-memory state for:

```text
Messages
Drafts
Events
Emails
Interaction history
```

---

## 11. Security and Configuration Check

Verify:

- OpenAI key is server-side only
- database credentials are server-side only
- email provider credentials are server-side only
- environment configuration is validated
- CORS is restricted appropriately
- user input is validated
- LLM output is validated

---

## 12. Final V1 Definition of Done

V1 is complete when:

- [ ] User messages persist
- [ ] Assistant messages persist
- [ ] Event intent detection works
- [ ] Event Cards persist
- [ ] Event edits persist
- [ ] Event confirmation works
- [ ] Event rejection works
- [ ] Reminder-style Events work
- [ ] Timezone behavior works
- [ ] Email Draft generation works
- [ ] Email Cards persist
- [ ] Email edits persist
- [ ] Email confirmation sends exactly once
- [ ] Email rejection sends nothing
- [ ] Interaction history survives refresh
- [ ] Historical Cards are not overwritten
- [ ] Invalid state transitions are blocked
- [ ] LLM failure does not destroy user input
- [ ] Email failure does not report success
- [ ] Core flows have tests
- [ ] Important backend operations are logged
- [ ] Database migrations can reproduce the schema

---

## 13. What Comes After V1

Only after this review passes should the project move into V2.

Possible future directions include:

```text
Memory
RAG
Document Knowledge Base
Task Management
Recurring Events
Background Jobs
Proactive Actions
Multi-Agent Collaboration
LangGraph
```

These should be introduced one requirement at a time.

---

## 14. Final Principle

V1 should prove one thing well:

> **A user can express an intent in natural language, review the LLM's proposal, explicitly approve or reject the action, and later replay the complete interaction history.**

Once this foundation is reliable, more advanced Agent capabilities can be added without rebuilding the core application.
