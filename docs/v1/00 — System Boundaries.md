# 00 — System Boundaries

## 1. Purpose

This document defines the responsibilities and boundaries of each major part of Personal Assistant V1.

The main goal is to keep the system simple, understandable, and easy to evolve.

V1 should avoid mixing:

- UI logic
- business logic
- persistence logic
- LLM reasoning
- external side effects

Each concern should have a clear owner.

---

## 2. High-Level System

The V1 system contains four main parts:

```text
┌──────────────────────┐
│       Next.js        │
│      Frontend        │
└──────────┬───────────┘
           │
           │ HTTP
           ▼
┌──────────────────────┐
│       NestJS         │
│      Backend         │
└───────┬────────┬─────┘
        │        │
        │        │
        ▼        ▼
┌────────────┐  ┌──────────────┐
│ PostgreSQL │  │  LangChain   │
│ + Drizzle  │  │      ↓       │
└────────────┘  │    OpenAI    │
                └──────────────┘
```

The browser communicates only with NestJS for application operations.

NestJS coordinates:

- database access
- LLM calls
- business rules
- external side effects

---

## 3. Frontend Boundary — Next.js

Next.js owns the user interface.

Its responsibilities include:

- rendering the interaction timeline
- rendering user messages
- rendering assistant messages
- rendering Event Cards
- rendering Email Cards
- form editing
- client-side validation
- loading states
- error display
- submitting user actions to NestJS
- replaying persisted interactions returned by the backend

The frontend should focus on:

> **presentation and interaction**

It should not become the authoritative source of business state.

---

## 4. What Next.js Must Not Own

Next.js must not be responsible for:

- deciding whether an Event is valid
- deciding whether an Event can be confirmed
- creating final Event records directly
- sending emails directly
- calling OpenAI directly from the browser
- performing authoritative timezone conversion
- deciding legal state transitions
- storing the only copy of interaction history

For example, the frontend may disable a Confirm button when the title is missing.

However, NestJS must still validate the same rule.

```text
Frontend validation
= better UX

Backend validation
= system correctness
```

---

## 5. Backend Boundary — NestJS

NestJS is the authoritative application layer.

It coordinates the application workflow.

Its responsibilities include:

- exposing HTTP APIs
- validating incoming requests
- invoking LLM capabilities
- validating LLM outputs
- managing Event Draft state
- managing Email Draft state
- confirming Events
- rejecting Events
- confirming emails
- rejecting emails
- performing timezone conversion
- writing business data
- writing interaction history
- executing transactions
- handling errors
- calling external email services

NestJS is the main place where application rules live.

---

## 6. NestJS as the Coordinator

A typical request should flow through NestJS like this:

```text
User Action
    ↓
Next.js
    ↓
NestJS
    ↓
Validation
    ↓
Application Logic
    ↓
Database / LLM / External Service
    ↓
Application Response
    ↓
Next.js
```

NestJS should not simply act as a proxy between the frontend and OpenAI.

It should actively control the application workflow.

---

## 7. Database Boundary — PostgreSQL

PostgreSQL is the persistent source of truth.

It stores three different categories of state.

### 7.1 Historical State

Historical state describes what happened.

Examples:

- User Message
- Assistant Message
- Event Card
- Event Edit
- Event Confirm
- Event Reject
- Email Card
- Email Edit
- Email Confirm
- Email Reject

Historical interaction records should generally be append-only.

---

### 7.2 Working State

Working state represents editable data.

Examples:

```text
Event Draft
Email Draft
```

This state changes when the user edits a Card.

For example:

```text
Initial Event Draft
Start: 15:00

↓

User Edit

↓

Current Event Draft
Start: 16:00
```

---

### 7.3 Final Business State

Final state represents confirmed business results.

Examples:

```text
Event
Email
```

These records should only be created after the required human confirmation.

---

## 8. Drizzle Boundary

Drizzle is the database access layer.

Its role is to provide:

- database schema definitions
- type-safe queries
- migrations
- mappings between TypeScript and PostgreSQL

Conceptually:

```text
NestJS Application Logic
        ↓
     Drizzle
        ↓
   PostgreSQL
```

Drizzle should not contain business decisions.

For example, this rule:

```text
A rejected Event Draft cannot be confirmed.
```

belongs to application/domain logic, not to Drizzle.

Database constraints may reinforce important invariants, but they do not replace business logic.

---

## 9. LLM Boundary

The LLM is an intelligent interpretation component.

It is not the application controller.

The LLM is responsible for tasks where ambiguity exists.

Examples:

