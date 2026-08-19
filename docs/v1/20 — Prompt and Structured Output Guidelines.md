# 20 — Prompt and Structured Output Guidelines

## 1. Goal

Prompts should remain small, focused, and version-controlled.

V1 uses two prompt responsibilities:

```text
Event extraction
Email generation
```

Avoid one large system prompt controlling the entire application.

---

## 2. Prompt Files

Recommended structure:

```text
agents/

├── event-agent/
│   ├── event-agent.prompt.ts
│   └── event-agent.schema.ts
│
└── email-agent/
    ├── email-agent.prompt.ts
    └── email-agent.schema.ts
```

Prompts and output schemas should remain close to the Agent that uses them.

---

## 3. Event Agent Prompt

The Event Agent should be instructed to:

- detect whether the user expresses an Event intent
- extract only information supported by the input
- resolve relative time using provided runtime context
- return `null` for missing fields
- avoid follow-up questions
- avoid inventing missing details
- avoid claiming that an Event was created

Example runtime context:

```text
Current time:
2026-08-19T15:57:00+02:00

User timezone:
Europe/Stockholm
```

---

## 4. Event Structured Output

Use Zod with LangChain structured output.

Conceptually:

```ts
{
  kind: "event" | "text",

  event?: {
    title: string | null;
    startAt: string | null;
    endAt: string | null;
    timezone: string | null;
    location: string | null;
    description: string | null;
  },

  response?: string
}
```

Application code should rely on this structure rather than parsing free-form model text.

---

## 5. Missing Information

Unknown values must remain explicit.

Good:

```json
{
  "title": null,
  "startAt": "2026-08-20T15:00:00",
  "endAt": null
}
```

Avoid:

```text
"Probably a meeting at around 3 PM."
```

The frontend needs predictable structured data.

---

## 6. Do Not Let the Prompt Encode Business Logic

The prompt should not decide:

```text
whether Confirm is allowed
whether Event should be persisted
whether email should be sent
whether end_at is valid
```

These are backend responsibilities.

The prompt only handles semantic interpretation.

---

## 7. Email Agent Prompt

The Email Agent receives confirmed Event data.

It should generate:

```text
subject
body
```

It should not determine:

```text
recipient
send status
delivery time
user approval
```

Example input:

```json
{
  "title": "Project Meeting",
  "startAt": "2026-08-20T15:00:00",
  "timezone": "Europe/Stockholm",
  "location": "Ericsson"
}
```

Example output:

```json
{
  "subject": "Project Meeting Reminder",
  "body": "You have a project meeting at Ericsson tomorrow at 3 PM."
}
```

---

## 8. Prompt Versioning

Use simple identifiers:

```text
event-extraction:v1
email-generation:v1
```

When behavior changes significantly:

```text
event-extraction:v2
```

This helps connect Agent behavior with logs and evaluation results.

---

## 9. Prompt Testing

Maintain representative examples.

For Event Agent:

```text
Meeting tomorrow at 3 PM.
```

```text
Remind me Friday at 10 AM.
```

```text
Meeting Friday at 3 PM London time.
```

```text
I had a good day today.
```

Check whether the structured output remains reasonable after prompt changes.

---

## 10. Avoid Over-Prompting

Do not fill the prompt with:

- database schema details
- API endpoint details
- frontend behavior
- transaction rules
- implementation architecture

The model only needs context relevant to its semantic task.

---

## 11. Core Principle

> **Prompt for interpretation, code for control.**

The Agent should produce structured proposals.

NestJS should validate those proposals and decide how the application behaves.
