FROM oven/bun:1 AS builder

WORKDIR /app

ARG NPM_CONFIG_HUGEICONS_KEY
ARG API_URL

ENV NPM_CONFIG_HUGEICONS_KEY=$NPM_CONFIG_HUGEICONS_KEY
ENV API_URL=$API_URL

COPY package.json bun.lock ./
COPY .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/auth/package.json ./packages/auth/
COPY packages/hooks/package.json ./packages/hooks/
COPY packages/db/package.json ./packages/db/

RUN bun install

COPY packages ./packages
COPY apps/web ./apps/web

WORKDIR /app/apps/web
ENV NODE_ENV=production
RUN bun run build

FROM oven/bun:1-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/.output ./apps/web/.output
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /app/apps/web

CMD ["bun", "run", ".output/server/index.mjs"]
