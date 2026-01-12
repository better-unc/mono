import type { Hono } from "hono";
import type { AppEnv } from "../types";
import { auth } from "@gitbruv/auth/server";

export function registerAuthRoutes(app: Hono<AppEnv>) {
  app.on(["GET", "POST"], "/api/auth/*", async (c) => {
    return auth.handler(c.req.raw);
  });
}
