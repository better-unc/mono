FROM oven/bun:1 AS builder

WORKDIR /app

ARG DATABASE_URL
ARG REDIS_URL
ARG BETTER_AUTH_SECRET
ARG BETTER_AUTH_URL
ARG AUTH_SERVICE_URL
ARG API_URL
ARG WEB_URL
ARG RAILWAY_PUBLIC_DOMAIN
ARG EXPO_PUBLIC_API_URL

ENV DATABASE_URL=$DATABASE_URL
ENV REDIS_URL=$REDIS_URL
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
ENV BETTER_AUTH_URL=$BETTER_AUTH_URL
ENV AUTH_SERVICE_URL=$AUTH_SERVICE_URL
ENV API_URL=$API_URL
ENV WEB_URL=$WEB_URL
ENV RAILWAY_PUBLIC_DOMAIN=$RAILWAY_PUBLIC_DOMAIN
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ENV NODE_ENV=production
ENV PROD=true

COPY package.json bun.lock ./
COPY .npmrc ./
COPY apps/auth-service/package.json ./apps/auth-service/
COPY packages/lib/package.json ./packages/lib/
COPY packages/db/package.json ./packages/db/

RUN bun install

COPY packages ./packages
COPY apps/auth-service ./apps/auth-service

WORKDIR /app/apps/auth-service
ENV NODE_ENV=production
RUN bun run build

FROM oven/bun:1-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/auth-service/node_modules ./apps/auth-service/node_modules
COPY --from=builder /app/apps/auth-service/dist ./apps/auth-service/dist
COPY --from=builder /app/apps/auth-service/package.json ./apps/auth-service/package.json
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production
ENV PORT=3002
EXPOSE 3002
WORKDIR /app/apps/auth-service

CMD ["bun", "run", "src/index.ts"]
