import { Hono } from "hono";
import { db, users, repositories, stars, repoBranchMetadata } from "@gitbruv/db";
import { eq, sql, desc, and } from "drizzle-orm";
import { authMiddleware, requireAuth, type AuthVariables } from "../middleware/auth";
import { putObject, deletePrefix, getRepoPrefix, copyPrefix, listObjects } from "../s3";
import { repoCache } from "../cache";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", authMiddleware);

async function getForkCount(repoId: string): Promise<number> {
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(repositories)
    .where(eq(repositories.forkedFromId, repoId));
  return Number(countRow?.count) || 0;
}

async function getForkedFromInfo(forkedFromId: string | null, currentUserId?: string) {
  if (!forkedFromId) {
    return null;
  }

  const [row] = await db
    .select({
      id: repositories.id,
      name: repositories.name,
      visibility: repositories.visibility,
      ownerId: repositories.ownerId,
      username: users.username,
      userName: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(repositories)
    .innerJoin(users, eq(users.id, repositories.ownerId))
    .where(eq(repositories.id, forkedFromId))
    .limit(1);

  if (!row) {
    return null;
  }

  if (row.visibility === "private" && currentUserId !== row.ownerId) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    owner: {
      id: row.ownerId,
      username: row.username,
      name: row.userName,
      avatarUrl: row.avatarUrl,
    },
  };
}

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

app.post("/api/repositories/:owner/:name/fork", requireAuth, async (c) => {
  const user = c.get("user")!;
  const owner = c.req.param("owner");
  const name = c.req.param("name").replace(/\.git$/, "");
  const body = await c.req.json<{ name?: string; description?: string }>().catch(() => ({}));

  const sourceResult = await db
    .select({
      id: repositories.id,
      name: repositories.name,
      description: repositories.description,
      ownerId: repositories.ownerId,
      visibility: repositories.visibility,
      defaultBranch: repositories.defaultBranch,
      createdAt: repositories.createdAt,
      updatedAt: repositories.updatedAt,
      forkedFromId: repositories.forkedFromId,
      username: users.username,
      userName: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(repositories)
    .innerJoin(users, eq(users.id, repositories.ownerId))
    .where(and(eq(users.username, owner), eq(repositories.name, name)))
    .limit(1);

  const source = sourceResult[0];
  if (!source) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (source.visibility === "private" && user.id !== source.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const existingFork = await db.query.repositories.findFirst({
    where: and(eq(repositories.ownerId, user.id), eq(repositories.forkedFromId, source.id)),
  });

  if (existingFork) {
    const [starCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(stars)
      .where(eq(stars.repositoryId, existingFork.id));

    const existingStar = await db.query.stars.findFirst({
      where: and(eq(stars.userId, user.id), eq(stars.repositoryId, existingFork.id)),
    });

    const forkedFrom = await getForkedFromInfo(existingFork.forkedFromId, user.id);
    const forkCount = await getForkCount(existingFork.id);

    return c.json({
      repo: {
        id: existingFork.id,
        name: existingFork.name,
        description: existingFork.description,
        visibility: existingFork.visibility,
        defaultBranch: existingFork.defaultBranch,
        createdAt: existingFork.createdAt,
        updatedAt: existingFork.updatedAt,
        ownerId: existingFork.ownerId,
        owner: {
          id: user.id,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        starCount: Number(starCount?.count) || 0,
        starred: !!existingStar,
        forkedFrom,
        forkCount,
      },
      isOwner: true,
    });
  }

  const targetName = ("name" in body && body.name ? body.name : source.name).toLowerCase().replace(/ /g, "-");

  if (!/^[a-zA-Z0-9_.-]+$/.test(targetName)) {
    return c.json({ error: "Invalid repository name" }, 400);
  }

  const existingName = await db.query.repositories.findFirst({
    where: and(eq(repositories.ownerId, user.id), eq(repositories.name, targetName)),
  });

  if (existingName) {
    return c.json({ error: "Repository with this name already exists" }, 400);
  }

  const [forkRepo] = await db
    .insert(repositories)
    .values({
      name: targetName,
      description: ("description" in body ? body.description : source.description) ?? null,
      visibility: "public",
      ownerId: user.id,
      forkedFromId: source.id,
    })
    .returning();

  const sourcePrefix = getRepoPrefix(source.ownerId, source.name);
  const targetPrefix = getRepoPrefix(user.id, targetName);
  await copyPrefix(sourcePrefix, targetPrefix);

  const sourceMetadata = await db.query.repoBranchMetadata.findMany({
    where: eq(repoBranchMetadata.repoId, source.id),
  });

  if (sourceMetadata.length > 0) {
    await db.insert(repoBranchMetadata).values(
      sourceMetadata.map((row) => ({
        repoId: forkRepo.id,
        branch: row.branch,
        headOid: row.headOid,
        commitCount: row.commitCount,
        lastCommitOid: row.lastCommitOid,
        lastCommitMessage: row.lastCommitMessage,
        lastCommitAuthorName: row.lastCommitAuthorName,
        lastCommitAuthorEmail: row.lastCommitAuthorEmail,
        lastCommitTimestamp: row.lastCommitTimestamp,
        readmeOid: row.readmeOid,
        rootTree: row.rootTree,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );
  }

  const forkedFrom = await getForkedFromInfo(source.id, user.id);

  return c.json({
    repo: {
      id: forkRepo.id,
      name: forkRepo.name,
      description: forkRepo.description,
      visibility: forkRepo.visibility,
      defaultBranch: forkRepo.defaultBranch,
      createdAt: forkRepo.createdAt,
      updatedAt: forkRepo.updatedAt,
      ownerId: forkRepo.ownerId,
      owner: {
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      starCount: 0,
      starred: false,
      forkedFrom,
      forkCount: 0,
    },
    isOwner: true,
  });
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
    starCount: Number(row.starCount) || 0,
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
        starCount: Number(starCount?.count) || 0,
      };
    })
  );

  return c.json({ repos: reposWithStars });
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
      forkedFromId: repositories.forkedFromId,
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

  const forkedFrom = await getForkedFromInfo(row.forkedFromId, currentUser?.id);
  const forkCount = await getForkCount(row.id);

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
    starCount: Number(starCount?.count) || 0,
    forkedFrom,
    forkCount,
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
      forkedFromId: repositories.forkedFromId,
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

  const forkedFrom = await getForkedFromInfo(row.forkedFromId, currentUser?.id);
  const forkCount = await getForkCount(row.id);

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
    starCount: Number(starCount?.count) || 0,
    starred,
    forkedFrom,
    forkCount,
  });
});

app.get("/api/repositories/:owner/:name/forks", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const sourceResult = await db
    .select({
      id: repositories.id,
      ownerId: repositories.ownerId,
      visibility: repositories.visibility,
    })
    .from(repositories)
    .innerJoin(users, eq(users.id, repositories.ownerId))
    .where(and(eq(users.username, owner), eq(repositories.name, name)))
    .limit(1);

  const source = sourceResult[0];
  if (!source) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (source.visibility === "private" && currentUser?.id !== source.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const forkRows = await db
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
    .where(eq(repositories.forkedFromId, source.id))
    .orderBy(desc(repositories.updatedAt))
    .limit(limit)
    .offset(offset);

  const forks = await Promise.all(
    forkRows.map(async (row) => {
      const [starCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(stars)
        .where(eq(stars.repositoryId, row.id));

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        visibility: row.visibility,
        defaultBranch: row.defaultBranch,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        ownerId: row.ownerId,
        owner: {
          id: row.ownerId,
          username: row.username,
          name: row.userName,
          avatarUrl: row.avatarUrl,
        },
        starCount: Number(starCount?.count) || 0,
      };
    })
  );

  return c.json({ forks });
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

  console.log(`[API] Deleting repository ${user.id}/${repo.name}`);
  const repoPrefix = getRepoPrefix(user.id, repo.name);

  const keys = await listObjects(repoPrefix);
  console.log(`[API] Found ${keys.length} objects to delete`);

  await deletePrefix(repoPrefix);
  console.log(`[API] Deleted all objects for repository`);

  await repoCache.invalidateRepo(user.id, repo.name);
  console.log(`[API] Invalidated Redis cache for repository`);

  await db.delete(repositories).where(eq(repositories.id, id));
  console.log(`[API] Deleted repository record`);

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

export default app;
