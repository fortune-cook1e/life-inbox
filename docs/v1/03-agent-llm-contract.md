# 03 — Agent and LLM Contracts

## 1. Goal

V1 uses two LLM capabilities:

```text
Event Agent
Email Agent
```

They are intentionally simple.

The LLM is responsible for interpretation and generation, while NestJS controls business state and side effects.

---

## 2. Event Agent

The Event Agent receives user text and returns one of two results:

```text
Event intent
or
Normal text response
```

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

Use LangChain structured output with Zod validation.

---

## 3. Missing Event Fields

The Event Agent should not ask follow-up questions.

If information is missing, return `null`.

Example input:

```text
Remind me tomorrow at 3 PM.
```

Possible result:

```json
{
  "kind": "event",
  "event": {
    "title": null,
    "startAt": "2026-08-20T15:00:00",
    "endAt": null,
    "timezone": null,
    "location": null,
    "description": null
  }
}
```

The application then fills the default timezone and displays the Event Card.

The user completes missing required fields manually.

---

## 4. Time Context

Relative expressions require explicit runtime context.

Examples:

```text
tomorrow
this Friday
next Monday
```

Each Event Agent request should include:

```text
Current date/time
User timezone
```

Example:

```text
Current date/time:
2026-08-19T15:00:00+02:00

User timezone:
Europe/Stockholm
```

This context must be provided by the backend.

The model should not guess what "today" means.

---

## 5. Timezone Rules

Timezone priority:

```text
1. Explicit timezone from user input
2. User's default/current timezone
```

Example:

```text
Meeting tomorrow at 3 PM
```

uses:

```text
Europe/Stockholm
```

if that is the user's current timezone.

Example:

```text
Meeting tomorrow at 3 PM London time
```

should use the explicitly stated timezone instead.

Timezone validation and normalization remain backend responsibilities.

---

## 6. Event Agent Rules

The Event Agent should:

- detect Event intent conservatively
- extract only information supported by the input
- interpret relative dates using supplied runtime context
- return `null` for missing values
- avoid inventing locations or end times
- avoid claiming that an Event has already been created

The Event Agent must not:

- create database records
- confirm an Event
- send email
- enforce business state transitions
- perform authoritative validation

---

## 7. Email Agent

The Email Agent receives a confirmed Event.

It should not use the original raw user message as its primary source.

Conceptually:

```text
Confirmed Event
      ↓
Email Agent
      ↓
Email Draft
```

Input example:

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

---

## 8. Email Agent Output

The Email Agent generates:

```ts
{
  subject: string;
  body: string;
}
```

The recipient should normally come from user data rather than the LLM.

Example:

```json
{
  "subject": "Project Meeting Reminder",
  "body": "You have a project meeting at Ericsson tomorrow at 3 PM."
}
```

---

## 9. Structured Output

LLM responses used for application state should use:

```text
LangChain
+
OpenAI
+
Zod structured output
```

Flow:

```text
Prompt
  ↓
OpenAI
  ↓
Structured Output
  ↓
Zod Validation
  ↓
Application Data
```

Do not rely on manually parsing free-form JSON from model text.

---

## 10. LLM Failure Handling

The LLM is an external dependency and may fail.

Examples:

```text
Timeout
Rate limit
Provider error
Invalid structured output
```

The backend should:

- preserve the original user message
- avoid creating invalid Drafts
- return a stable application error
- allow retry

Example application error:

```text
LLM_REQUEST_FAILED
```

---

## 11. Prompt Organization

Keep prompts separate from business logic.

Suggested prompt identifiers:

```text
event-extraction:v1
email-generation:v1
```

Prompts should be:

- focused
- version controlled
- testable
- easy to change independently

Avoid one large global prompt controlling the whole application.

---

## 12. Core Principle

The LLM produces proposals.

The application decides what happens next.

```text
LLM
→ Interpret / Generate

NestJS
→ Validate / Persist / Execute
```

This separation is the core Agent design rule for V1.
