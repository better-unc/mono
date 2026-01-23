import { Hono } from "hono";
import { db, users, repositories, stars } from "@gitbruv/db";
import { eq, sql, desc, and } from "drizzle-orm";
import { authMiddleware, requireAuth, type AuthVariables } from "../middleware/auth";
import { putObject, deletePrefix, getRepoPrefix } from "../s3";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", authMiddleware);

app.post("/api/repositories", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json<{
    name: string;
    description?: string;
    visibility: string;
  }>();

  const normalizedName = body.name.toLowerCase().replace(/ /g, "-");

  if (!/^[a-zA-Z0-9_.-]+$/.test(normalizedName)) {
    return c.json({ error: "Invalid repository name" }, 400);
  }

  const existing = await db.query.repositories.findFirst({
    where: and(eq(repositories.ownerId, user.id), eq(repositories.name, normalizedName)),
  });

  if (existing) {
    return c.json({ error: "Repository already exists" }, 400);
  }

  const [repo] = await db
    .insert(repositories)
    .values({
      name: normalizedName,
      description: body.description,
      visibility: body.visibility as "public" | "private",
      ownerId: user.id,
    })
    .returning();

  const repoPrefix = getRepoPrefix(user.id, normalizedName);
  await putObject(`${repoPrefix}/HEAD`, "ref: refs/heads/main\n");
  await putObject(`${repoPrefix}/config`, "[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = true\n");
  await putObject(`${repoPrefix}/description`, "Unnamed repository; edit this file to name the repository.\n");

  return c.json(repo);
});

app.get("/api/repositories/public", async (c) => {
  const sortBy = c.req.query("sortBy") || "updated";
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const orderBy =
    sortBy === "stars"
      ? desc(sql`star_count`)
      : sortBy === "created"
        ? desc(repositories.createdAt)
        : desc(repositories.updatedAt);

  const result = await db
    .select({
      id: repositories.id,
      name: repositories.name,
      description: repositories.description,
      ownerId: repositories.ownerId,
      visibility: repositories.visibility,
      defaultBranch: repositories.defaultBranch,
      createdAt: repositories.createdAt,
      updatedAt: repositories.updatedAt,
      username: users.username,
      userName: users.name,
      avatarUrl: users.avatarUrl,
      starCount: sql<number>`(SELECT COUNT(*) FROM stars WHERE repository_id = ${repositories.id})`.as("star_count"),
    })
    .from(repositories)
    .innerJoin(users, eq(users.id, repositories.ownerId))
    .where(eq(repositories.visibility, "public"))
    .orderBy(orderBy)
    .limit(limit + 1)
    .offset(offset);

  const hasMore = result.length > limit;
  const repos = result.slice(0, limit).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    defaultBranch: row.defaultBranch,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    owner: {
      id: row.ownerId,
      username: row.username,
      name: row.userName,
      avatarUrl: row.avatarUrl,
    },
    starCount: row.starCount,
  }));

  return c.json({ repos, hasMore });
});

app.get("/api/repositories/user/:username", async (c) => {
  const username = c.req.param("username");
  const currentUser = c.get("user");

  const userResult = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: { id: true, username: true, name: true, avatarUrl: true },
  });

  if (!userResult) {
    return c.json({ repos: [] });
  }

  const isOwner = currentUser?.id === userResult.id;

  const reposResult = await db.query.repositories.findMany({
    where: isOwner
      ? eq(repositories.ownerId, userResult.id)
      : and(eq(repositories.ownerId, userResult.id), eq(repositories.visibility, "public")),
    orderBy: desc(repositories.updatedAt),
  });

  const reposWithStars = await Promise.all(
    reposResult.map(async (repo) => {
      const [starCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(stars)
        .where(eq(stars.repositoryId, repo.id));

      return {
        ...repo,
        owner: {
          id: userResult.id,
          username: userResult.username,
          name: userResult.name,
          avatarUrl: userResult.avatarUrl,
        },
        starCount: starCount?.count || 0,
      };
    })
  );

  return c.json({ repos: reposWithStars });
});

