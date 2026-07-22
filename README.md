# Life Inbox

pnpm workspace containing a Next.js web app and a NestJS API. Drizzle belongs to
the API application and connects it to PostgreSQL.

## Requirements

- Node.js 22+
- pnpm 8+
- Docker with Compose

## Start locally

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:3001/health
- PostgreSQL: localhost:5432
- Redis: localhost:6379

The PostgreSQL container uses the pgvector image. Run `pnpm db:prepare` before
adding vector columns to enable the `vector` extension idempotently.

## Workspace layout

```text
apps/
  web/          Next.js App Router
  api/          NestJS API with Drizzle database access
```

Shared TypeScript, ESLint, and Prettier base configuration lives at the
repository root. Each application extends it with framework-specific options.

## Commands

```bash
pnpm dev            # run web and API together
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check

pnpm db:up
pnpm db:down
pnpm db:prepare     # idempotently enable the pgvector extension
pnpm db:generate
pnpm db:migrate
pnpm db:push        # local development only
pnpm db:studio
pnpm db:check
```

Use committed migrations (`db:generate` followed by `db:migrate`) for shared or
production environments. Reserve `db:push` for local schema experimentation.
