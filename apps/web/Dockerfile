FROM oven/bun:1 AS builder

WORKDIR /app

ARG NPM_CONFIG_HUGEICONS_KEY
ARG API_URL
ARG VITE_API_URL
ARG INTERNAL_AUTH_URL
ARG BETTER_AUTH_SECRET
ARG AUTH_URL
ARG REDIS_URL
ARG UPSTASH_REDIS_REST_URL
ARG UPSTASH_REDIS_REST_TOKEN

ENV NPM_CONFIG_HUGEICONS_KEY=$NPM_CONFIG_HUGEICONS_KEY
ENV API_URL=$API_URL
ENV VITE_API_URL=$VITE_API_URL
ENV INTERNAL_AUTH_URL=$INTERNAL_AUTH_URL
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
ENV AUTH_URL=$AUTH_URL
ENV REDIS_URL=$REDIS_URL
ENV UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL
ENV UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN
ENV NODE_ENV=production

COPY package.json bun.lock ./
COPY .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/lib/package.json ./packages/lib/
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
