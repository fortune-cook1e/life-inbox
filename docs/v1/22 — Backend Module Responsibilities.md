# 22 — Backend Module Responsibilities

## 1. Goal

Keep NestJS modules focused on clear product responsibilities.

Recommended V1 modules:

```text
UsersModule
MessagesModule
EventsModule
EmailsModule
AgentsModule
DatabaseModule
```

---

## 2. UsersModule

Owns user-level data.

Responsibilities:

```text
User profile
Default email
Default timezone
```

V1 does not require full authentication yet.

---

## 3. MessagesModule

Owns the persistent interaction timeline.

Responsibilities:

```text
Submit user message
Persist TEXT interactions
Read interaction history
Persist structured interactions
```

It coordinates the initial message flow:

```text
User Message
    ↓
MessagesModule
    ↓
Event Agent
```

If the Agent returns an Event, it coordinates creation of the Event Draft.

---

## 4. EventsModule

Owns Event business state.

Responsibilities:

```text
Event Draft creation
Event Draft editing
Event confirmation
Event rejection
Event validation
Final Event creation
```

Important rule:

> `EventsModule` owns Event state; `EventAgent` only produces an initial proposal.

---

## 5. EmailsModule

Owns Email business state and delivery.

Responsibilities:

```text
Email Draft creation
Email Draft editing
Email confirmation
Email rejection
Email delivery
Delivery result persistence
```

The Email Agent generates content, but `EmailsModule` decides whether anything is sent.

---

## 6. AgentsModule

Owns LLM integration.

Contains:

```text
Event Agent
Email Agent
```

Responsibilities:

```text
LangChain
OpenAI
Prompts
Structured output
Zod validation of LLM responses
```

Agents return data.

They should not directly modify business tables.

---

## 7. DatabaseModule

Owns PostgreSQL connectivity and Drizzle setup.

Responsibilities:

```text
Database connection
Drizzle client
Schema access
Database configuration
```

It should not contain Event or Email business rules.

---

## 8. Dependency Direction

Preferred dependency flow:

```text
Controller
    ↓
Application Service
    ↓
Agent / Database / External Provider
```

Example:

```text
MessagesController
        ↓
MessagesService
        ↓
EventAgentService
        ↓
OpenAI
```

Event confirmation:

```text
EventsController
      ↓
EventsService
      ↓
Database
```

Email delivery:

```text
EmailsController
      ↓
EmailsService
      ↓
Email Provider
```

---

## 9. Avoid Cross-Module Business Logic

Avoid putting Event logic inside:

```text
MessagesController
```

or Email delivery logic inside:

```text
EventAgentService
```

Instead:

```text
MessagesModule
→ coordinates message handling

EventsModule
→ owns Event state

EmailsModule
→ owns Email state

AgentsModule
→ owns LLM capabilities
```

---

## 10. Core Principle

> **Modules should be organized around product responsibilities, not around technical convenience.**

A developer should be able to answer immediately:

```text
Where is Event confirmation logic?
→ EventsModule

Where is Event extraction logic?
→ AgentsModule

Where is interaction history stored?
→ MessagesModule

Where is email delivery handled?
→ EmailsModule
```

This keeps V1 easy to understand and extend.
