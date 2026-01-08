import { type Hono } from "hono";
import { type AppEnv } from "../types";
import { authMiddleware } from "../middleware/auth";
import { repositories, users, stars } from "@gitbruv/db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import git from "isomorphic-git";
import { createR2Fs, getRepoPrefix, s3DeletePrefix } from "../r2-fs";

export function registerRepositoryRoutes(app: Hono<AppEnv>) {
  app.post("/api/repositories", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const data = await c.req.json<{ name: string; description?: string; visibility: "public" | "private" }>();
    const db = c.get("db");

    const normalizedName = data.name.toLowerCase().replace(/\s+/g, "-");

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
        description: data.description || null,
        visibility: data.visibility,
        ownerId: user.id,
      })
      .returning();

    const repoPrefix = getRepoPrefix(user.id, `${normalizedName}.git`);
    const s3 = c.get("s3");
    const fs = createR2Fs(s3, repoPrefix);

    await fs.writeFile("/HEAD", "ref: refs/heads/main\n");
    await fs.writeFile(
      "/config",
      `[core]
\trepositoryformatversion = 0
\tfilemode = true
\tbare = true
`
    );
    await fs.writeFile("/description", "Unnamed repository; edit this file to name the repository.\n");

    return c.json(repo);
  });

  app.get("/api/repositories/user/:username", authMiddleware, async (c) => {
    const username = c.req.param("username")!;
    const db = c.get("db");

    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user) {
      return c.json({ repos: [] });
    }

    const sessionUser = c.get("user");
    const isOwner = sessionUser?.id === user.id;

    const repos = await db.query.repositories.findMany({
      where: isOwner ? eq(repositories.ownerId, user.id) : and(eq(repositories.ownerId, user.id), eq(repositories.visibility, "public")),
      orderBy: [desc(repositories.updatedAt)],
    });

    const reposWithStars = await Promise.all(
      repos.map(async (repo) => {
        const starCountResult = await db.select({ count: count() }).from(stars).where(eq(stars.repositoryId, repo.id));
        return {
          ...repo,
          starCount: starCountResult[0]?.count ?? 0,
          owner: {
            id: user.id,
            username: user.username,
            name: user.name,
            avatarUrl: user.avatarUrl,
          },
        };
      })
    );

    return c.json({ repos: reposWithStars });
  });

  app.get("/api/repositories/:owner/:name", authMiddleware, async (c) => {
    const owner = c.req.param("owner")!;
    const name = c.req.param("name")!;
    const db = c.get("db");

    const user = await db.query.users.findFirst({
      where: eq(users.username, owner),
    });

    if (!user) {
      return c.json({ error: "Repository not found" }, 404);
    }

    const repo = await db.query.repositories.findFirst({
      where: and(eq(repositories.ownerId, user.id), eq(repositories.name, name)),
    });

    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }

    const sessionUser = c.get("user");
    if (repo.visibility === "private") {
      if (!sessionUser || sessionUser.id !== repo.ownerId) {
        return c.json({ error: "Repository not found" }, 404);
      }
    }

    return c.json({
      ...repo,
      owner: {
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  });

  app.delete("/api/repositories/:id", authMiddleware, async (c) => {
    const repoId = c.req.param("id")!;
    const user = c.get("user");
    const db = c.get("db");

    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const repo = await db.query.repositories.findFirst({
      where: eq(repositories.id, repoId),
    });

    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }

    if (repo.ownerId !== user.id) {
      return c.text("Unauthorized", 401);
    }

    const repoPrefix = getRepoPrefix(user.id, `${repo.name}.git`);
    const s3 = c.get("s3");
    try {
      await s3DeletePrefix(s3, repoPrefix);
    } catch {}

    await db.delete(repositories).where(eq(repositories.id, repoId));

    return c.json({ success: true });
  });

  app.patch("/api/repositories/:id", authMiddleware, async (c) => {
    const repoId = c.req.param("id")!;
    const user = c.get("user");
    const db = c.get("db");

    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const repo = await db.query.repositories.findFirst({
      where: eq(repositories.id, repoId),
    });

    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }

    if (repo.ownerId !== user.id) {
      return c.text("Unauthorized", 401);
    }

    const data = await c.req.json<{ name?: string; description?: string; visibility?: "public" | "private" }>();
    const oldName = repo.name;
    let newName = oldName;

    if (data.name && data.name !== oldName) {
      newName = data.name.toLowerCase().replace(/\s+/g, "-");

      if (!/^[a-zA-Z0-9_.-]+$/.test(newName)) {
        return c.json({ error: "Invalid repository name" }, 400);
      }

      const existing = await db.query.repositories.findFirst({
        where: and(eq(repositories.ownerId, user.id), eq(repositories.name, newName)),
      });

      if (existing) {
        return c.json({ error: "Repository with this name already exists" }, 400);
      }
    }

    const [updated] = await db
      .update(repositories)
      .set({
        name: newName,
        description: data.description !== undefined ? data.description || null : repo.description,
        visibility: data.visibility || repo.visibility,
        updatedAt: new Date(),
      })
      .where(eq(repositories.id, repoId))
      .returning();

    return c.json(updated);
  });

  app.get("/api/repositories/:owner/:name/with-stars", authMiddleware, async (c) => {
    const owner = c.req.param("owner")!;
    const name = c.req.param("name")!;
    const db = c.get("db");

    const user = await db.query.users.findFirst({
      where: eq(users.username, owner),
    });

    if (!user) {
      return c.json({ error: "Repository not found" }, 404);
    }

    const repo = await db.query.repositories.findFirst({
      where: and(eq(repositories.ownerId, user.id), eq(repositories.name, name)),
    });

    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }

    const sessionUser = c.get("user");
    if (repo.visibility === "private") {
      if (!sessionUser || sessionUser.id !== repo.ownerId) {
        return c.json({ error: "Repository not found" }, 404);
      }
    }

    const [starCountResult, starredResult] = await Promise.all([
      db.select({ count: count() }).from(stars).where(eq(stars.repositoryId, repo.id)),
      sessionUser ? db.query.stars.findFirst({ where: and(eq(stars.userId, sessionUser.id), eq(stars.repositoryId, repo.id)) }) : Promise.resolve(null),
    ]);

    const starCount = starCountResult[0]?.count ?? 0;
    const starred = !!starredResult;

    return c.json({
      ...repo,
      owner: {
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      starCount,
      starred,
    });
  });

  app.post("/api/repositories/:id/star", authMiddleware, async (c) => {
    const repoId = c.req.param("id")!;
    const user = c.get("user");
    const db = c.get("db");

    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const existing = await db.query.stars.findFirst({
      where: and(eq(stars.userId, user.id), eq(stars.repositoryId, repoId)),
    });

    if (existing) {
      await db.delete(stars).where(and(eq(stars.userId, user.id), eq(stars.repositoryId, repoId)));
      return c.json({ starred: false });
    } else {
      await db.insert(stars).values({
        userId: user.id,
        repositoryId: repoId,
      });
      return c.json({ starred: true });
    }
  });

  app.get("/api/repositories/:owner/:name/branches", authMiddleware, async (c) => {
    const owner = c.req.param("owner")!;
    const name = c.req.param("name")!;
    const db = c.get("db");

    const user = await db.query.users.findFirst({
      where: eq(users.username, owner),
    });

    if (!user) {
      return c.json({ branches: [] });
    }

    const repoPrefix = getRepoPrefix(user.id, `${name}.git`);
    const s3 = c.get("s3");
    const fs = createR2Fs(s3, repoPrefix);

    try {
      const branches = await git.listBranches({ fs, gitdir: "/" });
      return c.json({ branches });
    } catch {
      return c.json({ branches: [] });
    }
  });

  app.get("/api/repositories/:owner/:name/commits", authMiddleware, async (c) => {
    const owner = c.req.param("owner")!;
    const name = c.req.param("name")!;
    const branch = c.req.query("branch") || "main";
    const limit = parseInt(c.req.query("limit") || "30", 10);
    const skip = parseInt(c.req.query("skip") || "0", 10);
    const db = c.get("db");

    const user = await db.query.users.findFirst({
      where: eq(users.username, owner),
    });

    if (!user) {
      return c.json({ commits: [], hasMore: false });
    }

    const repoPrefix = getRepoPrefix(user.id, `${name}.git`);
    const s3 = c.get("s3");
    const fs = createR2Fs(s3, repoPrefix);

    try {
      const commits = await git.log({
        fs,
        gitdir: "/",
        ref: branch,
        depth: skip + limit + 1,
      });

      const paginatedCommits = commits.slice(skip, skip + limit);
      const hasMore = commits.length > skip + limit;

      return c.json({
        commits: paginatedCommits.map((c) => ({
          oid: c.oid,
          message: c.commit.message,
          author: {
            name: c.commit.author.name,
            email: c.commit.author.email,
          },
          timestamp: c.commit.author.timestamp * 1000,
        })),
        hasMore,
      });
    } catch {
      return c.json({ commits: [], hasMore: false });
    }
  });

  app.get("/api/repositories/:owner/:name/commits/count", authMiddleware, async (c) => {
    const owner = c.req.param("owner")!;
    const name = c.req.param("name")!;
    const branch = c.req.query("branch") || "main";
    const db = c.get("db");

    const user = await db.query.users.findFirst({
      where: eq(users.username, owner),
    });

    if (!user) {
      return c.json({ count: 0 });
    }

    const repo = await db.query.repositories.findFirst({
      where: and(eq(repositories.ownerId, user.id), eq(repositories.name, name)),
    });

    if (!repo) {
      return c.json({ count: 0 });
    }

    const repoPrefix = getRepoPrefix(user.id, `${name}.git`);
    const s3 = c.get("s3");
    const fs = createR2Fs(s3, repoPrefix);

    try {
      const commits = await git.log({
        fs,
        gitdir: "/",
        ref: branch,
      });
      return c.json({ count: commits.length });
    } catch {
      return c.json({ count: 0 });
    }
  });

  app.get("/api/repositories/:owner/:name/tree", authMiddleware, async (c) => {
    const owner = c.req.param("owner")!;
    const name = c.req.param("name")!;
    const branch = c.req.query("branch") || "main";
    const dirPath = c.req.query("path") || "";
    const db = c.get("db");

    const user = await db.query.users.findFirst({
      where: eq(users.username, owner),
    });

    if (!user) {
      return c.json({ files: [], isEmpty: true });
    }

    const repoPrefix = getRepoPrefix(user.id, `${name}.git`);
    const s3 = c.get("s3");
    const fs = createR2Fs(s3, repoPrefix);

    try {
      const commits = await git.log({
        fs,
        gitdir: "/",
        ref: branch,
        depth: 1,
      });

      if (commits.length === 0) {
        return c.json({ files: [], isEmpty: true });
      }

      const commitOid = commits[0].oid;
      const { tree } = await git.readTree({
        fs,
        gitdir: "/",
        oid: commitOid,
      });

      let targetTree = tree;

      if (dirPath) {
        const parts = dirPath.split("/").filter(Boolean);
        for (const part of parts) {
          const entry = targetTree.find((e) => e.path === part && e.type === "tree");
          if (!entry) {
            return c.json({ files: [], isEmpty: false });
          }
          const subTree = await git.readTree({
            fs,
            gitdir: "/",
            oid: entry.oid,
          });
          targetTree = subTree.tree;
        }
      }

      const entries = targetTree
        .map((entry) => ({
          name: entry.path,
          type: entry.type as "blob" | "tree",
          oid: entry.oid,
          path: dirPath ? `${dirPath}/${entry.path}` : entry.path,
        }))
        .sort((a, b) => {
          if (a.type === "tree" && b.type !== "tree") return -1;
          if (a.type !== "tree" && b.type === "tree") return 1;
          return a.name.localeCompare(b.name);
        });

      return c.json({ files: entries, isEmpty: false });
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code !== "NotFoundError") {
        console.error("getRepoFileTree error:", err);
      }
      return c.json({ files: [], isEmpty: true });
    }
  });

  app.get("/api/repositories/:owner/:name/file", authMiddleware, async (c) => {
    const owner = c.req.param("owner")!;
    const name = c.req.param("name")!;
    const branch = c.req.query("branch") || "main";
    const filePath = c.req.query("path")!;
    const db = c.get("db");

    if (!filePath) {
      return c.json({ error: "File path is required" }, 400);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.username, owner),
    });

    if (!user) {
      return c.json({ error: "Repository not found" }, 404);
    }

    const repoPrefix = getRepoPrefix(user.id, `${name}.git`);
    const s3 = c.get("s3");
    const fs = createR2Fs(s3, repoPrefix);

    try {
      const commits = await git.log({
        fs,
        gitdir: "/",
        ref: branch,
        depth: 1,
      });

      if (commits.length === 0) {
        return c.json({ error: "Branch not found" }, 404);
      }

      const commitOid = commits[0].oid;
      const parts = filePath.split("/").filter(Boolean);
      const fileName = parts.pop()!;

      let currentTree = (await git.readTree({ fs, gitdir: "/", oid: commitOid })).tree;

      for (const part of parts) {
        const entry = currentTree.find((e) => e.path === part && e.type === "tree");
        if (!entry) return c.json({ error: "File not found" }, 404);
        currentTree = (await git.readTree({ fs, gitdir: "/", oid: entry.oid })).tree;
      }

      const fileEntry = currentTree.find((e) => e.path === fileName && e.type === "blob");
      if (!fileEntry) return c.json({ error: "File not found" }, 404);

      const { blob } = await git.readBlob({
        fs,
        gitdir: "/",
        oid: fileEntry.oid,
      });

      const decoder = new TextDecoder("utf-8");
      const content = decoder.decode(blob);

      return c.json({
        content,
        oid: fileEntry.oid,
        path: filePath,
      });
    } catch (err) {
      console.error("getRepoFile error:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  app.get("/api/repositories/:owner/:name/page-data", authMiddleware, async (c) => {
    const owner = c.req.param("owner")!;
    const name = c.req.param("name")!;
    const db = c.get("db");

    const [user, sessionUser] = await Promise.all([db.query.users.findFirst({ where: eq(users.username, owner) }), c.get("user")]);

    if (!user) {
      return c.json({ error: "Repository not found" }, 404);
    }

    const repo = await db.query.repositories.findFirst({
      where: and(eq(repositories.ownerId, user.id), eq(repositories.name, name)),
    });

    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }

    if (repo.visibility === "private" && (!sessionUser || sessionUser.id !== repo.ownerId)) {
      return c.json({ error: "Repository not found" }, 404);
    }

    const repoPrefix = getRepoPrefix(user.id, `${name}.git`);
    const s3 = c.get("s3");
    const fs = createR2Fs(s3, repoPrefix);

    let files: Array<{ name: string; type: "blob" | "tree"; oid: string; path: string }> = [];
    let isEmpty = true;
    let branches: string[] = [];
    let readmeOid: string | null = null;

    try {
      const [branchList, commits] = await Promise.all([git.listBranches({ fs, gitdir: "/" }), git.log({ fs, gitdir: "/", ref: repo.defaultBranch, depth: 1 })]);

      branches = branchList;

      if (commits.length > 0) {
        isEmpty = false;
        const commitOid = commits[0].oid;
        const { tree } = await git.readTree({ fs, gitdir: "/", oid: commitOid });

        files = tree
          .map((entry) => ({
            name: entry.path,
            type: entry.type as "blob" | "tree",
            oid: entry.oid,
            path: entry.path,
          }))
          .sort((a, b) => {
            if (a.type === "tree" && b.type !== "tree") return -1;
            if (a.type !== "tree" && b.type === "tree") return 1;
            return a.name.localeCompare(b.name);
          });

        const readmeEntry = tree.find((e) => e.path.toLowerCase() === "readme.md" && e.type === "blob");
        if (readmeEntry) {
          readmeOid = readmeEntry.oid;
        }
      }
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code !== "NotFoundError") {
        console.error("fetchFileTree error:", err);
      }
    }

    const [starCountResult, starredResult] = await Promise.all([
      db.select({ count: count() }).from(stars).where(eq(stars.repositoryId, repo.id)),
      sessionUser ? db.query.stars.findFirst({ where: and(eq(stars.userId, sessionUser.id), eq(stars.repositoryId, repo.id)) }) : Promise.resolve(null),
    ]);

    const starCount = starCountResult[0]?.count ?? 0;
    const starred = !!starredResult;
    const isOwner = sessionUser?.id === repo.ownerId;

    return c.json({
      repo: {
        ...repo,
        owner: { id: user.id, username: user.username, name: user.name, avatarUrl: user.avatarUrl },
        starCount,
        starred,
      },
      files,
      isEmpty,
      branches,
      readmeOid,
      isOwner,
    });
  });

  app.get("/api/repositories/:owner/:name/readme", authMiddleware, async (c) => {
    const owner = c.req.param("owner")!;
    const name = c.req.param("name")!;
    const readmeOid = c.req.query("oid")!;
    const db = c.get("db");

    if (!readmeOid) {
      return c.json({ error: "Readme OID is required" }, 400);
    }

    const user = await db.query.users.findFirst({ where: eq(users.username, owner) });
    if (!user) {
      return c.json({ error: "Repository not found" }, 404);
    }

    const repoPrefix = getRepoPrefix(user.id, `${name}.git`);
    const s3 = c.get("s3");
    const fs = createR2Fs(s3, repoPrefix);

    try {
      const { blob } = await git.readBlob({ fs, gitdir: "/", oid: readmeOid });
      return c.json({ content: new TextDecoder("utf-8").decode(blob) });
    } catch {
      return c.json({ error: "Readme not found" }, 404);
    }
  });

  app.get("/api/repositories/public", authMiddleware, async (c) => {
    const sortBy = (c.req.query("sortBy") || "updated") as "stars" | "updated" | "created";
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const offset = parseInt(c.req.query("offset") || "0", 10);
    const db = c.get("db");

    const allRepos = await db
      .select({
        id: repositories.id,
        name: repositories.name,
        description: repositories.description,
        visibility: repositories.visibility,
        ownerId: repositories.ownerId,
        defaultBranch: repositories.defaultBranch,
        createdAt: repositories.createdAt,
        updatedAt: repositories.updatedAt,
        ownerUsername: users.username,
        ownerName: users.name,
        ownerAvatarUrl: users.avatarUrl,
        starCount: sql<number>`(SELECT COUNT(*) FROM stars WHERE stars.repository_id = ${repositories.id})`.as("star_count"),
      })
      .from(repositories)
      .innerJoin(users, eq(repositories.ownerId, users.id))
      .where(eq(repositories.visibility, "public"))
      .orderBy(sortBy === "stars" ? desc(sql`star_count`) : sortBy === "created" ? desc(repositories.createdAt) : desc(repositories.updatedAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = allRepos.length > limit;
    const repos = allRepos.slice(0, limit);

    return c.json({
      repos: repos.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        visibility: r.visibility as "public" | "private",
        defaultBranch: r.defaultBranch,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        starCount: Number(r.starCount),
        owner: {
          id: r.ownerId,
          username: r.ownerUsername,
          name: r.ownerName,
          avatarUrl: r.ownerAvatarUrl,
        },
      })),
      hasMore,
    });
  });

}
