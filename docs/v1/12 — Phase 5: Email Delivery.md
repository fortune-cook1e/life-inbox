# 12 — Phase 5: Email Delivery

## 1. Goal

Complete the Email workflow by adding real delivery.

Flow:

```text
Email Draft
    ↓
User Confirm
    ↓
Send Email
    ↓
Persist Delivery Result
```

This is the first V1 feature with an external side effect.

---

## 2. Trigger

The Email Card now includes:

```text
[Confirm] [Edit] [Reject]
```

Confirm calls:

```http
POST /email-drafts/:id/confirm
```

The email must never be sent without explicit user confirmation.

---

## 3. Email Provider

Choose one email provider during implementation.

NestJS should be responsible for calling it.

Conceptually:

```text
Email Domain
    ↓
Email Provider
```

The exact provider is not part of the core V1 design.

---

## 4. Database

Add:

```text
emails
```

Fields:

```text
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

---

## 5. Confirm Flow

Endpoint:

```http
POST /email-drafts/:id/confirm
```

Flow:

```text
Load Email Draft
      ↓
Verify PENDING
      ↓
Validate to / subject / body
      ↓
Send Email
      ↓
Persist Email Result
      ↓
Mark Draft SENT
      ↓
Persist EMAIL_CONFIRM
```

If delivery succeeds:

```text
delivery_status = SENT
```

---

## 6. Delivery Failure

If the provider fails:

```text
Send Email
    ↓
Failure
```

The application must not report success.

Expected behavior:

```text
Persist failure if useful
Keep Draft available
Return EMAIL_DELIVERY_FAILED
```

The Draft should not become `SENT`.

---

## 7. Duplicate Send Protection

Email confirmation must protect against repeated requests.

Example:

```text
User double-clicks Confirm
```

must not result in:

```text
Email #1 sent
Email #2 sent
```

The backend must check the Draft state before sending.

Conceptually:

```text
PENDING
   ↓
Send
   ↓
SENT
```

Any later confirm request should not send again.

---

## 8. Email Draft States

After this phase:

```text
PENDING
SENT
REJECTED
```

Valid transitions:

```text
PENDING → SENT
PENDING → REJECTED
```

Invalid:

```text
SENT → REJECTED
REJECTED → SENT
```

---

## 9. Interaction History

Successful flow:

```text
EMAIL_CARD
    ↓
EMAIL_EDIT
    ↓
EMAIL_CONFIRM
```

Rejected flow:

```text
EMAIL_CARD
    ↓
EMAIL_REJECT
```

Failed delivery should also produce a visible error state without removing the existing Email Card.

---

## 10. External Side Effect Rule

Database writes and email delivery cannot share a normal PostgreSQL transaction.

Therefore:

```text
Database Transaction
≠
Email Provider Transaction
```

V1 should keep the behavior explicit and simple.

Do not introduce:

```text
Queues
Outbox Pattern
Distributed Transactions
```

yet.

Those can be added later if delivery reliability requirements justify them.

---

## 11. Secrets

Email provider credentials must remain server-side.

Example:

```text
EMAIL_API_KEY
EMAIL_FROM_ADDRESS
```

They must never be exposed to the Next.js client.

---

## 12. Error Handling

Possible failures:

```text
Invalid recipient
Provider timeout
Provider API error
Network error
Duplicate confirm
```

Recommended errors:

```text
VALIDATION_ERROR
INVALID_STATE_TRANSITION
EMAIL_DELIVERY_FAILED
```

The frontend should display a clear failure state and allow the user to understand that the email was not sent.

---

## 13. Frontend Behavior

### Pending

```text
Editable
Confirm available
Reject available
```

### Sending

```text
Confirm disabled
Show loading state
```

### Sent

```text
Read-only
Show Sent status
```

### Failed

```text
Keep Draft visible
Show delivery error
Allow retry if backend state permits
```

---

## 14. Learning Focus

This phase should teach:

- external API integration
- external side effects
- secret management
- provider failure handling
- duplicate-send protection
- difference between database consistency and external-system consistency

---

## 15. Acceptance Criteria

Phase 5 is complete when:

- [ ] Email Confirm endpoint exists
- [ ] Real email provider is integrated
- [ ] Email is sent only after user confirmation
- [ ] Successful delivery creates an `emails` record
- [ ] Draft becomes `SENT`
- [ ] `EMAIL_CONFIRM` is persisted
- [ ] Failed delivery does not report success
- [ ] Failed delivery does not mark Draft as `SENT`
- [ ] Double confirmation does not send duplicate emails
- [ ] Sent Email Card becomes read-only
- [ ] Interaction history survives refresh

---

## 16. Next Phase

After the complete Event + Email vertical slice works:

```text
Phase 6
Hardening
```

The focus shifts from adding features to improving:

```text
Reliability
Testing
Observability
Error Handling
Performance
```
