# 07 — Phase 0: Project Bootstrap

## 1. Goal

Set up the basic development environment before implementing any Agent functionality.

At the end of this phase:

```text
Next.js
   ↓
NestJS
   ↓
PostgreSQL
```

must work end to end.

Do not integrate OpenAI yet.

---

## 2. Initial Project Structure

Recommended repository structure:

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

Where:

```text
apps/web
→ Next.js

apps/api
→ NestJS
```

A monorepo is recommended because both applications use TypeScript and belong to the same product.

---

## 3. Package Manager

Use:

```text
pnpm
```

with a workspace.

Initial workspace:

```yaml
packages:
  - "apps/*"
```

Avoid adding Turborepo initially.

The workspace itself is enough for V1.

---

## 4. Frontend Setup

Create the Next.js application under:

```text
apps/web
```

Use:

```text
Next.js
TypeScript
App Router
```

The frontend only needs a simple page initially.

Example goal:

```text
Personal Assistant
Backend Status: Connected
```

No Chat UI is required yet.

---

## 5. Backend Setup

Create the NestJS application under:

```text
apps/api
```

Initial backend responsibilities:

```text
Application startup
Environment configuration
Health endpoint
Database connection
```

Create a simple endpoint:

```http
GET /health
```

Expected response:

```json
{
  "status": "ok"
}
```

---

## 6. Environment Configuration

Backend environment variables should initially include:

```text
DATABASE_URL
PORT
```

Example:

```env
DATABASE_URL=postgresql://...
PORT=3001
```

OpenAI configuration is added later in Phase 2.

Do not add unused environment variables yet.

---

## 7. PostgreSQL

Run PostgreSQL locally.

For development, Docker is acceptable:

```text
PostgreSQL container
```

The backend should connect using:

```text
DATABASE_URL
```

Do not add Redis or any other database.

---

## 8. Drizzle Setup

Install and configure:

```text
drizzle-orm
drizzle-kit
pg
```

Drizzle should live in the NestJS application because the backend owns persistence.

Suggested location:

```text
apps/api/src/database/
```

Initial structure:

```text
database/

├── schema/
├── database.module.ts
└── database.service.ts
```

The exact implementation can be decided when coding.

---

## 9. First Database Migration

Do not create the complete V1 schema yet.

Create only the minimum schema required to prove that migrations work.

For example:

```text
users
```

Then run:

```text
Drizzle schema
→ Generate migration
→ Inspect SQL
→ Apply migration
```

Verify the table exists in PostgreSQL.

---

## 10. Frontend → Backend Connection

Configure Next.js to call:

```http
GET /health
```

from NestJS.

The browser should successfully display the backend status.

Conceptually:

```text
Next.js
   ↓
GET /health
   ↓
NestJS
   ↓
200 OK
```

---

## 11. CORS

During local development:

```text
Next.js
localhost:3000

NestJS
localhost:3001
```

NestJS must allow the frontend origin.

Keep the configuration explicit rather than allowing every origin permanently.

---

## 12. Phase 0 Acceptance Criteria

Phase 0 is complete when all of the following work:

- [ ] `pnpm` workspace is configured
- [ ] Next.js application starts
- [ ] NestJS application starts
- [ ] PostgreSQL starts
- [ ] NestJS connects to PostgreSQL
- [ ] Drizzle is configured
- [ ] First migration succeeds
- [ ] `GET /health` returns successfully
- [ ] Next.js can call `GET /health`
- [ ] Environment variables are not committed
- [ ] No OpenAI integration exists yet

---

## 13. Do Not Add Yet

Do not implement:

```text
Messages
Event Agent
Event Draft
Email Agent
OpenAI
LangChain
Authentication
Redis
Queues
Streaming
```

Phase 0 only establishes the development foundation.

---

## 14. Next Phase

After Phase 0 is stable:

```text
Phase 1
Persistent Interaction Timeline
```

The first real product feature will be:

```text
User submits text
→ NestJS persists it
→ Assistant response is persisted
→ Next.js renders history
→ Refresh preserves everything
```
