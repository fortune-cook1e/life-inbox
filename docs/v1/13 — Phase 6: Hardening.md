# 13 — Phase 6: Hardening

## 1. Goal

Improve reliability after the full V1 workflow is already working.

Do not add new product features in this phase.

Focus on:

- testing
- error handling
- observability
- idempotency
- configuration
- performance

---

## 2. Pagination

`GET /messages` should not return the entire interaction history forever.

Add pagination.

Example:

```http
GET /messages?limit=50
```

Later pages can use a cursor or timestamp.

Goal:

```text
Load latest interactions
→ Load older history when needed
```

---

## 3. Integration Tests

Add tests for important application flows.

At minimum:

```text
Submit Message
Event Extraction
Event Edit
Event Confirm
Event Reject
Email Draft Generation
Email Edit
Email Confirm
Email Reject
Timeline Replay
```

Tests should verify both:

```text
API Response
+
Database State
```

---

## 4. Mock LLM Tests

Core application behavior should not depend on real OpenAI calls during every test.

Use mocked Event Agent results.

Example:

```text
Input:
"Meeting tomorrow at 3 PM"

Mock Event Agent:
{
  kind: "event",
  ...
}
```

Then test:

```text
Draft creation
Event Card persistence
Confirmation
Rejection
```

independently from OpenAI.

---

## 5. Agent Evaluation Cases

Maintain a small set of representative Event extraction examples.

Examples:

```text
Meeting tomorrow at 3 PM.
```

```text
Remind me to submit my assignment Friday at 10 AM.
```

```text
Meeting Friday from 3 PM to 4 PM London time.
```

```text
I had a good day today.
```

Use these to detect prompt/model behavior regressions.

---

## 6. Logging

Add structured backend logging for important operations.

Examples:

```text
message.submitted
event_draft.created
event.confirmed
event.rejected
email_draft.created
email.sent
email.failed
llm.failed
```

Avoid logging sensitive secrets or unnecessary user content.

---

## 7. Request Correlation

Add a request ID so logs from one HTTP request can be connected.

Conceptually:

```text
request_id
→ Controller
→ Service
→ LLM call
→ Database operation
```

This makes debugging much easier.

---

## 8. External Request Timeouts

LLM and email-provider requests must not wait indefinitely.

Configure reasonable timeouts for:

```text
OpenAI
Email Provider
```

Timeouts should become clear application errors.

Example:

```text
LLM_REQUEST_FAILED
EMAIL_DELIVERY_FAILED
```

---

## 9. Idempotency Review

Re-check all side-effect endpoints.

Especially:

```text
POST /event-drafts/:id/confirm
POST /event-drafts/:id/reject
POST /email-drafts/:id/confirm
POST /email-drafts/:id/reject
```

Verify that repeated requests cannot create duplicate Events or emails.

---

## 10. Database Constraints

Review schema constraints after the application behavior is stable.

Examples:

```text
Foreign keys
NOT NULL
Unique constraints
Status values
```

Use database constraints to reinforce important invariants.

Do not move the entire business workflow into PostgreSQL.

---

## 11. Configuration Validation

Validate required environment variables during backend startup.

Examples:

```text
DATABASE_URL
OPENAI_API_KEY
OPENAI_MODEL
EMAIL_PROVIDER_API_KEY
```

If configuration is invalid:

```text
Application should fail fast
```

instead of failing later during a request.

---

## 12. Error Mapping

Ensure provider-specific errors are converted into stable application errors.

Example:

```text
OpenAI provider error
      ↓
LLM_REQUEST_FAILED
```

```text
Email provider error
      ↓
EMAIL_DELIVERY_FAILED
```

The frontend should not depend on provider-specific response formats.

---

## 13. Database Indexes

Review actual query patterns before adding indexes.

Likely useful examples include:

```text
messages.user_id
messages.created_at

event_drafts.user_id
events.user_id

email_drafts.user_id
emails.user_id
```

Do not add indexes without understanding which queries need them.

---

## 14. Replay Testing

Test interaction replay using realistic histories.

Example:

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

After refresh, the UI should reconstruct the same interaction timeline.

---

## 15. Failure Scenarios

Explicitly test:

```text
Database unavailable
OpenAI unavailable
Invalid LLM output
Email provider unavailable
Duplicate Confirm
Invalid Event time
Missing required fields
Rejected Draft reused
```

The system should fail predictably without corrupting state.

---

## 16. Security Basics

Before calling V1 complete:

- keep secrets server-side
- validate all user input
- validate LLM output
- avoid exposing internal errors directly
- restrict CORS appropriately
- avoid logging secrets
- verify ownership of Drafts and Events

Full authentication can still be added later if it remains outside V1 scope.

---

## 17. Performance

Do not optimize prematurely.

Only investigate performance after identifying actual bottlenecks.

Likely early bottleneck:

```text
LLM latency
```

not:

```text
NestJS
PostgreSQL
Drizzle
```

Measure before optimizing.

---

## 18. Acceptance Criteria

Phase 6 is complete when:

- [ ] Interaction history is paginated
- [ ] Important application flows have integration tests
- [ ] Business logic can be tested with mocked LLM output
- [ ] Event Agent has representative evaluation cases
- [ ] Important operations produce useful logs
- [ ] External API calls have timeouts
- [ ] Duplicate actions are protected
- [ ] Environment configuration is validated
- [ ] Provider errors are mapped to application errors
- [ ] Database constraints and indexes have been reviewed
- [ ] Replay works with long interaction histories
- [ ] Common failure scenarios have been tested

---

## 19. Next Phase

After hardening:

```text
Phase 7
V1 Completion Review
```

The next phase does not introduce new functionality.

It verifies that the entire V1 product behaves correctly as one complete system.
