# Deployment Handoff

Updated: 2026-09-03

Status: `IN PROGRESS` — only the local production Docker path is implemented.

## Target

API-only deployment through the smallest useful AWS path:

```text
GitHub Actions -> Amazon ECR -> one EC2 instance
                                -> Docker Compose
                                     -> NestJS API
                                     -> PostgreSQL
```

Use GitHub OIDC for AWS authentication and AWS Systems Manager (SSM) for remote
deployment. Web deployment, Redis, RDS, WAF, NAT Gateway, load balancers, EKS,
and multiple environments are deferred until a real requirement justifies
their cost and complexity.

## Fixed boundaries

- Use a new standalone AWS account on the Free account plan only if AWS shows
  the expected active credits and terms. Do not create or join AWS
  Organizations, enable consolidated billing, use Control Tower, or accept an
  action that upgrades the account to a Paid plan.
- Before creating each resource, confirm its price, credit eligibility, region,
  cleanup command, and approval. Do not run `terraform apply` without explicit
  approval. Credits and budget alerts are not hard spending limits.
- GitHub authenticates with OIDC. Never store permanent AWS access keys or SSH
  private keys in GitHub.
- Restrict deployment trust to this repository and deployment branch. Pull
  requests receive no AWS deployment identity.
- PostgreSQL stays private in Docker Compose. One EC2 instance is a shared
  failure domain with no managed failover, backup, upgrade, or recovery.

## Account and cost guardrails

- Enable root MFA, create no root access keys, use the free Basic Support plan,
  and use a separate least-privilege identity for routine administration.
- Before deployment, create actual and forecast AWS Budgets plus Cost Anomaly
  Detection. Track gross usage without credit deductions as well as the final
  billed amount.
- Use one approved region and tag resources with `Project=life-inbox` and a
  cleanup date. Review Cost Explorer and Bills after every experiment.
- Treat EC2, EBS, snapshots, public IPv4, ECR storage, logs, and data transfer as
  chargeable. Terminating EC2 does not automatically remove every attached or
  related resource.
- Do not enable WAF, paid managed rules, NAT Gateway, ALB, RDS, EKS, Marketplace
  products, or paid support during the minimal deployment.

## Authorization model

```text
GitHub OIDC -> deploy IAM role
  -> push the API image to one ECR repository
  -> invoke one approved SSM deployment command on the tagged EC2 instance

EC2 instance profile -> pull the API image + register with SSM only
```

- Scope the OIDC trust policy to this repository and deployment branch. Scope
  ECR permissions to one repository and SSM deployment to the intended instance
  and document; do not grant administrator or billing permissions.
- Keep the EC2 instance free of public SSH and permanent deployment keys. The
  initial path uses SSM rather than inbound SSH.
- Application secrets remain runtime configuration in an untracked,
  owner-readable EC2 environment file, separate from GitHub-to-AWS
  authorization.

## Slices

### 1. Local production Docker path — IN PROGRESS

Implemented but not verified: one API image can run NestJS or the compiled
migration entry point; production Compose runs API and PostgreSQL; committed
migrations are included; PostgreSQL uses a private Docker volume.

Done after verifying image build, fresh migration, health checks, restart, and
migration failure behavior.

### 2. AWS account and cost gate — NOT STARTED

Create and inspect the standalone account without AWS Organizations or a Paid
plan. Confirm credits, expiry, eligible services, account-plan limits, region,
EC2 type, EBS, public IPv4, ECR, logs, and data-transfer pricing. Configure the
account and cost guardrails above. No workload resource is created before this
gate passes.

### 3. ECR and GitHub identity — NOT STARTED

Create one regional ECR repository with lifecycle cleanup. Configure the GitHub
OIDC deploy role and EC2 instance profile defined above. Verify that the trusted
deployment branch can push one commit-SHA image while a pull request or
untrusted ref cannot obtain deployment access.

### 4. EC2 and manual deployment — NOT STARTED

Create one approved EC2 instance in a public subnet with a priced public IPv4
for outbound access but no inbound SSH. Attach the narrow runtime profile,
register it with SSM, and avoid NAT Gateway. Install Docker Compose and manually
pull and run Compose once before automation. Keep PostgreSQL private and the API
bound locally until public access is required. Treat the database as
learning/test data until backup and restore are verified.

### 5. API continuous integration — NOT STARTED

For pull requests, run formatting/lint, typecheck, deterministic API tests,
application build, and Docker build. CI uses no AWS credentials, deploys
nothing, and never calls paid models.

### 6. API continuous deployment and migration — NOT STARTED

On the deployment branch:

1. authenticate to AWS through GitHub OIDC;
2. build and push the commit-SHA image to ECR;
3. invoke the scoped SSM deployment command;
4. pull the image and run `node dist/database/migrate.js` in a one-off API
   container;
5. update the API only after migration succeeds, then run a local health check.

Serialize deployments and retain the previous image for application rollback.
Developers generate and commit reviewed migrations; CD only applies them.
Database changes are not reversed by image rollback, so migrations must remain
backward-compatible.

### 7. Minimal public security — NOT STARTED

When public access is needed, expose HTTPS through a minimal reverse proxy
rather than the container port, keep PostgreSQL private, restrict CORS, and add
the planned JWT authorization and rate limits. Do not add WAF or an ALB merely
for learning convenience.

### 8. Recovery and basic operations — NOT STARTED

Add image rollback, database backup, one restore exercise, disk checks,
container health, log retention, and minimal alerts. Document how to terminate
all AWS resources without leaving EBS volumes, snapshots, images, or public IP
charges.

### 9. Infrastructure as code — NOT STARTED

After one manual deployment is understood, use Terraform to replace only the
approved ECR repository, IAM roles and policies, network rules, EC2 instance,
and storage. Review every plan and cost before apply, and protect persistent
data from accidental destruction. Terraform must not create AWS Organizations
or account-plan resources.

## Next

Finish and verify Slice 1 locally. Slice 2 must then prove the standalone AWS
account, credits, and cost guardrails before any workload resource is created.
