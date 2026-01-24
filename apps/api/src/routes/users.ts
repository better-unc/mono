import { Hono } from "hono";
import { db, users, repositories, stars } from "@gitbruv/db";
import { eq, sql, desc, asc, and } from "drizzle-orm";
import { authMiddleware, requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", authMiddleware);

function cacheBustAvatarUrl(avatarUrl: string | null, updatedAt: Date): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.includes("v=")) return avatarUrl;
  const separator = avatarUrl.includes("?") ? "&" : "?";
  return `${avatarUrl}${separator}v=${updatedAt.getTime()}`;
}

app.get("/api/users/me", requireAuth, async (c) => {
  const user = c.get("user")!;
  const result = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (!result) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(result);
});

app.get("/api/users/me/summary", requireAuth, async (c) => {
  const user = c.get("user")!;
  const result = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      name: true,
      avatarUrl: true,
      updatedAt: true,
    },
  });

  if (!result) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    name: result.name,
    avatarUrl: cacheBustAvatarUrl(result.avatarUrl, result.updatedAt),
  });
});

app.get("/api/users/public", async (c) => {
  const sortBy = c.req.query("sortBy") || "newest";
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const orderBy = sortBy === "oldest" ? asc(users.createdAt) : desc(users.createdAt);

  const usersResult = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(orderBy)
    .limit(limit + 1)
    .offset(offset);

  const result = await Promise.all(
    usersResult.map(async (user) => {
      const [repoCountResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(repositories)
        .where(and(eq(repositories.ownerId, user.id), eq(repositories.visibility, "public")));

      return {
        ...user,
        avatarUrl: cacheBustAvatarUrl(user.avatarUrl, user.updatedAt),
        repoCount: Number(repoCountResult?.count) || 0,
      };
    })
  );

  const hasMore = result.length > limit;
  const usersData = result.slice(0, limit);

  return c.json({
    users: usersData,
    hasMore,
  });
});

app.get("/api/users/:username/avatar", async (c) => {
  const username = c.req.param("username");

  const result = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: {
      avatarUrl: true,
      updatedAt: true,
    },
  });

  return c.json({
    avatarUrl: result ? cacheBustAvatarUrl(result.avatarUrl, result.updatedAt) : null,
  });
});

app.get("/api/users/:username", async (c) => {
  const username = c.req.param("username");

  const result = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: {
      id: true,
      username: true,
      name: true,
      bio: true,
      location: true,
      website: true,
      pronouns: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!result) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(result);
});

app.get("/api/users/:username/profile", async (c) => {
  const username = c.req.param("username");
  const currentUser = c.get("user");

  const result = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!result) {
    return c.json({ error: "User not found" }, 404);
  }

  const isOwnProfile = currentUser?.id === result.id;

  const response: Record<string, any> = {
    id: result.id,
    name: result.name,
    username: result.username,
    avatarUrl: cacheBustAvatarUrl(result.avatarUrl, result.updatedAt),
    bio: result.bio,
    location: result.location,
    website: result.website,
    pronouns: result.pronouns,
    company: result.company,
    gitEmail: result.gitEmail,
    defaultRepositoryVisibility: result.defaultRepositoryVisibility,
    preferences: result.preferences,
    socialLinks: result.socialLinks,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };

  if (result.lastActiveAt) {
    response.lastActiveAt = result.lastActiveAt;
  }

  if (isOwnProfile) {
    response.email = result.email;
    response.emailVerified = result.emailVerified;
  }

  return c.json(response);
});

app.get("/api/users/:username/starred", async (c) => {
  const username = c.req.param("username");

  const userResult = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: { id: true },
  });

  if (!userResult) {
    return c.json({ repos: [] });
  }

  const starredRepos = await db
    .select({
      id: repositories.id,
      name: repositories.name,
      description: repositories.description,
      visibility: repositories.visibility,
      defaultBranch: repositories.defaultBranch,
      createdAt: repositories.createdAt,
      updatedAt: repositories.updatedAt,
      ownerId: repositories.ownerId,
      ownerUsername: users.username,
      ownerName: users.name,
      ownerAvatarUrl: users.avatarUrl,
      starredAt: stars.createdAt,
      starCount: sql<number>`(SELECT COUNT(*) FROM stars WHERE repository_id = ${repositories.id})`.as("star_count"),
    })
    .from(stars)
    .innerJoin(repositories, eq(stars.repositoryId, repositories.id))
    .innerJoin(users, eq(repositories.ownerId, users.id))
    .where(and(eq(stars.userId, userResult.id), eq(repositories.visibility, "public")))
    .orderBy(desc(stars.createdAt));

  const repos = starredRepos.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    visibility: r.visibility,
    defaultBranch: r.defaultBranch,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    starCount: Number(r.starCount) || 0,
    starredAt: r.starredAt,
    owner: {
      id: r.ownerId,
      username: r.ownerUsername,
      name: r.ownerName,
      avatarUrl: r.ownerAvatarUrl,
    },
  }));

  return c.json({ repos });
});

export default app;
