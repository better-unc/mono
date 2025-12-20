"use server";

import { db } from "@/db";
import { repositories, users, stars } from "@/db/schema";
import { getSession } from "@/lib/session";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import git from "isomorphic-git";
import { createR2Fs, getRepoPrefix } from "@/lib/r2-fs";

export async function createRepository(data: { name: string; description?: string; visibility: "public" | "private" }) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const normalizedName = data.name.toLowerCase().replace(/\s+/g, "-");

  if (!/^[a-zA-Z0-9_.-]+$/.test(normalizedName)) {
    throw new Error("Invalid repository name");
  }

  const existing = await db.query.repositories.findFirst({
    where: and(eq(repositories.ownerId, session.user.id), eq(repositories.name, normalizedName)),
  });

  if (existing) {
    throw new Error("Repository already exists");
  }

  const [repo] = await db
    .insert(repositories)
    .values({
      name: normalizedName,
      description: data.description || null,
      visibility: data.visibility,
      ownerId: session.user.id,
    })
    .returning();

  const repoPrefix = getRepoPrefix(session.user.id, `${normalizedName}.git`);
  const fs = createR2Fs(repoPrefix);

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

  const username = (session.user as { username?: string }).username;
  revalidatePath(`/${username}`);
  revalidatePath("/");

  return repo;
}

export async function getRepository(owner: string, name: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.username, owner),
  });

  if (!user) {
    return null;
  }

  const repo = await db.query.repositories.findFirst({
    where: and(eq(repositories.ownerId, user.id), eq(repositories.name, name)),
  });

  if (!repo) {
    return null;
  }

  const session = await getSession();
  if (repo.visibility === "private") {
    if (!session?.user || session.user.id !== repo.ownerId) {
      return null;
    }
  }

  return {
    ...repo,
    owner: {
      id: user.id,
      username: user.username,
      name: user.name,
      image: user.image,
    },
  };
}

export async function getUserRepositories(username: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) {
    return [];
  }

  const session = await getSession();
  const isOwner = session?.user?.id === user.id;

  const repos = await db.query.repositories.findMany({
    where: isOwner ? eq(repositories.ownerId, user.id) : and(eq(repositories.ownerId, user.id), eq(repositories.visibility, "public")),
    orderBy: [desc(repositories.updatedAt)],
  });

  return repos;
}

export async function deleteRepository(repoId: string) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, repoId),
  });

  if (!repo) {
    throw new Error("Repository not found");
  }

  if (repo.ownerId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  const { r2DeletePrefix } = await import("@/lib/r2");
  const repoPrefix = getRepoPrefix(session.user.id, `${repo.name}.git`);

  try {
    await r2DeletePrefix(repoPrefix);
  } catch {}

  await db.delete(repositories).where(eq(repositories.id, repoId));

  const username = (session.user as { username?: string }).username;
  revalidatePath(`/${username}`);
  revalidatePath("/");
}

export async function getRepoFileTree(owner: string, repoName: string, branch: string, dirPath: string = "") {
  const user = await db.query.users.findFirst({
    where: eq(users.username, owner),
  });

  if (!user) {
    return null;
  }

  const repoPrefix = getRepoPrefix(user.id, `${repoName}.git`);
  const fs = createR2Fs(repoPrefix);

  try {
    const commits = await git.log({
      fs,
      gitdir: "/",
      ref: branch,
      depth: 1,
    });

    if (commits.length === 0) {
      return { files: [], isEmpty: true };
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
          return { files: [], isEmpty: false };
        }
        const subTree = await git.readTree({
          fs,
          gitdir: "/",
          oid: entry.oid,
        });
        targetTree = subTree.tree;
      }
    }

    const entries = await Promise.all(
      targetTree.map(async (entry) => {
        const filePath = dirPath ? `${dirPath}/${entry.path}` : entry.path;
        let lastCommit: { message: string; timestamp: number } | null = null;

        try {
          const fileCommits = await git.log({
            fs,
            gitdir: "/",
            ref: branch,
            filepath: filePath,
            depth: 1,
          });
          if (fileCommits.length > 0) {
            lastCommit = {
              message: fileCommits[0].commit.message.split("\n")[0],
              timestamp: fileCommits[0].commit.committer.timestamp * 1000,
            };
          }
        } catch {}

        return {
          name: entry.path,
          type: entry.type as "blob" | "tree",
          oid: entry.oid,
          path: filePath,
          lastCommit,
        };
      })
    );

    entries.sort((a, b) => {
      if (a.type === "tree" && b.type !== "tree") return -1;
      if (a.type !== "tree" && b.type === "tree") return 1;
      return a.name.localeCompare(b.name);
    });

    return { files: entries, isEmpty: false };
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code !== "NotFoundError") {
      console.error("getRepoFileTree error:", err);
    }
    return { files: [], isEmpty: true };
  }
}

export async function getRepoFile(owner: string, repoName: string, branch: string, filePath: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.username, owner),
  });

  if (!user) {
    return null;
  }

  const repoPrefix = getRepoPrefix(user.id, `${repoName}.git`);
  const fs = createR2Fs(repoPrefix);

  try {
    const commits = await git.log({
      fs,
      gitdir: "/",
      ref: branch,
      depth: 1,
    });

    if (commits.length === 0) {
      return null;
    }

    const commitOid = commits[0].oid;
    const parts = filePath.split("/").filter(Boolean);
    const fileName = parts.pop()!;

    let currentTree = (await git.readTree({ fs, gitdir: "/", oid: commitOid })).tree;

    for (const part of parts) {
      const entry = currentTree.find((e) => e.path === part && e.type === "tree");
      if (!entry) return null;
      currentTree = (await git.readTree({ fs, gitdir: "/", oid: entry.oid })).tree;
    }

    const fileEntry = currentTree.find((e) => e.path === fileName && e.type === "blob");
    if (!fileEntry) return null;

    const { blob } = await git.readBlob({
      fs,
      gitdir: "/",
      oid: fileEntry.oid,
    });

    const decoder = new TextDecoder("utf-8");
    const content = decoder.decode(blob);

    return {
      content,
      oid: fileEntry.oid,
      path: filePath,
    };
  } catch (err) {
    console.error("getRepoFile error:", err);
    return null;
  }
}

