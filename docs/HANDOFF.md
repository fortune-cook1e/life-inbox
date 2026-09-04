# Project Handoff

Updated: 2026-09-03

## Current focus

Deployment is the only active workstream. Product, frontend, and Agent feature
work remain paused while the minimal API deployment path is established.

## Current state

- Backend Phases 1-3 and Agent Phase 4 Slice 1 are implemented. The last
  recorded normal API suite passed 24/24 on 2026-08-28; backend typecheck, lint,
  and build remain unverified. Durable Agent HITL and resume have not started.
- The frontend Event Chat and Settings surfaces are implemented but still need
  typecheck, lint, build, and running-browser acceptance. It still uses the
  temporary Phase 3 Draft Confirm/Reject endpoints; Agent Phase 4 Slice 2 must
  replace them without retaining two public final-transition paths. The
  timezone slice has not started.
- The local production Docker path is verified: the API image builds, all six
  committed migrations apply to a fresh PostgreSQL volume, database health
  succeeds, migration state survives recreation, and invalid credentials make
  migration fail. The isolated test resources were removed afterward.
- No AWS workload resources have been created by the documented deployment
  flow.

## Active boundary

- Follow the approved API-only direction in
  `docs/canonical/deployment.md`.
- Do not begin a new product, frontend, or Agent slice during the deployment
  workstream.
- Do not create AWS workload resources before the standalone account, credits,
  account plan, region, pricing, budgets, anomaly detection, tags, and cleanup
  procedure are confirmed.
- Every cloud mutation requires explicit approval. GitHub uses OIDC and EC2 uses
  SSM; permanent AWS keys and inbound SSH are outside the approved path.

## Next step

Complete the AWS account and cost gate. Confirm the standalone account remains
on the intended Free plan with active credits, choose and price the region and
minimal resources, configure cost guardrails, and document cleanup before
creating ECR, IAM deployment roles, EC2, or other workload resources.

## Verification gaps and risks

- The local Docker evidence above comes from the completed deployment slice; it
  was not rerun during this documentation reorganization.
- AWS identity, negative OIDC trust, ECR push, SSM deployment, EC2 runtime,
  public HTTPS, backup/restore, rollback, and cleanup are not yet verified.
- Authentication, authorization, production CORS, rate limits, and recovery
  remain required before public use.
- Frontend verification remains deferred and must not be reported as complete.

## References

- Deployment architecture: `docs/canonical/deployment.md`
- Product scope: `docs/canonical/product-scope.md`
- Agent design: `docs/canonical/agent-llm-contract.md`
- Implementation order: `docs/canonical/implementation-roadmap.md`
- Non-active future work: `docs/future-plan.md`
- Personal AI workflow: `docs/agent-workflow.md`
