FROM oven/bun:1 AS builder

WORKDIR /app

ARG NPM_CONFIG_HUGEICONS_KEY
ARG API_URL
ARG VITE_API_URL

ENV NPM_CONFIG_HUGEICONS_KEY=$NPM_CONFIG_HUGEICONS_KEY
ENV API_URL=$API_URL
ENV VITE_API_URL=$VITE_API_URL
ENV NODE_ENV=production
ENV PROD=true

COPY package.json bun.lock ./
COPY .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY apps/mobile/package.json ./apps/mobile/
COPY apps/oauth-test/package.json ./apps/oauth-test/
COPY packages/lib/package.json ./packages/lib/
COPY packages/hooks/package.json ./packages/hooks/
COPY packages/db/package.json ./packages/db/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN bun install --ignore-scripts

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
