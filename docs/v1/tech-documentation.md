# Personal Assistant V1 — Technical Documentation

## 1. Project Overview

This project is a Personal Assistant built as a learning-oriented but production-minded application.

The main goals are to systematically practice:

- Backend engineering
- LLM application development
- Human-in-the-loop workflows
- Persistent interaction history
- External API integration
- Reliable state management

V1 intentionally keeps the product scope small.

The first version contains only:

- Event Agent
- Email Agent
- Persistent interaction history

More advanced capabilities such as memory, RAG, and multi-agent collaboration are deferred until later versions.

---

## 2. Technology Stack

### Frontend

```text
Next.js
TypeScript
Zod
```

The frontend uses Next.js with the App Router.

Its primary responsibilities are:

- Rendering the assistant timeline
- Rendering Event Cards
- Rendering Email Cards
- Form editing
- Client-side validation
- Loading and error states
- Calling the backend API

---

### Backend

```text
NestJS
TypeScript
Zod
LangChain
OpenAI
```

NestJS is the authoritative application layer.

It is responsible for:

- API endpoints
- Business logic
- Validation
- State transitions
- Database persistence
- LLM calls
- Timezone handling
- External side effects
- Error handling

---

### LLM Layer

```text
LangChain
+
OpenAI
```

OpenAI is the LLM provider.

LangChain is used as the integration and orchestration layer for model interactions.

V1 mainly uses LangChain for:

- Model invocation
- Structured output
- Prompt management
- LLM abstraction

LangGraph is intentionally not used in V1.

---

### Validation

```text
Zod
```

Zod is used to define and validate structured data at important boundaries.

Examples include:

- HTTP request payloads
- LLM structured output
- Form contracts
- Domain input

---

### Database

```text
PostgreSQL
Drizzle ORM
Drizzle Kit
```

PostgreSQL is the primary database.

Drizzle ORM is used for:

- Schema definition
- Database queries
- Type-safe database access

Drizzle Kit is used for:

- Migration generation
- Migration management

---

## 3. V1 Product Capabilities

### 3.1 Event Agent

The Event Agent handles natural-language Event extraction.

Example:

```text
User:
Meeting at Ericsson tomorrow at 3 PM.
```

The system produces:

```text
Event Card

Title
Project Meeting

Date
Aug 20, 2026

Start
15:00

Location
Ericsson

Timezone
Europe/Stockholm
```

The user can:

```text
Confirm
Edit
Reject
```

---

### 3.2 Email Agent

After an Event is confirmed, the user may optionally create an Email Reminder.

```text
Confirmed Event
      ↓
Create Email Reminder
      ↓
Email Agent
      ↓
Email Card
```

The Email Card supports:

```text
Confirm
Edit
Reject
```

---

### 3.3 Persistent Interaction History

The application stores the complete interaction timeline.

This includes:

```text
User Messages
Assistant Messages

Event Cards
Event Edits
Event Confirmations
Event Rejections

Email Cards
Email Edits
Email Confirmations
Email Rejections
```

Refreshing or reopening the application must reconstruct the previous interaction history.

---

## 4. Core Engineering Principle

The most important architectural principle in V1 is:

> **LLM handles ambiguity. Application code handles certainty.**

---

### LLM Responsibilities

The LLM may handle:

- Intent detection
- Natural-language understanding
- Event information extraction
- Relative-date interpretation
- Natural-language response generation
- Email subject generation
- Email body generation

---

### Application Responsibilities

Application code must handle:

- Required-field validation
- State transitions
- Timezone conversion
- Database writes
- Transactions
- Event creation
- Email sending
- Authorization
- Idempotency
- Error handling

The LLM must never directly control confirmed business state.

---

## 5. Human-in-the-Loop Principle

Any action with a real side effect requires explicit user confirmation.

### Event

```text
LLM proposes Event
      ↓
Event Card
      ↓
User Confirm
      ↓
Create Event
```

The LLM cannot create an Event by itself.

---

### Email

```text
LLM generates Email Draft
      ↓
Email Card
      ↓
User Confirm
      ↓
Send Email
```

The LLM cannot send an email by itself.

---

## 6. Conversation Model

V1 uses:

> **One persistent conversation per user.**

There is no concept of multiple chat threads in V1.

Conceptually:

```text
User
 └── Personal Assistant
      ├── Message
      ├── Message
      ├── Event Card
      ├── Event Edit
      ├── Event Confirm
      ├── Message
      ├── Email Card
      └── Email Reject
```

This persistent interaction stream is the main user experience.

---

## 7. State Categories

V1 distinguishes three important categories of state.

### 7.1 Historical State

Represents what happened.

Examples:

```text
User Message
Event Card
Event Edit
Event Confirm
Email Reject
```

