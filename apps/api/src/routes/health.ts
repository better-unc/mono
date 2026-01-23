import { Hono } from "hono";
import { getObject, listObjects } from "../s3";
import { db, users, repositories } from "@gitbruv/db";
import { eq, and } from "drizzle-orm";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ status: "ok", version: "1.0.0" });
});

app.get("/api/health", (c) => {
  return c.json({ status: "ok", version: "1.0.0" });
});

app.get("/api/debug/repo/:owner/:name", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");

  const result = await db
    .select({
      id: repositories.id,
      name: repositories.name,
      ownerId: repositories.ownerId,
      userId: users.id,
    })
    .from(repositories)
    .innerJoin(users, eq(users.id, repositories.ownerId))
    .where(and(eq(users.username, owner), eq(repositories.name, name)))
    .limit(1);

  const row = result[0];
  if (!row) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const prefix = `repos/${row.userId}/${row.name}/`;
  const keys = await listObjects(prefix);

  const grouped: Record<string, string[]> = {};
  for (const key of keys) {
    const relative = key.slice(prefix.length);
    const parts = relative.split("/");
    const category = parts[0] || "root";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(relative);
  }

  return c.json({
    prefix,
    totalFiles: keys.length,
    categories: Object.keys(grouped).map((k) => ({ name: k, count: grouped[k].length })),
    files: keys.slice(0, 100).map((k) => k.slice(prefix.length)),
  });
});

app.get("/api/avatar/:filename", async (c) => {
  const filename = c.req.param("filename");
  const key = `avatars/${filename}`;

  const data = await getObject(key);
  if (!data) {
    return c.json({ error: "Avatar not found" }, 404);
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "png";
  const contentType =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "gif"
        ? "image/gif"
        : ext === "webp"
          ? "image/webp"
          : "image/png";

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

export default app;
