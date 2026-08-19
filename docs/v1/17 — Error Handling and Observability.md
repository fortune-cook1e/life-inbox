# 17 — Error Handling and Observability

## 1. Goal

V1 should fail predictably.

The system must make it clear whether a failure came from:

- validation
- invalid business state
- database
- LLM provider
- email provider
- unexpected backend error

Errors should be understandable by both the frontend and developers.

---

## 2. Application Error Format

Use a consistent API error structure.

Example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Event title is required."
  }
}
```

Recommended V1 error codes:

```text
VALIDATION_ERROR

NOT_FOUND

INVALID_STATE_TRANSITION

LLM_REQUEST_FAILED
LLM_OUTPUT_INVALID

EMAIL_DELIVERY_FAILED

DATABASE_ERROR

INTERNAL_ERROR
```

The frontend should use `code` for behavior.

---

## 3. Validation Errors

Examples:

```text
Missing Event title
Missing start_at
Invalid timezone
end_at before start_at
Invalid email address
```

Return:

```text
VALIDATION_ERROR
```

Validation failures should not modify business state.

---

## 4. State Transition Errors

Example:

```text
Event Draft = REJECTED

User attempts Confirm
```

Return:

```text
INVALID_STATE_TRANSITION
```

The same applies to Email Drafts.

---

## 5. LLM Errors

Possible failures:

```text
Timeout
Rate limit
Provider error
Invalid structured output
```

Map them into:

```text
LLM_REQUEST_FAILED
```

or:

```text
LLM_OUTPUT_INVALID
```

The original User Message must remain persisted.

Do not create an Event Draft from invalid model output.

---

## 6. Email Errors

Possible failures:

```text
Provider unavailable
Network failure
Invalid recipient
Provider rejects request
```

Return:

```text
EMAIL_DELIVERY_FAILED
```

Do not mark the Email Draft as `SENT`.

Do not show a success message.

---

## 7. Database Errors

Database failures should not expose raw SQL or PostgreSQL errors to the frontend.

Map unexpected persistence failures to:

```text
DATABASE_ERROR
```

or a more general:

```text
INTERNAL_ERROR
```

Detailed database errors belong in backend logs.

---

## 8. Logging

NestJS should log important application events.

Examples:

```text
message.created

event_draft.created
event_draft.updated
event.confirmed
event.rejected

email_draft.created
email_draft.updated
email.sent
email.rejected

llm.request.failed
email.delivery.failed
```

Prefer structured logs.

Example:

```json
{
  "event": "event.confirmed",
  "eventId": "event_123",
  "userId": "user_123"
}
```

---

## 9. Request ID

Each HTTP request should eventually have a request identifier.

Example:

```text
requestId = req_123
```

The same ID can appear in logs across:

```text
Controller
Service
Database operation
LLM request
Email provider call
```

This makes debugging one user action easier.

---

## 10. What Not to Log

Avoid logging:

```text
OPENAI_API_KEY
DATABASE_URL
Email provider secrets
Authorization tokens
```

Also avoid logging full user content unless it is actually necessary for debugging.

Prefer identifiers and metadata.

---

## 11. LLM Observability

Useful metadata for LLM requests may include:

```text
Agent type
Model
Prompt version
Request duration
Success / failure
```

Example:

```json
{
  "agent": "event-agent",
  "model": "configured-model",
  "promptVersion": "event-extraction:v1",
  "durationMs": 820,
  "status": "success"
}
```

Do not store private model reasoning.

---

## 12. Important Metrics Later

V1 does not need a full monitoring platform immediately.

Useful metrics once the system is stable may include:

```text
LLM request latency
LLM failure rate

Event confirmation rate
Event rejection rate

Email send success rate
Email send failure rate

API latency
```

Add monitoring only when there is a real need to observe these values.

---

## 13. Frontend Error Behavior

The frontend should preserve the current interaction when an error occurs.

Examples:

### LLM Failure

```text
User Message remains visible
→ Show retry/error state
```

### Email Failure

```text
Email Card remains visible
→ Show delivery failure
```

### Validation Failure

```text
Keep Event Card editable
→ Show validation feedback
```

Never remove existing history because a later operation failed.

---

## 14. Core Principle

> **Errors are part of the product state, not unexpected exceptions to ignore.**

The application should always make clear:

```text
What failed?
Did any state change?
Can the user retry?
Was a side effect executed?
```

This becomes especially important once the system starts calling external LLM and email services.