- understanding user intent
- extracting Event information
- interpreting natural-language dates
- identifying locations
- generating natural-language responses
- generating email content

The LLM should return structured information to the application.

---

## 10. LLM Responsibilities

For an input such as:

```text
I have a project meeting at Ericsson tomorrow at 3 PM.
```

the LLM may determine:

```text
Intent:
Event creation

Title:
Project Meeting

Start Date:
2026-08-20

Start Time:
15:00

Location:
Ericsson
```

The LLM performs semantic interpretation.

It does not create the Event itself.

---

## 11. What the LLM Must Not Own

The LLM must not be responsible for:

- inserting database records
- confirming an Event
- rejecting an Event
- sending email
- deciding whether a user has permission
- generating database IDs
- managing transactions
- performing authoritative timezone conversion
- enforcing required fields
- enforcing state transitions

For example:

```text
LLM:
"This Event looks correct."
```

must never mean:

```text
Event automatically created.
```

Only explicit user confirmation triggers the real action.

---

## 12. Core Rule

The architecture follows this principle:

> **LLM handles ambiguity. Application code handles certainty.**

Examples:

| Problem                                 | Owner                       |
| --------------------------------------- | --------------------------- |
| Does this message describe an Event?    | LLM                         |
| What does "tomorrow afternoon" mean?    | LLM + supplied date context |
| Is the title missing?                   | Application                 |
| Is the timezone valid?                  | Application                 |
| Is end time after start time?           | Application                 |
| Can this Draft still be confirmed?      | Application                 |
| Should the database transaction commit? | Application                 |
| Should an email be sent?                | User + Application          |

---

## 13. LangChain Boundary

LangChain is the integration layer between NestJS and OpenAI.

Conceptually:

```text
NestJS
   ↓
LangChain
   ↓
OpenAI
```

V1 uses LangChain primarily for:

- model configuration
- prompt execution
- structured output
- Zod-compatible schemas
- model abstraction

LangChain does not own the overall application workflow.

---

## 14. Why LangGraph Is Not Used in V1

The current workflows are simple and mostly deterministic.

Event flow:

```text
User Message
    ↓
LLM Extraction
    ↓
Event Card
    ↓
Human Action
    ↓
Application Command
```

Email flow:

```text
Confirmed Event
    ↓
Email Generation
    ↓
Email Card
    ↓
Human Action
    ↓
Application Command
```

These flows do not currently require a graph runtime.

Using LangGraph now would introduce concepts such as:

- graph state
- nodes
- edges
- checkpoints
- interrupts

without a strong product requirement.

V1 should therefore use ordinary application logic.

---

## 15. When LangGraph May Become Useful Later

LangGraph may be introduced when requirements become more complex.

Examples:

```text
Multiple agent branches
Long-running workflows
Agent pause/resume
Tool loops
Multi-agent coordination
Complex conditional routing
Persistent agent execution state
```

For example:

```text
Supervisor
   ├── Calendar Agent
   ├── Email Agent
   ├── Knowledge Agent
   └── Task Agent
```

That may justify graph orchestration.

V1 does not.

---

## 16. Human-in-the-Loop Boundary

Human confirmation separates proposed actions from real side effects.

The LLM may propose:

```text
Event Card
```

but only the user can trigger:

```text
Create Event
```

Similarly:

```text
LLM
→ Email Draft

User
→ Confirm

Application
→ Send Email
```

This means the system distinguishes:

```text
Proposal
≠
Action
```

---

## 17. Event Domain Boundary

The Event domain conceptually owns:

- Event Draft
- Event validation
- Event editing
- Event confirmation
- Event rejection
- final Event

The Event Agent only helps produce the initial Draft.

Conceptually:

```text
Event Agent
    ↓
Event Draft
    ↓
Event Domain Logic
    ↓
Event
```

---

## 18. Email Domain Boundary

The Email domain conceptually owns:

- Email Draft
- Email editing
- Email confirmation
- Email rejection
- email delivery
- email delivery result

The Email Agent helps generate:

- subject
- body

It does not control delivery.

Conceptually:

```text
Confirmed Event
      ↓
Email Agent
      ↓
Email Draft
      ↓
Email Domain Logic
      ↓
Email Provider
```

---

## 19. Interaction History Boundary

Interaction history is independent from Event and Email business state.

Example:

```text
Assistant proposed:
15:00

User changed:
16:00

User confirmed.
```

The Event table only needs the final value:

```text
16:00
```

The interaction history preserves:

```text
15:00
→ Edit
→ 16:00
→ Confirm
```

This separation is required for accurate replay.

---

## 20. One Persistent Conversation