app.get("/api/repositories/:owner/:name", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");

  const result = await db
    .select({
      id: repositories.id,
      name: repositories.name,
      description: repositories.description,
      ownerId: repositories.ownerId,
      visibility: repositories.visibility,
      defaultBranch: repositories.defaultBranch,
      createdAt: repositories.createdAt,
      updatedAt: repositories.updatedAt,
      username: users.username,
      userName: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(repositories)
    .innerJoin(users, eq(users.id, repositories.ownerId))
    .where(and(eq(users.username, owner), eq(repositories.name, name)))
    .limit(1);

  const row = result[0];
  if (!row) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (row.visibility === "private" && currentUser?.id !== row.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const [starCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(stars)
    .where(eq(stars.repositoryId, row.id));

  return c.json({
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    defaultBranch: row.defaultBranch,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    owner: {
      id: row.ownerId,
      username: row.username,
      name: row.userName,
      avatarUrl: row.avatarUrl,
    },
    starCount: starCount?.count || 0,
  });
});

app.get("/api/repositories/:owner/:name/with-stars", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");

  const result = await db
    .select({
      id: repositories.id,
      name: repositories.name,
      description: repositories.description,
      ownerId: repositories.ownerId,
      visibility: repositories.visibility,
      defaultBranch: repositories.defaultBranch,
      createdAt: repositories.createdAt,
      updatedAt: repositories.updatedAt,
      username: users.username,
      userName: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(repositories)
    .innerJoin(users, eq(users.id, repositories.ownerId))
    .where(and(eq(users.username, owner), eq(repositories.name, name)))
    .limit(1);

  const row = result[0];
  if (!row) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (row.visibility === "private" && currentUser?.id !== row.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const [starCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(stars)
    .where(eq(stars.repositoryId, row.id));

  let starred = false;
  if (currentUser) {
    const existing = await db.query.stars.findFirst({
      where: and(eq(stars.userId, currentUser.id), eq(stars.repositoryId, row.id)),
    });
    starred = !!existing;
  }

  return c.json({
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    defaultBranch: row.defaultBranch,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    owner: {
      id: row.ownerId,
      username: row.username,
      name: row.userName,
      avatarUrl: row.avatarUrl,
    },
    starCount: starCount?.count || 0,
    starred,
  });
});

app.delete("/api/repositories/:id", requireAuth, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, id),
  });

  if (!repo) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (repo.ownerId !== user.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const repoPrefix = getRepoPrefix(user.id, repo.name);
  await deletePrefix(repoPrefix);

  await db.delete(repositories).where(eq(repositories.id, id));

  return c.json({ success: true });
});

app.patch("/api/repositories/:id", requireAuth, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    description?: string;
    visibility?: string;
  }>();

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, id),
  });

  if (!repo) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (repo.ownerId !== user.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const newName = body.name ? body.name.toLowerCase().replace(/ /g, "-") : repo.name;

  if (body.name) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(newName)) {
      return c.json({ error: "Invalid repository name" }, 400);
    }

    if (newName !== repo.name) {
      const existing = await db.query.repositories.findFirst({
        where: and(eq(repositories.ownerId, user.id), eq(repositories.name, newName)),
      });

      if (existing) {
        return c.json({ error: "Repository with this name already exists" }, 400);
      }
    }
  }

  const [updated] = await db
    .update(repositories)
    .set({
      name: newName,
      description: body.description ?? repo.description,
      visibility: (body.visibility as "public" | "private") ?? repo.visibility,
      updatedAt: new Date(),
    })
    .where(eq(repositories.id, id))
    .returning();

  return c.json(updated);
});

app.post("/api/repositories/:id/star", requireAuth, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const existing = await db.query.stars.findFirst({
    where: and(eq(stars.userId, user.id), eq(stars.repositoryId, id)),
  });

  if (existing) {
    await db.delete(stars).where(and(eq(stars.userId, user.id), eq(stars.repositoryId, id)));
    return c.json({ starred: false });
  } else {
    await db.insert(stars).values({
      userId: user.id,
      repositoryId: id,
    });
    return c.json({ starred: true });
  }
});

app.get("/api/repositories/:id/is-starred", async (c) => {
  const currentUser = c.get("user");
  const id = c.req.param("id");

  if (!currentUser) {
    return c.json({ starred: false });
  }

  const existing = await db.query.stars.findFirst({
    where: and(eq(stars.userId, currentUser.id), eq(stars.repositoryId, id)),
  });

  return c.json({ starred: !!existing });
});

export default app;
