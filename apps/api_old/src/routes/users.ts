import { type Hono } from "hono";
import { type AppEnv } from "../types";
import { authMiddleware } from "../middleware/auth";
import { users, repositories, stars } from "@gitbruv/db";
import { eq, and, desc, sql } from "drizzle-orm";

export function registerUserRoutes(app: Hono<AppEnv>) {
  app.get("/api/users/:username/starred", authMiddleware, async (c) => {
    const username = c.req.param("username")!;
    const db = c.get("db");

    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user) {
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
        starCount: sql<number>`(SELECT COUNT(*) FROM stars WHERE stars.repository_id = ${repositories.id})`.as("star_count"),
      })
      .from(stars)
      .innerJoin(repositories, eq(stars.repositoryId, repositories.id))
      .innerJoin(users, eq(repositories.ownerId, users.id))
      .where(and(eq(stars.userId, user.id), eq(repositories.visibility, "public")))
      .orderBy(desc(stars.createdAt));

    return c.json({
      repos: starredRepos.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        visibility: r.visibility as "public" | "private",
        defaultBranch: r.defaultBranch,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        starCount: Number(r.starCount),
        starredAt: r.starredAt,
        owner: {
          id: r.ownerId,
          username: r.ownerUsername,
          name: r.ownerName,
          avatarUrl: r.ownerAvatarUrl,
        },
      })),
    });
  });

  app.get("/api/users/:username/profile", authMiddleware, async (c) => {
    const username = c.req.param("username")!;
    const db = c.get("db");
    const sessionUser = c.get("user");

    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const isOwnProfile = sessionUser?.id === user.id;

    return c.json({
      id: user.id,
      name: user.name,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      location: user.location,
      website: user.website,
      pronouns: user.pronouns,
      socialLinks: user.socialLinks,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ...(isOwnProfile ? { email: user.email, emailVerified: user.emailVerified } : {}),
    });
  });

  app.get("/api/users/by-email/:email/avatar", authMiddleware, async (c) => {
    const email = c.req.param("email")!;
    const db = c.get("db");

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: {
        avatarUrl: true,
      },
    });

    if (!user) {
      return c.json({ avatarUrl: null });
    }

    return c.json({ avatarUrl: user.avatarUrl });
  });

  app.get("/api/users/public", async (c) => {
    const db = c.get("db");
    const sortBy = (c.req.query("sortBy") || "newest") as "newest" | "oldest";
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const offset = parseInt(c.req.query("offset") || "0", 10);

    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        createdAt: users.createdAt,
        repoCount: sql<number>`(SELECT COUNT(*) FROM repositories WHERE repositories.owner_id = users.id AND repositories.visibility = 'public')`.as(
          "repo_count"
        ),
      })
      .from(users)
      .orderBy(sortBy === "newest" ? desc(users.createdAt) : users.createdAt)
      .limit(limit + 1)
      .offset(offset);

    const hasMore = allUsers.length > limit;
    const result = allUsers.slice(0, limit);

    return c.json({
      users: result.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        createdAt: u.createdAt,
        repoCount: Number(u.repoCount),
      })),
      hasMore,
    });
  });
}