Historical interaction data should generally be append-only.

---

### 7.2 Working State

Represents data that is still editable.

Examples:

```text
Event Draft
Email Draft
```

Working state may change as the user edits a Card.

---

### 7.3 Final Business State

Represents confirmed results.

Examples:

```text
Event
Email
```

This state should only be created after successful user confirmation.

---

## 8. High-Level System

```text
┌──────────────────────┐
│       Next.js        │
│          UI          │
└──────────┬───────────┘
           │
           │ HTTP
           ▼
┌──────────────────────┐
│       NestJS         │
│   Application Layer  │
└──────────┬───────────┘
           │
      ┌────┴────┐
      │         │
      ▼         ▼
PostgreSQL   LangChain
 + Drizzle       │
                 ▼
               OpenAI
```

NestJS sits between the UI, database, and LLM provider.

---

## 9. V1 Development Phases

The project should be implemented incrementally.

### Phase 0 — Project Bootstrap

Set up:

```text
Next.js
NestJS
PostgreSQL
Drizzle
Environment configuration
```

---

### Phase 1 — Persistent Interaction Timeline

Build:

```text
User Message persistence
Assistant Message persistence
Timeline API
Timeline UI
Replay after refresh
```

No LLM integration is required yet.

---

### Phase 2 — Event Agent Extraction

Add:

```text
LangChain
OpenAI
Structured Output
Event Intent Detection
Event Extraction
Event Card
```

---

### Phase 3 — Event Human-in-the-Loop

Add:

```text
Event Draft
Event Edit
Event Confirm
Event Reject
Final Event
Timezone conversion
```

---

### Phase 4 — Email Agent

Add:

```text
Email Draft generation
Email Card
Email Edit
Email Reject
```

---

### Phase 5 — Email Delivery

Add:

```text
Email Confirm
Real email provider
Delivery result
Failure handling
```

---

### Phase 6 — Hardening

Improve:

```text
Pagination
Idempotency
Draft versioning
Integration tests
Logging
Timeout handling
Error mapping
```

---

### Phase 7 — V1 Completion Review

Verify the complete flow end to end.

---

## 10. Learning Strategy

The project should not be developed by generating the entire application at once.

Avoid this workflow:

```text
Ask AI to generate project
        ↓
Copy all code
        ↓
Run project
```

Instead use:

```text
Understand one problem
        ↓
Design the solution
        ↓
Implement one small step
        ↓
Run it
        ↓
Observe the behavior
        ↓
Debug
        ↓
Understand the result
        ↓
Continue
```

AI can be used for:

- Concept explanation
- Architecture discussion
- Implementation guidance
- Code review
- Debugging
- Providing complete code for the current small step when useful

The implementation should still be performed and understood incrementally.

---

## 11. Development Rule

Do not introduce infrastructure only because it is commonly used in backend systems.

For V1, avoid adding:

```text
Redis
BullMQ
Kafka
Microservices
Vector Database
LangGraph
WebSockets
Complex event buses
```

unless a concrete product requirement requires them.

The project should evolve from product needs rather than from a technology checklist.

---

## 12. Out of Scope for V1

The following features are explicitly excluded:

- Memory
- Semantic Memory
- Episodic Memory
- RAG
- Document Upload
- Personal Knowledge Base
- Vector Database
- Multi-Agent Collaboration
- Supervisor Agent
- LangGraph Workflows
- Task Management
- Recurring Events
- Complex Reminder Rules
- Scheduled Email Delivery
- Proactive Agent Actions
- Multiple Conversations

---

## 13. Documentation Structure

The documentation is organized as:

```text
product-scope.md

README.md

00-system-boundaries.md

01-data-model.md

02-api-contracts.md

03-agent-llm-contracts.md

04-frontend-interaction-and-replay.md

05-implementation-roadmap.md

06-engineering-rules.md
```

Recommended reading order:

```text
Product Scope
    ↓
System Boundaries
    ↓
Data Model
    ↓
API Contracts
    ↓
Agent / LLM Contracts
    ↓
Frontend Interaction
    ↓
Implementation Roadmap
    ↓
Engineering Rules
```

---

## 14. V1 Completion Goal

The full V1 flow should eventually work as:

```text
User enters natural-language text
        ↓
Message is persisted
        ↓
Event Agent interprets message
        ↓
Event Card is displayed
        ↓
User edits / confirms / rejects
        ↓
Confirmed Event is created
        ↓
User optionally requests Email Reminder
        ↓
Email Agent generates Email Card
        ↓
User edits / confirms / rejects
        ↓
Email is sent
        ↓
Application is reopened
        ↓
Complete interaction history is replayed
```

The goal of V1 is to build a reliable foundation for future Agent capabilities without prematurely introducing unnecessary complexity.
