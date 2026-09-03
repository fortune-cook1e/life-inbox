# Deployment Handoff

Updated: 2026-09-02

Status: `IN PROGRESS` or `NOT STARTED`.

## Target

API-only deployment through the smallest useful GCP path:

```text
GitHub Actions -> Artifact Registry -> one Compute Engine VM
                                      -> Docker Compose
                                           -> NestJS API
                                           -> PostgreSQL
```

Cloud Run, Cloud SQL, Web deployment, Redis, Kubernetes, load balancers, and
multiple environments are deferred until a real requirement justifies them.

## Fixed boundaries

- Use only credits and Free Tier benefits shown in the GCP account. Before each
  resource, confirm its price, eligibility, cleanup command, and approval. Do
  not upgrade billing or run `terraform apply` without explicit approval.
- GitHub uses OIDC and Workload Identity Federation. Never store permanent GCP
  JSON keys or SSH private keys in GitHub.
- Restrict deployment trust to this repository and branch. CI may push only the
  API image; the VM may only pull it.
- PostgreSQL stays private in Docker Compose. One VM is a shared failure domain
  with no managed failover, backup, upgrade, or recovery.

## Authorization model

```text
GitHub OIDC -> Workload Identity -> deploy identity
  -> push the API image
  -> deploy to the VM through IAP and OS Login

VM runtime identity -> pull the API image only
```

- Trust only this repository and deployment branch; pull request CI has no GCP
  deployment identity.
- Give each identity only the permissions shown above. Neither may manage
  billing or infrastructure.
- Do not use permanent GCP keys, GitHub SSH keys, public SSH, or broad Owner and
  Editor roles.
- Application secrets remain runtime configuration on the VM, separate from
  GitHub-to-GCP authorization.

## Slices

### 1. Local production Docker path — IN PROGRESS

Implemented but not verified: one API image can run NestJS or the compiled
migration entry point; production Compose runs API and PostgreSQL; committed
migrations are included; PostgreSQL uses a private Docker volume.

Done after verifying image build, fresh migration, health checks, restart, and
migration failure behavior.

### 2. GCP cost and account gate — NOT STARTED

Confirm Trial/Credits, expiry, billing status, eligible region, VM type, disk,
public IPv4, network, and Artifact Registry pricing in the current console. Add
a minimal budget alert, understanding that it is not a hard spending limit. No
cloud resource is created before this gate passes.

### 3. Registry and GitHub identity — NOT STARTED

Create one regional Artifact Registry repository with image cleanup. Configure
the identities and trust restrictions defined above. Verify both positive and
negative paths: the deployment branch can push one commit-SHA image, while a
pull request or untrusted ref cannot obtain deployment access.

Done when GitHub can push the image without a permanent key and the VM can pull
it through its read-only runtime identity.

### 4. Compute Engine and manual deployment — NOT STARTED

Create one approved VM in the registry region, install Docker Compose, enable
OS Login, and attach its read-only runtime identity. Configure IAP access and
its narrow SSH firewall rule before testing GitHub deployment access. Keep
PostgreSQL private and API local until public access is needed. Keep runtime
secrets in an untracked, owner-readable VM environment file.

Manually pull and run Compose once before automating. Treat the database as
learning/test data until backup and restore are verified.

### 5. API continuous integration — NOT STARTED

For pull requests, run formatting/lint, typecheck, deterministic API tests,
application build, and Docker build. CI uses no GCP credentials, deploys
nothing, and never calls paid models.

### 6. API continuous deployment and migration — NOT STARTED

On the deployment branch:

1. authenticate through GitHub OIDC;
2. build and push the commit-SHA image;
3. connect to the VM without a permanent key and pull it;
4. run `node dist/database/migrate.js` in a one-off API container;
5. update API only after migration succeeds, then run a local health check.

Serialize deployments and retain the previous image for application rollback.
Developers generate and commit reviewed migrations; CD only applies them.
Database changes are not reversed by an image rollback, so migrations must be
backward-compatible.

### 7. Minimal public security — NOT STARTED

When public access is needed, expose HTTPS rather than the container port, keep
PostgreSQL private, restrict CORS, and add the planned JWT authorization and
rate limits. Cost limits do not replace authentication.

### 8. Recovery and basic operations — NOT STARTED

Add image rollback, database backup, one restore exercise, disk checks,
container health, and minimal useful alerts. Do not add a separate monitoring
stack unless an observed need justifies it.

### 9. Infrastructure as code — NOT STARTED

After one manual deployment is understood, use Terraform to replace the manual
creation of only the required registry, identities, firewall, VM, and disk.
Review every plan and cost before apply and protect persistent data from
accidental destruction.

## Next

Finish Slice 1 locally. Slice 2 must pass before creating any GCP resource.
