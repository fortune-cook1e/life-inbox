# Deployment Handoff

Updated: 2026-09-02

## Current decision

Use the smallest deployment that fits the current product:

```text
GitHub Actions
  -> build one API image tagged with the Git commit SHA
  -> push it to a private AWS ECR repository
  -> ask EC2 to deploy through AWS Systems Manager (SSM)

EC2
  -> pull the requested image
  -> run committed Drizzle migrations with a one-off API container
  -> replace the API container only after migration succeeds
```

`docker-compose.prod.yml` owns only the long-running `api` and `postgres`
services. There is no separate migration service or migration image. CI/CD
will override the API image's normal command with the compiled production
migration runner when it needs to run migrations. The image contains no
production configuration or secrets; EC2 injects all application environment
variables when Compose creates a container.

This deliberately follows the proven shape of the earlier Resume Copilot
deployment while replacing ACR with ECR and password-based SSH with GitHub
OIDC, IAM, and SSM.

## Current repository state

- `apps/api/Dockerfile` and `docker-compose.prod.yml` implement the local
  production-like path but have not yet been verified.
- The production Compose file contains API and PostgreSQL only. PostgreSQL data
  is stored in the named `postgres_data` volume and is not exposed publicly.
- No GitHub Actions workflow or AWS deployment resource exists yet.
- The API build now includes a standalone production migration runner, and the
  runtime image copies both that compiled entry point and committed migration
  files. This path has not yet been built or executed in Docker.
- Redis, RDS, a reverse proxy, TLS, backups, and a container-management GUI are
  deferred.

## Migration lifecycle

During development:

```text
change the Drizzle schema
  -> pnpm db:generate
  -> review the generated SQL
  -> pnpm db:migrate against the local database
  -> commit schema code and migration files together
```

`db:push` is only for rapid experiments against a disposable local database.
Production uses committed migrations. Migration files are generated during
development, checked in CI, and applied on EC2 as part of CD.

Target EC2 deployment commands:

```bash
export IMAGE_TAG=<git-commit-sha>
docker compose --env-file /opt/life-inbox/.env.production -f docker-compose.prod.yml pull api
docker compose --env-file /opt/life-inbox/.env.production -f docker-compose.prod.yml run --rm api node dist/database/migrate.js
docker compose --env-file /opt/life-inbox/.env.production -f docker-compose.prod.yml up -d --no-deps api
```

The migration command must exit successfully before the API update runs. The
old API should not be stopped before migration, so a migration failure leaves
the previous application container available. `docker compose run` creates a
temporary API container without binding the API service port.

Image rollback does not roll back database changes. Prefer additive,
backward-compatible migrations; handle destructive changes as a separate
approved slice with a backup and rollback plan. Only one production deployment
may run at a time.

## Production environment injection

Production values are supplied at container runtime, never during image build.
Keep one untracked file such as `/opt/life-inbox/.env.production` on EC2 with
owner-only permissions. It provides the values referenced by Compose, for
example:

```dotenv
POSTGRES_DB=<production-database-name>
POSTGRES_USER=<production-database-user>
POSTGRES_PASSWORD=<production-database-password>
DATABASE_URL=<url-encoded-production-database-url>
OPENAI_API_KEY=<production-api-key>
OPENAI_MODEL=gpt-5.4-mini
API_PORT=3001
```

`POSTGRES_PASSWORD` is the raw password used to initialize PostgreSQL.
`DATABASE_URL` is the API connection string and must percent-encode any
URL-reserved characters in that password.

Do not commit this file, copy its secrets into the Dockerfile, pass them as
Docker build arguments, or interpolate them into GitHub Actions and SSM command
logs. `IMAGE_TAG` is non-secret release metadata and may be supplied by the
deployment command. Compose's `${NAME:?NAME is required}` expressions make a
deployment fail before container creation when a required value is absent.

The first deployment may manage this file manually. Move secrets to SSM
Parameter Store, Secrets Manager, or Infisical only when rotation, shared
access, or multiple environments create a real management requirement.

## Remaining slices

Complete one slice at a time. Do not create later infrastructure early.

### Slice 1: Finish the local production-like Docker path

Outcome: one API image supports both normal server startup and an explicitly
invoked migration command.

