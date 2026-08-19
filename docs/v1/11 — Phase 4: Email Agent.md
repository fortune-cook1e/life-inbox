# 11 — Phase 4: Email Agent

## 1. Goal

Add the second LLM capability:

```text
Confirmed Event
      ↓
Email Agent
      ↓
Email Draft
      ↓
Email Card
```

In this phase, the email is **not sent yet**.

The goal is only to generate, persist, edit, reject, and replay the Email Draft.

---

## 2. Trigger

The Email Agent is available only after an Event has been confirmed.

The UI displays:

```text
[Create Email Reminder]
```

Clicking it calls:

```http
POST /events/:eventId/email-draft
```

This action is explicitly initiated by the user.

---

## 3. Email Agent Input

The Email Agent should receive the final confirmed Event.

Example:

```json
{
  "title": "Project Meeting",
  "startAt": "2026-08-20T15:00:00",
  "endAt": "2026-08-20T16:00:00",
  "timezone": "Europe/Stockholm",
  "location": "Ericsson",
  "description": null
}
```

Do not generate the email from the original raw user message.

This ensures that Event edits made before confirmation are respected.

---

## 4. Email Agent Output

Use structured output.

Conceptually:

```ts
type EmailAgentResult = {
  subject: string;
  body: string;
};
```

The recipient should normally come from user data:

```text
users.email
```

The LLM should not invent an email address.

---

## 5. Database

Add:

```text
email_drafts
```

Fields:

```text
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

Initial status:

```text
PENDING
```

---

## 6. Create Email Draft Flow

Endpoint:

```http
POST /events/:eventId/email-draft
```

Flow:

```text
Load confirmed Event
      ↓
Load user email
      ↓
Call Email Agent
      ↓
Validate structured output
      ↓
Create Email Draft
      ↓
Persist EMAIL_REQUEST
      ↓
Persist EMAIL_CARD
      ↓
Return Email Card
```

---

## 7. Email Card

Example:

```text
Email Reminder

To
user@example.com

Subject
Project Meeting Reminder

Body
You have a project meeting at Ericsson tomorrow at 3 PM.

[Edit] [Reject]
```

Confirm/send is introduced in Phase 5.

---

## 8. Edit Flow

Endpoint:

```http
PATCH /email-drafts/:id
```

Editable fields:

```text
to
subject
body
```

Flow:

```text
User edits Email Card
      ↓
Frontend validates
      ↓
NestJS validates
      ↓
Verify Draft is PENDING
      ↓
Update Email Draft
      ↓
Persist EMAIL_EDIT
      ↓
Return updated Draft
```

The original `EMAIL_CARD` remains unchanged in history.

---

## 9. Reject Flow

Endpoint:

```http
POST /email-drafts/:id/reject
```

Flow:

```text
Load Draft
      ↓
Verify PENDING
      ↓
Mark Draft REJECTED
      ↓
Persist EMAIL_REJECT
      ↓
Persist Assistant cancellation message
```

No email is sent.

---

## 10. Interaction History

This phase adds:

```text
EMAIL_REQUEST
EMAIL_CARD
EMAIL_EDIT
EMAIL_REJECT
```

Example:

```text
EVENT_CONFIRM
      ↓
EMAIL_REQUEST
      ↓
EMAIL_CARD
      ↓
EMAIL_EDIT
      ↓
EMAIL_REJECT
```

All interactions must survive refresh.

---

## 11. Failure Handling

Possible failures include:

```text
Event not found
Event not confirmed
LLM request failure
Invalid structured output
Invalid email recipient
```

Recommended error codes:

```text
NOT_FOUND
INVALID_STATE_TRANSITION
LLM_REQUEST_FAILED
LLM_OUTPUT_INVALID
VALIDATION_ERROR
```

If email generation fails:

- keep the confirmed Event
- do not create an invalid Email Draft
- return a clear application error

---

## 12. Learning Focus

This phase should teach:

- adding a second specialized LLM capability
- using confirmed domain data as Agent input
- structured generation
- reuse of the Draft + HITL pattern
- interaction persistence across multiple domains

---

## 13. Acceptance Criteria

Phase 4 is complete when:

- [ ] Email action appears after Event confirmation
- [ ] Email Agent uses confirmed Event data
- [ ] Email Agent returns structured output
- [ ] Email Draft is persisted
- [ ] `EMAIL_REQUEST` is persisted
- [ ] `EMAIL_CARD` is persisted
- [ ] Email Draft can be edited
- [ ] `EMAIL_EDIT` is persisted
- [ ] Email Draft can be rejected
- [ ] `EMAIL_REJECT` is persisted
- [ ] No real email is sent yet
- [ ] Email interactions survive refresh

---

## 14. Next Phase

After Email Draft generation is reliable:

```text
Phase 5
Email Delivery
```

The next step is:

```text
Email Draft
      ↓
User Confirm
      ↓
Send Email
      ↓
Persist delivery result
```
