import { Hono } from "hono";
import { db, users, repositories, stars, repoBranchMetadata } from "@gitbruv/db";
import { eq, sql, and } from "drizzle-orm";
import { authMiddleware, type AuthVariables } from "../middleware/auth";
import {
  createGitStore,
  listBranchesCached,
  getCommitsCached,
  getCommitCountCached,
  getTreeCached,
  getFileCached,
  getBlobByOid,
  getCommitDiff,
} from "../git";

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

async function getRepoAndStore(owner: string, name: string) {
  const repoName = name.replace(/\.git$/, "");

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
      userId: users.id,
    })
    .from(repositories)
    .innerJoin(users, eq(users.id, repositories.ownerId))
    .where(and(eq(users.username, owner), eq(repositories.name, repoName)))
    .limit(1);

  const row = result[0];
  if (!row) {
    return null;
  }

  const store = createGitStore(row.userId, row.name);
  return {
    repo: {
      id: row.id,
      name: row.name,
      description: row.description,
      ownerId: row.ownerId,
      visibility: row.visibility,
      defaultBranch: row.defaultBranch,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    store,
    userId: row.userId,
  };
}

async function getUsersByEmails(emails: string[]): Promise<Map<string, { id: string; username: string; avatarUrl: string | null }>> {
  if (emails.length === 0) return new Map();

  const result = await db
    .select({
      email: users.email,
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(sql`${users.email} IN ${emails}`);

  return new Map(result.map((u) => [u.email, { id: u.id, username: u.username, avatarUrl: u.avatarUrl }]));
}

app.get("/api/repositories/:owner/:name/branches", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");

  const result = await getRepoAndStore(owner, name);
  if (!result) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const { repo, store } = result;

  if (repo.visibility === "private" && currentUser?.id !== repo.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const branches = await listBranchesCached(store);
  return c.json({ branches });
});

app.get("/api/repositories/:owner/:name/commits", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");
  const branch = c.req.query("branch") || "main";
  const limit = parseInt(c.req.query("limit") || "30", 10);
  const skip = parseInt(c.req.query("skip") || "0", 10);

  const result = await getRepoAndStore(owner, name);
  if (!result) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const { repo, store } = result;

  if (repo.visibility === "private" && currentUser?.id !== repo.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const { commits, hasMore } = await getCommitsCached(store, branch, limit, skip);

  const emails = commits.map((c) => c.author.email);
  const userMap = await getUsersByEmails(emails);

  const enrichedCommits = commits.map((commit) => {
    const user = userMap.get(commit.author.email);
    return {
      ...commit,
      author: {
        ...commit.author,
        username: user?.username,
        userId: user?.id,
        avatarUrl: user?.avatarUrl,
      },
    };
  });

  return c.json({ commits: enrichedCommits, hasMore });
});

app.get("/api/repositories/:owner/:name/commits/count", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");
  const branch = c.req.query("branch") || "main";

  const result = await getRepoAndStore(owner, name);
  if (!result) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const { repo, store } = result;

  if (repo.visibility === "private" && currentUser?.id !== repo.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const metadata = await db.query.repoBranchMetadata.findFirst({
    where: and(eq(repoBranchMetadata.repoId, repo.id), eq(repoBranchMetadata.branch, branch)),
  });

  if (metadata) {
    return c.json({ count: metadata.commitCount });
  }

  const count = await getCommitCountCached(store, branch);
  return c.json({ count });
});

app.get("/api/repositories/:owner/:name/commits/:oid/diff", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const oid = c.req.param("oid");
  const currentUser = c.get("user");

  const result = await getRepoAndStore(owner, name);
  if (!result) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const { repo, store } = result;

  if (repo.visibility === "private" && currentUser?.id !== repo.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const diff = await getCommitDiff(store.fs, store.dir, oid);
  if (!diff) {
    return c.json({ error: "Commit not found" }, 404);
  }

  const userMap = await getUsersByEmails([diff.commit.author.email]);
  const user = userMap.get(diff.commit.author.email);

  return c.json({
    commit: {
      ...diff.commit,
      author: {
        name: diff.commit.author.name,
        username: user?.username,
        userId: user?.id,
        avatarUrl: user?.avatarUrl,
      },
    },
    parent: diff.parent,
    files: diff.files,
    stats: diff.stats,
  });
});

app.get("/api/repositories/:owner/:name/tree", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");
  const branch = c.req.query("branch") || "main";
  const path = c.req.query("path") || "";

  const result = await getRepoAndStore(owner, name);
  if (!result) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const { repo, store } = result;

  if (repo.visibility === "private" && currentUser?.id !== repo.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (path === "") {
    const metadata = await db.query.repoBranchMetadata.findFirst({
      where: and(eq(repoBranchMetadata.repoId, repo.id), eq(repoBranchMetadata.branch, branch)),
    });

    if (metadata?.rootTree) {
      return c.json({
        files: metadata.rootTree,
        isEmpty: (metadata.rootTree as any[]).length === 0,
      });
    }
  }

  const files = await getTreeCached(store, branch, path);

  return c.json({
    files: files || [],
    isEmpty: !files || files.length === 0,
  });
});

app.get("/api/repositories/:owner/:name/tree-commits", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");
  const branch = c.req.query("branch") || "main";
  const path = c.req.query("path") || "";

  const result = await getRepoAndStore(owner, name);
  if (!result) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const { repo, store } = result;

  if (repo.visibility === "private" && currentUser?.id !== repo.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const files = await getTreeCached(store, branch, path);
  if (!files || files.length === 0) {
    return c.json({ files: [] });
  }

  return c.json({ files: files.map((f) => ({ ...f, lastCommit: null })) });
});

app.get("/api/repositories/:owner/:name/file", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");
  const branch = c.req.query("branch") || "main";
  const path = c.req.query("path");

  if (!path) {
    return c.json({ error: "Path is required" }, 400);
  }

  const result = await getRepoAndStore(owner, name);
  if (!result) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const { repo, store } = result;

  if (repo.visibility === "private" && currentUser?.id !== repo.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const file = await getFileCached(store, branch, path);
  if (!file) {
    return c.json({ error: "File not found" }, 404);
  }

  return c.json({
    content: file.content,
    oid: file.oid,
    path,
  });
});

app.get("/api/repositories/:owner/:name/readme-oid", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");
  const branch = c.req.query("branch") || "main";

  const result = await getRepoAndStore(owner, name);
  if (!result) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const { repo, store } = result;

  if (repo.visibility === "private" && currentUser?.id !== repo.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const metadata = await db.query.repoBranchMetadata.findFirst({
    where: and(eq(repoBranchMetadata.repoId, repo.id), eq(repoBranchMetadata.branch, branch)),
  });

  if (metadata?.readmeOid) {
    const content = await getBlobByOid(store.fs, store.dir, metadata.readmeOid);
    if (content) {
      return c.json({ readmeOid: metadata.readmeOid });
    }
  }

  const files = await getTreeCached(store, branch, "");
  const readme = files?.find((f) => f.name.toLowerCase() === "readme.md" && f.type === "blob");

  return c.json({ readmeOid: readme?.oid || null });
});

app.get("/api/repositories/:owner/:name/readme", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");
  const oid = c.req.query("oid");

  if (!oid) {
    return c.json({ error: "OID is required" }, 400);
  }

  const result = await getRepoAndStore(owner, name);
  if (!result) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const { repo, store } = result;

  if (repo.visibility === "private" && currentUser?.id !== repo.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const content = await getBlobByOid(store.fs, store.dir, oid);
  if (!content) {
    return c.json({ error: "Readme not found" }, 404);
  }

  return c.json({ content });
});

app.get("/api/repositories/:owner/:name/info", async (c) => {
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

  const isOwner = currentUser?.id === row.ownerId;
  const forkedFrom = await getForkedFromInfo(row.forkedFromId, currentUser?.id);
  const forkCount = await getForkCount(row.id);

  return c.json({
    repo: {
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
    },
    isOwner,
  });
});

app.get("/api/repositories/:owner/:name/page-data", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");

  const result = await db
    .select({
      ownerId: repositories.ownerId,
      visibility: repositories.visibility,
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

  return c.json({ isOwner: currentUser?.id === row.ownerId });
});

export default app;