- Keep one image rather than introducing a dedicated migration image.
- `apps/api/src/database/migrate.ts` is the standalone production entry point.
  It uses the existing `drizzle-orm` and `pg` production dependencies, applies
  committed migrations, closes the database pool, and exits non-zero on
  failure without starting NestJS.
- The normal API build compiles it to `dist/database/migrate.js`, and the
  runtime image copies `apps/api/drizzle` alongside the compiled application.
- Do not add pnpm, Drizzle Kit, `drizzle.config.ts`, TypeScript schema sources,
  or development dependencies to the runtime image.
- Verify Compose configuration, image build, fresh-database migration, API
  startup, database health, and migration failure behavior.
- Do not add Redis because no current runtime requirement uses it.

### Slice 2: Protect the AWS account from accidental cost

Outcome: resource creation can begin with a known billing boundary.

- Sign in as root only for root-only account operations; keep MFA/passkey
  enabled and do not create root access keys.
- Use an IAM administrator user for normal console work in this single-account
  learning setup.
- Confirm the current plan, remaining credits, billing contact, and target AWS
  Region before creating resources.
- Create a small monthly AWS Budget and billing alerts.
- Do not enable AWS Organizations or IAM Identity Center for this path. They
  are unnecessary for the selected single-account IAM approach and previously
  caused an unexpected plan upgrade on another account.

### Slice 3: Create ECR and GitHub authentication

Outcome: GitHub Actions can push one API image without permanent AWS keys.

- Create one private ECR repository for `life-inbox-api` in the selected
  Region.
- Add the GitHub Actions OIDC provider and a narrowly scoped deploy role.
- Restrict role assumption to this repository and the deployment branch.
- Allow only the required ECR upload and SSM deployment actions.
- Tag immutable releases with the Git commit SHA; `latest` may be an additional
  convenience tag but must not identify the deployed version by itself.

### Slice 4: Create and bootstrap one EC2 instance

Outcome: one small instance can run Docker Compose and receive SSM commands.

- Create one EC2 instance in the same Region as ECR.
- Attach an instance role with `AmazonSSMManagedInstanceCore` and read-only ECR
  permissions; do not store AWS access keys on the instance.
- Install Docker and the Docker Compose plugin, and enable Docker at boot.
- Keep PostgreSQL port `5432` and API port `3001` closed to the public internet.
- Do not require inbound SSH when SSM is working. Add public `80`/`443` only
  when the HTTP entry point is implemented.
- Store the Compose file and environment file in a dedicated application
  directory. Inject that environment file at runtime and keep it out of Git,
  image layers, build arguments, and command output.

### Slice 5: Add the GitHub Actions deployment workflow

Outcome: a push to the selected branch deploys a reproducible API version.

The workflow will:

1. check out the repository;
2. run the approved CI checks;
3. authenticate to AWS through OIDC;
4. build the single API image and push the SHA tag to ECR;
5. send the EC2 deployment commands through SSM;
6. wait for the SSM result and fail the workflow on migration, startup, or
   health-check failure.

Add GitHub Actions deployment concurrency so two commits cannot migrate the
same database simultaneously. The EC2 Compose configuration must reference the
ECR repository and `IMAGE_TAG`; define how Compose changes are delivered before
the first deployment.

### Slice 6: Add the public HTTP entry point

Outcome: the API is reachable through HTTPS without exposing its container
port directly.

- Add one minimal reverse proxy such as Caddy or Nginx only when a domain is
  ready.
- Route public `443` traffic to `127.0.0.1:3001` and configure TLS.
- Restrict CORS to the real web origin before public use.

### Slice 7: Protect persistent data

Outcome: PostgreSQL data has a tested recovery path.

- Keep Docker PostgreSQL for the first low-traffic learning deployment.
- Add automated backups and perform one restore test before storing important
  data.
- Move to RDS only when operational requirements justify its cost: managed
  backups, independent database lifecycle, higher availability, or a server
  replacement that must not move the database.

## Explicitly deferred

- AWS Organizations and IAM Identity Center
- multi-Region deployment
- ECS, EKS, Kubernetes, autoscaling, and load balancers
- RDS before a concrete durability or availability requirement
- Redis before application code has a real consumer
- a public Portainer or other container-management dashboard
- Infisical or another secret platform before manual EC2 environment management
  becomes an observed problem
