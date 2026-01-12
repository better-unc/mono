import { Hono } from "hono";
import { cors } from "hono/cors";
import { type AppEnv } from "./types";
import { registerHealthRoutes } from "./routes/health";
import { registerGitRoutes } from "./routes/git";
import { registerFileRoutes } from "./routes/file";
import { registerAvatarRoutes } from "./routes/avatar";
import { registerR2Routes } from "./routes/r2";
import { registerRepositoryRoutes } from "./routes/repositories";
import { registerSettingsRoutes } from "./routes/settings";
import { registerUserRoutes } from "./routes/users";
import { registerAuthRoutes } from "./routes/auth";
import { registerPullRequestRoutes } from "./routes/pull_requests";
import { getEnv } from "./env";
import { createS3Client } from "./r2-fs";
import { createDb } from "./db";
import { loggerMiddleware, errorHandler } from "./middleware/logger";

const app = new Hono<AppEnv>();

app.use("*", errorHandler);
app.use("*", loggerMiddleware);

app.use("*", async (c, next) => {
  const env = getEnv();
  const s3Client = createS3Client(env.R2_ENDPOINT, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY);
  c.set("s3", { client: s3Client, bucket: env.R2_BUCKET_NAME });
  c.set("db", createDb(env.DATABASE_URL));
  await next();
});

app.use(
  "/api/*",
  cors({
    origin: (origin) => origin || "",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposeHeaders: ["Set-Cookie"],
    credentials: true,
  })
);

registerHealthRoutes(app);
registerAuthRoutes(app);
registerAvatarRoutes(app);
registerR2Routes(app);
registerRepositoryRoutes(app);
registerSettingsRoutes(app);
registerUserRoutes(app);
registerGitRoutes(app);
registerFileRoutes(app);
registerPullRequestRoutes(app);

app.notFound((c) => c.text("Not found", 404));

export default app;
