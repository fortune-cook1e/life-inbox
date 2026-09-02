FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@8.11.0 --activate

WORKDIR /workspace

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN pnpm --filter @life-inbox/shared build \
  && pnpm --filter @life-inbox/api build

FROM base AS production-dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /workspace

COPY --from=production-dependencies /workspace/node_modules ./node_modules
COPY --from=production-dependencies /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /workspace/packages/shared/dist ./packages/shared/dist

WORKDIR /workspace/apps/api

EXPOSE 3001

USER node

CMD ["node", "dist/main.js"]
