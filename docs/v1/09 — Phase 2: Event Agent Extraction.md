# 09 — Phase 2: Event Agent Extraction

## 1. Goal

Replace the placeholder assistant response with the first real LLM capability.

The Event Agent should decide whether a user message contains an Event intent.

Flow:

```text
User Message
      ↓
Event Agent
      ↓
Event?
 ┌────┴────┐
 No        Yes
 ↓          ↓
Text      Event Draft
Response      ↓
          Event Card
```

No Event confirmation or editing is implemented yet.

---

## 2. Add LLM Dependencies

Introduce:

```text
LangChain
@langchain/openai
OpenAI
Zod
```

Environment variables:

```text
OPENAI_API_KEY
OPENAI_MODEL
```

The model name should come from configuration rather than being hard-coded in application logic.

---

## 3. Event Agent Output

The Event Agent should return structured output.

Conceptually:

```ts
type EventAgentResult =
  | {
      kind: "event";
      event: {
        title: string | null;
        startAt: string | null;
        endAt: string | null;
        timezone: string | null;
        location: string | null;
        description: string | null;
      };
    }
  | {
      kind: "text";
      response: string;
    };
```

Use Zod to define and validate this structure.

---

## 4. Event Intent

Example:

```text
Meeting at Ericsson tomorrow at 3 PM.
```

Possible result:

```json
{
  "kind": "event",
  "event": {
    "title": "Meeting",
    "startAt": "2026-08-20T15:00:00",
    "endAt": null,
    "timezone": null,
    "location": "Ericsson",
    "description": null
  }
}
```

Missing information should remain `null`.

The Agent should not ask follow-up questions.

---

## 5. Normal Message

Example:

```text
The weather is nice today.
```

Possible result:

```json
{
  "kind": "text",
  "response": "It does sound like a nice day."
}
```

No Event Draft should be created.

---

## 6. Runtime Context

Relative date expressions require runtime context.

For every Event Agent call, provide:

```text
Current date/time
User timezone
```

Example:

```text
Current time:
2026-08-19T15:45:00+02:00

User timezone:
Europe/Stockholm
```

This allows the model to interpret:

```text
tomorrow
this Friday
next Monday
```

The LLM should not guess the current date.

---

## 7. Timezone Behavior

Timezone priority:

```text
Explicit timezone in user message
        ↓
User default/current timezone
```

Example:

```text
Meeting tomorrow at 3 PM
```

uses the user's timezone.

Example:

```text
Meeting tomorrow at 3 PM London time
```

uses the explicitly specified timezone.

The backend remains responsible for validating the final timezone value.

---

## 8. Database Changes

Add:

```text
event_drafts
```

Fields:

```text
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

New Drafts start with:

```text
status = PENDING
```

---

## 9. Message Flow

Update:

```http
POST /messages
```

Flow becomes:

```text
Validate request
      ↓
Persist User TEXT
      ↓
Load user timezone
      ↓
Call Event Agent
```

If the result is normal text:

```text
Persist Assistant TEXT
→ Return response
```

If the result is Event:

```text
Apply default timezone if needed
      ↓
Create Event Draft
      ↓
Persist EVENT_CARD
      ↓
Return Event Card
```

---

## 10. Event Card Payload

Example:

```json
{
  "draftId": "draft_123",
  "title": "Meeting",
  "startAt": "2026-08-20T15:00:00",
  "endAt": null,
  "timezone": "Europe/Stockholm",
  "location": "Ericsson",
  "description": null
}
```

This payload is a historical snapshot.

The Event Draft stores the current editable state.

---

## 11. Frontend

Add support for rendering:

```text
EVENT_CARD
```

For Phase 2, the Card can initially be read-only.

Example:

```text
Meeting

Start
2026-08-20 15:00

End
—

Timezone
Europe/Stockholm

Location
Ericsson
```

Edit / Confirm / Reject are introduced in Phase 3.

---

## 12. Failure Handling

Possible LLM failures include:

```text
Provider error
Timeout
Rate limit
Invalid structured output
```

If the LLM fails:

- keep the original user message
- do not create an invalid Event Draft
- return an application error such as `LLM_REQUEST_FAILED`

The user's message must never disappear because the LLM failed.

---

## 13. Test Cases

At minimum, test:

### Complete Event

```text
Meeting at Ericsson tomorrow at 3 PM.
```

### Reminder-style Event

```text
Remind me to submit my assignment Friday at 10 AM.
```

### Missing Title

```text
Remind me tomorrow at 3 PM.
```

### Explicit End Time

```text
Meeting tomorrow from 3 PM to 4 PM.
```

### Explicit Timezone

```text
Meeting Friday at 3 PM London time.
```

### No Event

```text
I had a good day today.
```

---

## 14. Acceptance Criteria

Phase 2 is complete when:

- [ ] LangChain and OpenAI are configured
- [ ] Event Agent returns validated structured output
- [ ] Relative dates use runtime date/time context
- [ ] User timezone is supplied to the Agent
- [ ] Missing Event fields remain `null`
- [ ] Event messages create `event_drafts`
- [ ] Event messages create persisted `EVENT_CARD` interactions
- [ ] Non-Event messages create normal assistant text
- [ ] Event Cards survive refresh
- [ ] LLM failures do not remove the original user message

---

## 15. Next Phase

After Event extraction is reliable:

```text
Phase 3
Event Human-in-the-Loop
```

Add:

```text
Edit
Confirm
Reject
```

and convert the proposed Event Draft into a final Event only after explicit user confirmation.
