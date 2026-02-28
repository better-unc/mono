FROM oven/bun:1.1 AS builder

WORKDIR /app

ARG WEB_URL
ENV WEB_URL=$WEB_URL

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/lib/package.json ./packages/lib/
COPY packages/hooks/package.json ./packages/hooks/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN bun install

COPY packages/db ./packages/db
COPY packages/lib ./packages/lib
COPY packages/hooks ./packages/hooks
COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN bun build src/index.ts --outdir dist --target bun --minify \
    --external next-themes --external @databuddy/sdk --external sonner \
    --external @tanstack/react-query --external @pierre/diffs \
    --external @base-ui/react --external @base-ui/utils --external shiki

FROM oven/bun:1.1-alpine AS runner

WORKDIR /app

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["bun", "run", "dist/index.js"]
