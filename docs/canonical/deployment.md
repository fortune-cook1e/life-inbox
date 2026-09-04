# Deployment Architecture

## Status

This deployment direction is approved for the current learning and API
validation stage. Approval of the design does not mean that the AWS path has
been provisioned or operationally verified.

## Goal

Deploy the NestJS API through the smallest AWS path that demonstrates image
build, controlled migration, deployment identity, rollback, and basic recovery
without introducing managed infrastructure before it is required.

## Target architecture

```text
GitHub Actions
  -> Amazon ECR
  -> one EC2 instance
       -> Docker Compose
            -> NestJS API
            -> PostgreSQL
```

The initial deployment is API-only. The web application is deployed separately
when its public hosting requirement is approved.

## Boundaries

- Use one standalone AWS account and one approved region.
- Use the AWS Free account plan only when the account shows the expected active
  credits and terms. Keep the free Basic Support plan. Do not create or join
  AWS Organizations or accept an action that upgrades the account to a Paid
  plan.
- Protect the root user with MFA, create no root access keys, and use a separate
  least-privilege identity for routine administration.
- PostgreSQL runs privately inside Docker Compose on the EC2 instance.
- The API remains bound locally until public HTTPS access is explicitly needed.
- Redis, RDS, ALB, WAF, NAT Gateway, EKS, multiple environments, and
  Marketplace products are outside the minimal path.
- One EC2 instance is an accepted shared failure domain for learning and test
  data; it provides no managed database failover or recovery guarantee.

## Identity and secret ownership

```text
GitHub OIDC -> deployment role
  -> push one API image to one ECR repository
  -> invoke one approved SSM deployment command

EC2 instance profile
  -> pull that ECR image
  -> register with SSM
```

- GitHub uses OIDC; permanent AWS access keys and SSH private keys are not
  stored in GitHub.
- Trust is restricted to the intended repository and deployment branch. Pull
  requests receive no AWS deployment identity.
- The deployment role has no administrator or billing permissions.
- The EC2 instance has no inbound SSH. Remote deployment uses SSM.
- Application secrets remain runtime configuration in an untracked,
  owner-readable environment file on the instance. They are separate from the
  GitHub-to-AWS authorization path.

## Delivery flow

Pull-request CI must run deterministic formatting, lint, typecheck, tests,
application build, and Docker build without AWS credentials or paid model
calls.

Before continuous deployment is automated, manually pull the approved image,
run Docker Compose, apply migrations, and verify health on the intended EC2
instance once.

Automated deployment from the approved branch follows this order:

1. authenticate to AWS through GitHub OIDC;
2. build and push a commit-SHA image to ECR;
3. invoke the scoped SSM deployment command;
4. pull the image on EC2;
5. run committed database migrations in a one-off API container;
6. update the API only after migration succeeds;
7. run a local health check.

Deployments are serialized. The previous application image is retained for
rollback. Image rollback does not reverse database changes, so deployed
migrations must remain backward-compatible. Developers generate and review
migrations; deployment automation only applies committed migrations.

## Cost and data guardrails

- Confirm price, credit eligibility, region, cleanup procedure, and approval
  before creating each AWS resource.
- Configure actual and forecast budgets plus Cost Anomaly Detection before
  workload resources are created. Credits and alerts are not hard spending
  limits.
- Track EC2, EBS, snapshots, public IPv4, ECR storage, logs, and data transfer;
  terminating EC2 does not remove every related chargeable resource.
- Tag resources with the project identifier and a cleanup date.
- Treat the database as learning or test data until backup, restore, and
  recovery have been exercised.
- Public exposure requires HTTPS, explicit CORS, authentication and
  authorization, appropriate rate limits, and reviewed secret handling.

## Evolution triggers

Add managed or distributed infrastructure only when an observed requirement
justifies it. Examples include managed database recovery, multiple instances,
high availability, private subnet egress, traffic distribution, or a defined
WAF threat model. Introduce Terraform only after one manual deployment is
understood; limit it to approved resources, review its plan and cost before
apply, and protect persistent data from accidental destruction. These are
future decisions, not implicit parts of the current architecture.
