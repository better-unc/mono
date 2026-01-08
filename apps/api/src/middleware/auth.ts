import { type MiddlewareHandler, type Context } from "hono";
import { type AppEnv } from "../types";
import { authenticateRequest } from "../auth";

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    const db = c.get("db");
    const user = await authenticateRequest(c.req.raw, db);
    c.set("user", user);
    await next();
  } catch (error) {
    console.error("[Auth Middleware] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return c.text(`Auth Middleware Error: ${errorMessage}`, 500);
  }
};
export const requireAuth = (c: Context<AppEnv>, ownerId: string): Response | null => {
  const user = c.get("user");
  if (!user) {
    return new Response("Unauthorized: no valid credentials", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="gitbruv"' },
    });
  }
  if (user.id !== ownerId) {
    return new Response(`Unauthorized: user ${user.username} does not own this repo`, {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="gitbruv"' },
    });
  }
  return null;
};
