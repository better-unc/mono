import { Hono } from "hono";
import { getAuth, verifyCredentials } from "../auth";

const app = new Hono();

app.post("/api/auth/verify-credentials", async (c) => {
  const start = Date.now();
  console.log(`[API] POST /api/auth/verify-credentials`);
  const response = await verifyCredentials(c.req.raw);
  const duration = Date.now() - start;
  console.log(`[API] POST /api/auth/verify-credentials -> ${response.status} (${duration}ms)`);
  return response;
});

app.all("/api/auth/*", async (c) => {
  const start = Date.now();
  const path = new URL(c.req.url).pathname;
  const method = c.req.method;
  console.log(`[API] ${method} ${path}`);
  const auth = getAuth();
  const response = await auth.handler(c.req.raw);
  const duration = Date.now() - start;
  console.log(`[API] ${method} ${path} -> ${response.status} (${duration}ms)`);
  return response;
});

export default app;
