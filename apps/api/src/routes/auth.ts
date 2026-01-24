import { Hono } from "hono";
import { getAuth, verifyCredentials } from "../auth";

const app = new Hono();

app.post("/api/auth/verify-credentials", async (c) => {
  const start = Date.now();

  const response = await verifyCredentials(c.req.raw);
  const duration = Date.now() - start;

  return response;
});

app.all("/api/auth/*", async (c) => {
  const start = Date.now();
  const path = new URL(c.req.url).pathname;
  const method = c.req.method;

  const auth = getAuth();
  const response = await auth.handler(c.req.raw);
  const duration = Date.now() - start;

  return response;
});

export default app;