export async function toggleStar(repoId: string) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const existing = await db.query.stars.findFirst({
    where: and(eq(stars.userId, session.user.id), eq(stars.repositoryId, repoId)),
  });

  if (existing) {
    await db.delete(stars).where(and(eq(stars.userId, session.user.id), eq(stars.repositoryId, repoId)));
    return { starred: false };
  } else {
    await db.insert(stars).values({
      userId: session.user.id,
      repositoryId: repoId,
    });
    return { starred: true };
  }
}

export async function getStarCount(repoId: string) {
  const result = await db.select({ count: count() }).from(stars).where(eq(stars.repositoryId, repoId));
  return result[0]?.count ?? 0;
}

export async function isStarredByUser(repoId: string) {
  const session = await getSession();
  if (!session?.user) {
    return false;
  }

  const existing = await db.query.stars.findFirst({
    where: and(eq(stars.userId, session.user.id), eq(stars.repositoryId, repoId)),
  });

  return !!existing;
}

export async function getRepositoryWithStars(owner: string, name: string) {
  const repo = await getRepository(owner, name);
  if (!repo) return null;

  const starCount = await getStarCount(repo.id);
  const starred = await isStarredByUser(repo.id);

  return { ...repo, starCount, starred };
}

export async function getUserRepositoriesWithStars(username: string) {
  const repos = await getUserRepositories(username);

  const reposWithStars = await Promise.all(
    repos.map(async (repo) => {
      const starCount = await getStarCount(repo.id);
      return { ...repo, starCount };
    })
  );

  return reposWithStars;
}

export async function updateRepository(
  repoId: string,
  data: { name?: string; description?: string; visibility?: "public" | "private" }
) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, repoId),
  });

  if (!repo) {
    throw new Error("Repository not found");
  }

  if (repo.ownerId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  const oldName = repo.name;
  let newName = oldName;

  if (data.name && data.name !== oldName) {
    newName = data.name.toLowerCase().replace(/\s+/g, "-");

    if (!/^[a-zA-Z0-9_.-]+$/.test(newName)) {
      throw new Error("Invalid repository name");
    }

    const existing = await db.query.repositories.findFirst({
      where: and(eq(repositories.ownerId, session.user.id), eq(repositories.name, newName)),
    });

    if (existing) {
      throw new Error("Repository with this name already exists");
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

  const username = (session.user as { username?: string }).username;
  revalidatePath(`/${username}/${oldName}`);
  revalidatePath(`/${username}/${newName}`);
  revalidatePath(`/${username}`);
  revalidatePath("/");

  return updated;
}

export async function getRepoBranches(owner: string, repoName: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.username, owner),
  });

  if (!user) {
    return [];
  }

  const repoPrefix = getRepoPrefix(user.id, `${repoName}.git`);
  const fs = createR2Fs(repoPrefix);

  try {
    const branches = await git.listBranches({ fs, gitdir: "/" });
    return branches;
  } catch {
    return [];
  }
}

export async function getRepoCommits(
  owner: string,
  repoName: string,
  branch: string,
  limit: number = 30,
  skip: number = 0
) {
  const user = await db.query.users.findFirst({
    where: eq(users.username, owner),
  });

  if (!user) {
    return { commits: [], hasMore: false };
  }

  const repoPrefix = getRepoPrefix(user.id, `${repoName}.git`);
  const fs = createR2Fs(repoPrefix);

  try {
    const commits = await git.log({
      fs,
      gitdir: "/",
      ref: branch,
      depth: skip + limit + 1,
    });

    const paginatedCommits = commits.slice(skip, skip + limit);
    const hasMore = commits.length > skip + limit;

    return {
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
    };
  } catch {
    return { commits: [], hasMore: false };
  }
}

export async function getRepoCommitCount(owner: string, repoName: string, branch: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.username, owner),
  });

  if (!user) {
    return 0;
  }

  const repoPrefix = getRepoPrefix(user.id, `${repoName}.git`);
  const fs = createR2Fs(repoPrefix);

  try {
    const commits = await git.log({
      fs,
      gitdir: "/",
      ref: branch,
    });
    return commits.length;
  } catch {
    return 0;
  }
}

export async function getPublicRepositories(
  sortBy: "stars" | "updated" | "created" = "updated",
  limit: number = 20,
  offset: number = 0
) {
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
      ownerImage: users.image,
      starCount: sql<number>`(SELECT COUNT(*) FROM stars WHERE stars.repository_id = ${repositories.id})`.as("star_count"),
    })
    .from(repositories)
    .innerJoin(users, eq(repositories.ownerId, users.id))
    .where(eq(repositories.visibility, "public"))
    .orderBy(
      sortBy === "stars"
        ? desc(sql`star_count`)
        : sortBy === "created"
        ? desc(repositories.createdAt)
        : desc(repositories.updatedAt)
    )
    .limit(limit + 1)
    .offset(offset);

  const hasMore = allRepos.length > limit;
  const repos = allRepos.slice(0, limit);

  return {
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
        image: r.ownerImage,
      },
    })),
    hasMore,
  };
}
