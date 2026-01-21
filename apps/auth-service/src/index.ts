import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./server";
import { verifyCredentials } from "./verify-credentials";

const app = new Hono();

app.use(
  "/api/auth/*",
  cors({
    origin: (origin) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:8081",
        "http://10.0.2.2:3001",
        "exp://localhost:8081",
        "exp://192.168.*.*:8081",
      ];

      if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        allowedOrigins.push(process.env.RAILWAY_PUBLIC_DOMAIN);
      }
      if (process.env.API_URL) {
        allowedOrigins.push(process.env.API_URL);
      }
      if (process.env.WEB_URL) {
        allowedOrigins.push(process.env.WEB_URL);
      }
      if (process.env.EXPO_PUBLIC_API_URL) {
        allowedOrigins.push(process.env.EXPO_PUBLIC_API_URL);
      }

      if (!origin) return true;
      return allowedOrigins.some((allowed) => {
        if (allowed.includes("*")) {
          const pattern = allowed.replace(/\*/g, ".*");
          return new RegExp(`^${pattern}$`).test(origin);
        }
        return origin === allowed;
      });
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposeHeaders: ["Set-Cookie"],
  })
);

app.post("/api/auth/verify-credentials", async (c) => {
  const start = Date.now();
  console.log(`[Auth Service] POST /api/auth/verify-credentials`);
  const response = await verifyCredentials(c.req.raw);
  const duration = Date.now() - start;
  console.log(`[Auth Service] POST /api/auth/verify-credentials -> ${response.status} (${duration}ms)`);
  return response;
});

app.all("/api/auth/*", async (c) => {
  const start = Date.now();
  const path = new URL(c.req.url).pathname;
  const method = c.req.method;
  console.log(`[Auth Service] ${method} ${path}`);
  const response = await auth.handler(c.req.raw);
  const duration = Date.now() - start;
  console.log(`[Auth Service] ${method} ${path} -> ${response.status} (${duration}ms)`);
  return response;
});

app.get("/health", (c) => {
  console.log(`[Auth Service] GET /health`);
  return c.json({ status: "ok" });
});

const port = parseInt(process.env.PORT || "3002", 10);

Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`[Auth Service] Starting auth service on http://localhost:${port}`);
console.log(`[Auth Service] Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`[Auth Service] Database: ${process.env.DATABASE_URL ? "Connected" : "Not configured"}`);
console.log(`[Auth Service] Redis: ${process.env.REDIS_URL ? "Configured" : "Not configured"}`);
console.log(`[Auth Service] Ready to handle auth requests`);
