# Backend Production Readiness Plan

This document tracks non-business capabilities needed to operate the LifeInbox
NestJS API safely and reliably. It is a future plan, not authorization to
implement every item immediately.

The shared response envelope, request IDs, safe exception filter, and initial
application-error mapping are implemented. The remaining items are still future
work.

Implement these concerns as small, approved vertical slices. Do not add
infrastructure such as Redis, queues, distributed locks, or tracing platforms
without a concrete requirement and failure scenario.

## Existing foundation

The API already has:

- API-owned, validated environment loading;
- global request validation through `ZodValidationPipe`;
- PostgreSQL access through Drizzle and committed migrations;
- graceful database shutdown;
- a basic `GET /api/health` endpoint;
- deterministic model doubles for normal Agent tests;
- a shared success/error envelope and request IDs;
- safe mapping for validation and typed service-unavailable errors.

## Priority 1: Required before public exposure

### Consistent error handling foundation

- Keep the global NestJS exception filter and stable public error envelope.
- Map request validation, domain, database, and external-service failures at
  explicit boundaries.
- Do not expose SQL errors, stack traces, internal provider details, or secrets.
- Propagate the same request ID through the `x-request-id` response header and
  logs; keep the JSON envelope limited to `code`, `data`, and `message`.

### Structured logging

- Emit structured JSON logs in production.
- Assign a request or correlation ID to every request.
- Record route, HTTP status, duration, and important failure categories.
- Redact credentials, tokens, message content, prompts, and personal data.
- Avoid logging complete request and response bodies by default.

### Authentication and authorization

- Establish authenticated identity at the backend.
- Scope messages, Event Drafts, and Events to their owner.
- Enforce authorization for every read and state transition.
- Never trust ownership, roles, statuses, or authorization decisions supplied by
  a client or an LLM.
- Until authentication exists, any development identity must be assigned by
  backend code rather than accepted from the request.

### HTTP security boundaries

- Configure an explicit CORS allowlist.
- Add appropriate security headers.
- Set request-body size limits.
- Rate-limit message and Agent endpoints based on a defined abuse scenario.
- Use secure production defaults while preserving documented local-development
  behavior.

### Operational health checks

Separate health checks by purpose:

- **Liveness:** confirms that the API process is running and not deadlocked.
- **Readiness:** confirms that the API can serve traffic, including required
  database connectivity.

Do not make liveness depend on a transient external dependency, because that can
cause unnecessary process restarts.

## Priority 2: Reliability and deployment

### Database safeguards

- Define connection-pool limits for each environment.
- Configure connection, query, and transaction timeouts.
- Keep authoritative constraints in PostgreSQL.
- Review migrations before deployment and run them as a controlled deployment
  step.
- Define backup, restore, and recovery procedures and test restoration.
- Consider retries, concurrency, and idempotency for every state-changing API.
- Keep external HTTP and LLM calls outside database transactions.

### LLM and external-service boundaries

- Define explicit request timeouts.
- Retry only failures that are safe and likely to be transient.
- Use bounded Agent loops with explicit stop conditions.
- Validate every model-proposed state transition in backend tools before
  persistence.
- Treat PostgreSQL and tool results as authoritative over model claims.
- Track provider latency, failure category, and token usage without recording
  sensitive prompts.
- Use deterministic mock models in normal tests; do not consume paid credits.

### Graceful deployment behavior

- Stop accepting new traffic during shutdown.
- Allow in-flight requests a bounded period to finish.
- Close database and external-client resources cleanly.
- Define migration failure and application rollback behavior.
- Verify container or hosting-platform liveness, readiness, and shutdown settings.

## Priority 3: Observability and maintenance

### Metrics and alerting

Consider collecting:

- request count, latency, and error rate;
- database connection-pool usage and saturation;
- database query failures and timeout rates;
- LLM latency, token usage, and failure rate;
- Agent loop termination reasons;
- important business state-transition failures.

Alert on user-visible symptoms and sustained failure rates rather than every
individual exception.

### API documentation and compatibility

- Generate or maintain OpenAPI documentation for public endpoints.
- Document request, response, and error contracts.
- Add API versioning only when a real compatibility requirement exists.
- Define deprecation behavior before changing established public contracts.

### CI quality gates

CI should run the commands actually defined by the affected package, including:

- lint;
- TypeScript type checking;
- focused and full tests as appropriate;
- production build;
- Drizzle migration consistency checks when schema code changes.

Use PostgreSQL-backed integration tests for database queries, transactions,
constraints, and migrations. Verify one important failure path proportionally to
each change.

### Data protection

- Store secrets in an approved secret manager and define rotation procedures.
- Use encryption in transit and at rest.
- Define retention and deletion behavior for user messages and model data.
- Minimize stored personal and model-provider data.
- Ensure logs and telemetry follow the same retention and redaction rules.

## Completed first infrastructure foundation

The first infrastructure slice established a **consistent error envelope with
request IDs and safe failure logging**.

### Outcome

Every request receives a request ID in the response header. Successful responses
and failures use the shared three-field envelope, and expected failures return a
stable numeric code without leaking internal details.

### Main invariant

The same request ID identifies the HTTP response header and all logs associated
with that request.

### Important failure experiment

Trigger a known validation or database-boundary failure and verify that:

1. the response follows the public error contract;
2. the response does not expose a stack trace, SQL, or secrets;
3. the `x-request-id` response header matches the structured error log;
4. the failure is categorized without logging sensitive request content.

### Non-goals

This slice should not add distributed tracing, a remote log platform, Redis,
queues, authentication, or a generic observability framework.
