import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { config, getAllowedOrigins } from "./config";
import { initAuth } from "./auth";
import { mountRoutes } from "./routes";

const app = new Hono();

const loggingMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const url = new URL(c.req.url);
  const query = url.search;

  await next();

  const status = c.res.status;
  const duration = Date.now() - start;
  const contentLength = c.res.headers.get("content-length") || "-";

  const skipLogging = path === "/health" || path === "/api/health";
  if (!skipLogging) {
    const statusColor =
      status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : status >= 300 ? "\x1b[36m" : "\x1b[32m";
    const resetColor = "\x1b[0m";
    console.log(
      `[API] ${method} ${path}${query ? query : ""} -> ${statusColor}${status}${resetColor} (${duration}ms, ${contentLength} bytes)`
    );
  }
});

app.use("*", loggingMiddleware);

app.use(
  "*",
  cors({
    origin: getAllowedOrigins(),
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie", "x-internal-auth"],
    exposeHeaders: ["Set-Cookie"],
  })
);

app.use("*", createMiddleware(async (c, next) => {
  await initAuth();
  await next();
}));

mountRoutes(app);

const port = config.port;

Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`[API] Starting API on http://localhost:${port}`);
console.log(`[API] Environment: ${config.nodeEnv}`);
console.log(`[API] Database: ${config.databaseUrl ? "Connected" : "Not configured"}`);
console.log(`[API] Redis: ${config.redisUrl ? "Configured" : "Not configured"}`);
console.log(`[API] S3: ${config.s3.endpoint ? "Configured" : "Not configured"}`);
console.log(`[API] Ready to handle requests`);

export default app;
