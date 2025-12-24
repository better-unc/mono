FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g bun

COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/

RUN bun install

COPY packages ./packages
COPY apps/web ./apps/web

WORKDIR /app/apps/web
RUN bun run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app/apps/web/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]

