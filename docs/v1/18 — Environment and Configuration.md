# 18 — Environment and Configuration

## 1. Goal

Keep environment-specific values outside application code.

V1 should separate:

```text
Local Development
Test
Production
```

without changing business logic.

---

## 2. Backend Environment Variables

Initial NestJS configuration:

```env
PORT=3001

DATABASE_URL=postgresql://...

OPENAI_API_KEY=...
OPENAI_MODEL=...

EMAIL_PROVIDER_API_KEY=...
EMAIL_FROM_ADDRESS=...
```

Only add variables when the related feature is implemented.

For example:

```text
Phase 0
→ DATABASE_URL

Phase 2
→ OPENAI_API_KEY
→ OPENAI_MODEL

Phase 5
→ Email provider configuration
```

---

## 3. Frontend Environment Variables

Next.js should only receive configuration that is safe to expose to the browser.

Example:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

Anything prefixed with:

```text
NEXT_PUBLIC_
```

should be treated as public.

Never expose:

```text
OPENAI_API_KEY
DATABASE_URL
EMAIL_PROVIDER_API_KEY
```

to the frontend.

---

## 4. Configuration Ownership

Use this rule:

```text
Browser-safe configuration
→ Next.js

Secrets and backend configuration
→ NestJS
```

Next.js should call NestJS.

It should never call OpenAI or the email provider using secret credentials.

---

## 5. Configuration Validation

NestJS should validate required configuration during startup.

For example, if Phase 2 requires:

```text
OPENAI_API_KEY
OPENAI_MODEL
```

and one is missing:

```text
Application startup
→ fail immediately
```

Prefer this over discovering the problem when the first user request arrives.

Zod can be used for environment validation.

---

## 6. Local Environment Files

Recommended:

```text
apps/web/.env.local

apps/api/.env
```

These files should not be committed.

Provide example files instead:

```text
apps/web/.env.example

apps/api/.env.example
```

Example backend file:

```env
PORT=3001
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM_ADDRESS=
```

---

## 7. Database Configuration

Use one connection string:

```text
DATABASE_URL
```

Example:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/personal_assistant
```

Drizzle and NestJS should use the same database configuration source.

Avoid duplicating:

```text
DB_HOST
DB_PORT
DB_USERNAME
DB_PASSWORD
DB_NAME
```

unless there is a concrete reason.

---

## 8. OpenAI Configuration

The model should be configurable:

```env
OPENAI_MODEL=...
```

Application code should depend on:

```text
configured model
```

rather than a hard-coded model name.

Conceptually:

```text
Configuration
     ↓
EventAgentService
EmailAgentService
```

---

## 9. Email Provider Configuration

The exact provider is chosen in Phase 5.

The rest of the application should only need configuration such as:

```text
EMAIL_PROVIDER_API_KEY
EMAIL_FROM_ADDRESS
```

Provider-specific configuration should stay inside the email infrastructure layer.

---

## 10. Local Development Ports

Recommended initial ports:

```text
Next.js
localhost:3000

NestJS
localhost:3001

PostgreSQL
localhost:5432
```

The exact values are not important.

Consistency is.

---

## 11. CORS

NestJS should allow the local frontend origin:

```text
http://localhost:3000
```

Conceptually:

```text
Allowed Frontend Origins
→ Configuration
```

Avoid permanently using:

```text
allow all origins
```

outside simple local experiments.

---

## 12. Environment Separation

Later environments may look like:

```text
development
test
production
```

Each environment may use different:

```text
DATABASE_URL
OPENAI_MODEL
Email Provider Credentials
API Base URL
```

Application behavior should remain the same.

---

## 13. Test Configuration

Automated tests should use isolated configuration.

For example:

```text
Test PostgreSQL database
Mock Event Agent
Mock Email Agent
Mock Email Provider
```

Tests should not accidentally:

```text
send real email
call production database
use production secrets
```

---

## 14. Git Rules

Never commit:

```text
.env
.env.local
API keys
Database passwords
Provider credentials
```

Commit:

```text
.env.example
```

with empty or safe placeholder values.

---

## 15. Core Principle

> **Configuration changes between environments; application logic should not.**

The same codebase should be able to run against different:

```text
Databases
LLM models
Email providers
Deployment environments
```

through configuration rather than code changes.