V1 has one persistent interaction stream per user.

Conceptually:

```text
User
   ↓
Persistent Assistant Timeline
   ├── Message
   ├── Message
   ├── Event Card
   ├── Event Edit
   ├── Event Confirm
   ├── Email Card
   └── Email Reject
```

No conversation management system is required yet.

Therefore V1 does not need:

```text
conversationId
conversation list
conversation creation
conversation switching
```

If the product later introduces multiple conversations, this boundary can evolve.

---

## 21. Request Boundary Example — Normal Message

```text
User enters message
      ↓
Next.js
      ↓
POST /messages
      ↓
NestJS validates request
      ↓
Persist User Message
      ↓
Call Event Agent
      ↓
No Event detected
      ↓
Persist Assistant Message
      ↓
Return response
      ↓
Next.js renders response
```

---

## 22. Request Boundary Example — Event Message

```text
User enters:
"Meeting tomorrow at 3 PM"

      ↓
Next.js

      ↓
NestJS

      ↓
Persist User Message

      ↓
Event Agent

      ↓
Structured Event Data

      ↓
Application validates output

      ↓
Create Event Draft

      ↓
Persist Event Card interaction

      ↓
Return Event Card

      ↓
Next.js renders Event Card
```

No Event exists yet.

---

## 23. Event Confirmation Boundary

```text
User clicks Confirm
      ↓
Next.js
      ↓
NestJS
      ↓
Load Event Draft
      ↓
Validate Draft
      ↓
Validate state
      ↓
Convert local time + timezone
      ↓
Database transaction
      ├── Create Event
      ├── Mark Draft CONFIRMED
      └── Persist EVENT_CONFIRM
      ↓
Return result
      ↓
Next.js renders confirmed state
```

The LLM is not involved in this operation.

---

## 24. Email Generation Boundary

```text
User clicks:
Create Email Reminder

      ↓
Next.js
      ↓
NestJS
      ↓
Load confirmed Event
      ↓
Email Agent
      ↓
Generated subject/body
      ↓
Create Email Draft
      ↓
Persist Email Card
      ↓
Return Email Card
```

The Email Agent receives confirmed Event data rather than the original user message.

---

## 25. External Side Effects

V1 currently has one important external side effect:

```text
Send Email
```

External side effects should always go through NestJS.

Conceptually:

```text
User Confirm
      ↓
NestJS
      ↓
Email Provider
```

Next.js should never call the email provider directly.

---

## 26. Secrets Boundary

Secrets must remain server-side.

Examples:

```text
OPENAI_API_KEY
DATABASE_URL
EMAIL_PROVIDER_API_KEY
```

They must not be exposed to the browser.

The frontend should only receive data necessary for rendering and interaction.

---

## 27. Error Boundary

Errors should be converted into application-level errors before reaching the frontend.

For example:

```text
OpenAI Rate Limit
      ↓
LangChain error
      ↓
NestJS maps error
      ↓
LLM_REQUEST_FAILED
      ↓
Frontend displays appropriate message
```

The frontend should not need to understand provider-specific errors.

---

## 28. State Ownership Summary

| State                  | Owner               |
| ---------------------- | ------------------- |
| Message input field    | Next.js             |
| Editing mode           | Next.js             |
| Loading indicator      | Next.js             |
| Historical interaction | PostgreSQL          |
| Event Draft            | NestJS + PostgreSQL |
| Email Draft            | NestJS + PostgreSQL |
| Final Event            | NestJS + PostgreSQL |
| Final Email            | NestJS + PostgreSQL |
| Event interpretation   | LLM                 |
| Email generation       | LLM                 |
| Event confirmation     | NestJS              |
| Email sending          | NestJS              |
| Timezone conversion    | NestJS              |

---

## 29. Main Architectural Direction

The V1 architecture should remain:

```text
Simple UI
   ↓
Clear Backend API
   ↓
Explicit Application Logic
   ↓
Reliable Persistence
   ↓
LLM only where semantic reasoning is needed
```

Avoid turning the system into:

```text
User
↓
Huge Agent
↓
Everything
```

The Personal Assistant may become more agentic over time, but the underlying application should remain understandable and deterministic wherever possible.

---

## 30. V1 Boundary Summary

The final responsibility split is:

```text
Next.js
→ presentation and user interaction

NestJS
→ application workflow and business rules

Zod
→ runtime validation boundaries

LangChain
→ LLM integration

OpenAI
→ semantic reasoning and generation

Drizzle
→ type-safe database access

PostgreSQL
→ persistent source of truth
```

This separation forms the technical foundation for the rest of V1.
