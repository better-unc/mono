import { Hono } from "hono";
import { db, users, repositories, issues, pullRequests } from "@gitbruv/db";
import { eq, sql, and, or, ilike, desc } from "drizzle-orm";
import { authMiddleware, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", authMiddleware);

type SearchResultType = "repository" | "issue" | "pull_request" | "user";

type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  description?: string | null;
  url: string;
  owner?: { username: string; avatarUrl: string | null };
  repository?: { name: string; owner: string };
  state?: string;
  number?: number;
  createdAt: string;
};

app.get("/api/search", async (c) => {
  const query = c.req.query("q")?.trim();
  const type = c.req.query("type") || "all";
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);
  const offset = parseInt(c.req.query("offset") || "0", 10);
  const currentUser = c.get("user");

  if (!query || query.length < 2) {
    return c.json({ results: [], hasMore: false, total: 0 });
  }

  const searchPattern = `%${query}%`;
  const results: SearchResult[] = [];

  if (type === "all" || type === "repositories" || type === "repos") {
    const repoResults = await db
      .select({
        id: repositories.id,
        name: repositories.name,
        description: repositories.description,
        visibility: repositories.visibility,
        ownerId: repositories.ownerId,
        ownerUsername: users.username,
        ownerAvatar: users.avatarUrl,
        createdAt: repositories.createdAt,
      })
      .from(repositories)
      .innerJoin(users, eq(users.id, repositories.ownerId))
      .where(
        and(
          or(
            ilike(repositories.name, searchPattern),
            ilike(repositories.description, searchPattern)
          ),
          or(
            eq(repositories.visibility, "public"),
            currentUser ? eq(repositories.ownerId, currentUser.id) : sql`false`
          )
        )
      )
      .orderBy(desc(repositories.createdAt))
      .limit(type === "all" ? 5 : limit)
      .offset(type === "all" ? 0 : offset);

    for (const repo of repoResults) {
      results.push({
        type: "repository",
        id: repo.id,
        title: repo.name,
        description: repo.description,
        url: `/${repo.ownerUsername}/${repo.name}`,
        owner: { username: repo.ownerUsername, avatarUrl: repo.ownerAvatar },
        createdAt: repo.createdAt.toISOString(),
      });
    }
  }

  if (type === "all" || type === "issues") {
    const issueResults = await db
      .select({
        id: issues.id,
        number: issues.number,
        title: issues.title,
        body: issues.body,
        state: issues.state,
        repoId: repositories.id,
        repoName: repositories.name,
        repoVisibility: repositories.visibility,
        repoOwnerId: repositories.ownerId,
        ownerUsername: users.username,
        createdAt: issues.createdAt,
      })
      .from(issues)
      .innerJoin(repositories, eq(repositories.id, issues.repositoryId))
      .innerJoin(users, eq(users.id, repositories.ownerId))
      .where(
        and(
          or(
            ilike(issues.title, searchPattern),
            ilike(issues.body, searchPattern)
          ),
          or(
            eq(repositories.visibility, "public"),
            currentUser ? eq(repositories.ownerId, currentUser.id) : sql`false`
          )
        )
      )
      .orderBy(desc(issues.createdAt))
      .limit(type === "all" ? 5 : limit)
      .offset(type === "all" ? 0 : offset);

    for (const issue of issueResults) {
      results.push({
        type: "issue",
        id: issue.id,
        title: issue.title,
        description: issue.body?.slice(0, 200),
        url: `/${issue.ownerUsername}/${issue.repoName}/issues/${issue.number}`,
        repository: { name: issue.repoName, owner: issue.ownerUsername },
        state: issue.state,
        number: issue.number,
        createdAt: issue.createdAt.toISOString(),
      });
    }
  }

  if (type === "all" || type === "pulls" || type === "prs") {
    const prResults = await db
      .select({
        id: pullRequests.id,
        number: pullRequests.number,
        title: pullRequests.title,
        body: pullRequests.body,
        state: pullRequests.state,
        repoId: repositories.id,
        repoName: repositories.name,
        repoVisibility: repositories.visibility,
        repoOwnerId: repositories.ownerId,
        ownerUsername: users.username,
        createdAt: pullRequests.createdAt,
      })
      .from(pullRequests)
      .innerJoin(repositories, eq(repositories.id, pullRequests.repositoryId))
      .innerJoin(users, eq(users.id, repositories.ownerId))
      .where(
        and(
          or(
            ilike(pullRequests.title, searchPattern),
            ilike(pullRequests.body, searchPattern)
          ),
          or(
            eq(repositories.visibility, "public"),
            currentUser ? eq(repositories.ownerId, currentUser.id) : sql`false`
          )
        )
      )
      .orderBy(desc(pullRequests.createdAt))
      .limit(type === "all" ? 5 : limit)
      .offset(type === "all" ? 0 : offset);

    for (const pr of prResults) {
      results.push({
        type: "pull_request",
        id: pr.id,
        title: pr.title,
        description: pr.body?.slice(0, 200),
        url: `/${pr.ownerUsername}/${pr.repoName}/pulls/${pr.number}`,
        repository: { name: pr.repoName, owner: pr.ownerUsername },
        state: pr.state,
        number: pr.number,
        createdAt: pr.createdAt.toISOString(),
      });
    }
  }

  if (type === "all" || type === "users") {
    const userResults = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        or(
          ilike(users.username, searchPattern),
          ilike(users.name, searchPattern),
          ilike(users.bio, searchPattern)
        )
      )
      .orderBy(desc(users.createdAt))
      .limit(type === "all" ? 5 : limit)
      .offset(type === "all" ? 0 : offset);

    for (const user of userResults) {
      results.push({
        type: "user",
        id: user.id,
        title: user.username,
        description: user.bio || user.name,
        url: `/${user.username}`,
        owner: { username: user.username, avatarUrl: user.avatarUrl },
        createdAt: user.createdAt.toISOString(),
      });
    }
  }

  if (type === "all") {
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return c.json({
    results: results.slice(0, limit),
    hasMore: results.length > limit,
    query,
  });
});

export default app;
