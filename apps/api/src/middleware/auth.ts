import { createMiddleware } from "hono/factory";
import { getAuth, type Session } from "../auth";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
};

export type AuthVariables = {
  user: AuthUser | null;
  session: Session | null;
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const auth = getAuth();

  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (session?.user) {
      c.set("user", {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        username: (session.user as any).username,
        avatarUrl: session.user.image,
      });
      c.set("session", session);
    } else {
      c.set("user", null);
      c.set("session", null);
    }
  } catch (error) {
    console.error("[API] Auth middleware error:", error instanceof Error ? error.message : "Unknown error");
    c.set("user", null);
    c.set("session", null);
  }

  await next();
});

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});

export const optionalAuth = authMiddleware;
