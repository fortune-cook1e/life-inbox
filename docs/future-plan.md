# Future Plan

This file is a lightweight list of deferred work. It is not an approved
roadmap, implementation authorization, or production-readiness claim. Most
items remain optional until promoted into a canonical roadmap or Feature Brief.
The items under **Before public production use** are different: they become
mandatory gates if public production use is approved.

## Product and Agent completion

- Complete durable Agent HITL and resume after the current deployment focus.
- Finish and verify the frontend timezone and end-to-end Event workflow.
- Review V1 completion against the canonical product acceptance criteria.
- Keep Email, memory, RAG, recurring Events, multiple conversations, and
  multi-agent behavior unplanned until a concrete product requirement exists.

## Before public production use

- Add authenticated identity and backend authorization for every read and state
  transition.
- Restrict CORS, add appropriate security headers and body limits, and define
  rate limits from an abuse scenario.
- Add structured, redacted production logging with request correlation.
- Separate liveness from database-backed readiness.
- Define database pool and timeout limits, backup and restore procedures, and a
  tested recovery path.
- Review graceful shutdown, migration failure, application rollback, secret
  management, and user-data retention.

## Reliability and operability

- Define safe timeout, retry, idempotency, and unknown-outcome behavior for
  database, Agent, and external-service operations.
- Add focused metrics and alerts for user-visible failures, database saturation,
  and bounded Agent termination.
- Maintain public API documentation and compatibility rules when external
  consumers require them.
- Keep deterministic tests and migration checks in CI without paid model calls.

## Infrastructure only when justified

- Consider managed PostgreSQL, load balancing, WAF, private networking, multiple
  environments, or distributed execution only after availability, scale,
  security, or recovery requirements justify their cost and complexity.
