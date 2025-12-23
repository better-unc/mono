import { type MiddlewareHandler, type Context } from "hono";
import { type AppEnv } from "../types";
import { authenticateRequest } from "../auth";

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const db = c.get("db");
  const user = await authenticateRequest(c.req.raw, db);
  c.set("user", user);
  await next();
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
