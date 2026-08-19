# 15 — Project Structure

## 1. Goal

Keep the codebase simple and make frontend, backend, database, and Agent responsibilities easy to locate.

Recommended monorepo:

```text
personal-assistant/

├── apps/
│   ├── web/
│   └── api/
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 2. Frontend

```text
apps/web/

├── app/
├── components/
├── features/
├── lib/
└── types/
```

### `app/`

Next.js routes and layouts.

```text
app/
├── layout.tsx
└── page.tsx
```

V1 only needs one main Assistant page.

### `components/`

Generic reusable UI components.

Examples:

```text
Button
Input
Textarea
LoadingIndicator
```

### `features/`

Feature-specific UI.

```text
features/

├── assistant/
├── event/
└── email/
```

Example:

```text
features/event/

├── EventCard.tsx
└── EventForm.tsx
```

### `lib/`

Infrastructure helpers.

Examples:

```text
API client
configuration helpers
```

Avoid putting business logic here.

---

## 3. Backend

Recommended NestJS structure:

```text
apps/api/src/

├── app.module.ts
├── main.ts

├── database/
├── users/
├── messages/
├── events/
├── emails/
└── agents/
```

Each folder represents a clear application responsibility.

---

## 4. Database Module

```text
database/

├── schema/
├── database.module.ts
└── database.service.ts
```

Schema:

```text
schema/

├── users.ts
├── messages.ts
├── event-drafts.ts
├── events.ts
├── email-drafts.ts
└── emails.ts
```

Database code should only handle persistence concerns.

---

## 5. Messages Module

```text
messages/

├── messages.controller.ts
├── messages.service.ts
├── messages.schema.ts
└── messages.module.ts
```

Responsibilities:

```text
Submit user message
Persist interactions
Read interaction history
```

---

## 6. Events Module

```text
events/

├── events.controller.ts
├── events.service.ts
├── events.schema.ts
└── events.module.ts
```

Responsibilities:

```text
Event Draft
Event Edit
Event Confirm
Event Reject
Final Event
```

The Event Agent itself does not belong here.

---

## 7. Emails Module

```text
emails/

├── emails.controller.ts
├── emails.service.ts
├── emails.schema.ts
└── emails.module.ts
```

Responsibilities:

```text
Email Draft
Email Edit
Email Confirm
Email Reject
Email Delivery
```

---

## 8. Agents Module

```text
agents/

├── event-agent/
│   ├── event-agent.service.ts
│   ├── event-agent.schema.ts
│   └── event-agent.prompt.ts
│
├── email-agent/
│   ├── email-agent.service.ts
│   ├── email-agent.schema.ts
│   └── email-agent.prompt.ts
│
└── agents.module.ts
```

Responsibilities:

```text
LangChain
OpenAI
Prompts
Structured LLM Output
```

Agents should not directly access the database.

For example:

```text
EventAgentService
→ returns EventAgentResult
```

Then:

```text
MessagesService / EventsService
→ decides what to persist
```

---

## 9. Dependency Direction

Prefer:

```text
Controller
    ↓
Service
    ↓
Database / Agent / External Provider
```

For example:

```text
MessagesController
      ↓
MessagesService
      ↓
EventAgentService
      ↓
OpenAI
```

and:

```text
EventsController
      ↓
EventsService
      ↓
Database
```

Avoid:

```text
Agent
→ Controller
```

or:

```text
Frontend
→ OpenAI
```

---

## 10. Shared Types

Do not create a large shared package immediately.

Initially, frontend and backend contracts can remain close to their respective features.

If duplicated API types later become difficult to maintain, introduce:

```text
packages/contracts
```

at that point.

Do not add it before there is a real need.

---

## 11. Final Structure

A likely V1 structure is:

```text
personal-assistant/

├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── assistant/
│   │   │   ├── event/
│   │   │   └── email/
│   │   └── lib/
│   │
│   └── api/
│       └── src/
│           ├── database/
│           ├── users/
│           ├── messages/
│           ├── events/
│           ├── emails/
│           └── agents/
│               ├── event-agent/
│               └── email-agent/
│
├── package.json
└── pnpm-workspace.yaml
```

---

## 12. Core Rule

> Organize code by responsibility and product domain, not by framework abstraction alone.

The structure should remain simple enough that you can immediately answer:

```text
Where is Event business logic?
Where is Event LLM logic?
Where is Event persistence?
Where is Event UI?
```

without searching through the whole codebase.
