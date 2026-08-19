# 08 — Phase 1: Persistent Interaction Timeline

## 1. Goal

Build the first real product capability:

> Persist and replay the complete assistant interaction timeline.

No LLM is required in this phase.

Use a deterministic assistant response so the persistence flow can be developed independently.

---

## 2. Scope

Implement:

```text
User Message
→ NestJS
→ PostgreSQL
→ Assistant Placeholder Response
→ PostgreSQL
→ Next.js Timeline
```

After a browser refresh, the same history must still be visible.

---

## 3. Database Tables

Create:

```text
users
messages
```

### `users`

```text
id
email
timezone
created_at
updated_at
```

### `messages`

```text
id
user_id

role
kind

content
payload
target_id

created_at
```

For Phase 1, only this message kind is required:

```text
TEXT
```

---

## 4. Initial User

Authentication is out of scope.

Use one fixed development user.

Example:

```text
id:
dev-user

email:
user@example.com

timezone:
Europe/Stockholm
```

The implementation should still use `user_id` so authentication can be added later without redesigning the core tables.

---

## 5. Submit Message API

Implement:

```http
POST /messages
```

Request:

```json
{
  "content": "Hello"
}
```

Backend flow:

```text
Validate request
→ Persist User TEXT message
→ Generate placeholder Assistant response
→ Persist Assistant TEXT message
→ Return both
```

Temporary response example:

```text
Received: Hello
```

Do not call OpenAI yet.

---

## 6. Get History API

Implement:

```http
GET /messages
```

Return all messages for the current development user ordered by:

```text
created_at ASC
```

Example response:

```json
[
  {
    "id": "msg_1",
    "role": "user",
    "kind": "TEXT",
    "content": "Hello",
    "createdAt": "2026-08-19T15:00:00Z"
  },
  {
    "id": "msg_2",
    "role": "assistant",
    "kind": "TEXT",
    "content": "Received: Hello",
    "createdAt": "2026-08-19T15:00:01Z"
  }
]
```

---

## 7. Next.js Timeline

The main page should contain:

```text
Message Timeline
+
Message Composer
```

Example:

```text
User
Hello

Assistant
Received: Hello

-------------------

[ Type a message... ] [Send]
```

The frontend does not need Event or Email Card support yet.

---

## 8. Submit Flow

When the user sends a message:

```text
User enters text
      ↓
POST /messages
      ↓
Backend persists both messages
      ↓
Frontend receives response
      ↓
Timeline updates
```

Avoid optimistic rendering initially.

Wait for the backend response before displaying the new persisted interaction.

---

## 9. Replay Flow

When the page loads:

```text
GET /messages
      ↓
Receive stored history
      ↓
Render messages
```

The timeline must not depend on previous React state.

The database is the source of truth.

---

## 10. Validation

Use Zod to validate the message request.

Minimum rule:

```text
content
→ required
→ non-empty string
```

The same request validation belongs in NestJS even if the frontend also prevents empty submission.

---

## 11. Failure Behavior

If message persistence fails:

```text
Do not display fake success.
```

If the assistant placeholder response fails after the user message has already been saved, preserve the user message.

This follows the V1 rule:

```text
Persist user input first.
```

---

## 12. Suggested Backend Responsibilities

Conceptually:

```text
MessagesController
      ↓
MessagesService
      ↓
Drizzle / PostgreSQL
```

The exact file structure will be decided during implementation.

This phase is about understanding the responsibility boundaries, not creating unnecessary abstractions.

---

## 13. Learning Focus

Phase 1 should teach:

- NestJS controller/service flow
- request validation with Zod
- Drizzle schema definitions
- PostgreSQL inserts and queries
- foreign keys
- database migrations
- Next.js API communication
- persistent UI replay
- backend/frontend state boundaries

---

## 14. Acceptance Criteria

Phase 1 is complete when:

- [ ] A development user exists
- [ ] `users` table exists
- [ ] `messages` table exists
- [ ] User can submit a text message
- [ ] User message is persisted
- [ ] Placeholder Assistant response is persisted
- [ ] Timeline displays both
- [ ] Refresh restores the same timeline
- [ ] Empty messages are rejected
- [ ] No LLM integration exists yet

---

## 15. Next Phase

After persistence and replay are reliable:

```text
Phase 2
Event Agent Extraction
```

The deterministic placeholder response will then be replaced by:

```text
User Message
      ↓
Event Agent
      ↓
Event Card
or
Assistant Text
```
