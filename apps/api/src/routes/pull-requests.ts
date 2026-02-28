import { Hono } from "hono";
import {
  db,
  users,
  repositories,
  pullRequests,
  prReviews,
  prComments,
  prLabels,
  prAssignees,
  prReviewers,
  prReactions,
  labels,
  branchProtectionRules,
} from "@gitbruv/db";
import { eq, sql, and, desc, or } from "drizzle-orm";
import { authMiddleware, requireAuth, type AuthVariables } from "../middleware/auth";
import { createGitStore, getCommits, getTree, getCommitDiff, performMerge, repoCache, resolveRefOid } from "../git";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", authMiddleware);

const VALID_EMOJIS = ["+1", "-1", "laugh", "hooray", "confused", "heart", "rocket", "eyes"];

async function getRepoAndCheckAccess(owner: string, name: string, userId?: string) {
  const result = await db
    .select({
      id: repositories.id,
      ownerId: repositories.ownerId,
      visibility: repositories.visibility,
      defaultBranch: repositories.defaultBranch,
    })
    .from(repositories)
    .innerJoin(users, eq(users.id, repositories.ownerId))
    .where(and(eq(users.username, owner), eq(repositories.name, name)))
    .limit(1);

  const row = result[0];
  if (!row) {
    return null;
  }

  if (row.visibility === "private" && userId !== row.ownerId) {
    return null;
  }

  return { repoId: row.id, ownerId: row.ownerId, defaultBranch: row.defaultBranch };
}

async function getPRLabels(prId: string) {
  return db
    .select({
      id: labels.id,
      name: labels.name,
      description: labels.description,
      color: labels.color,
    })
    .from(labels)
    .innerJoin(prLabels, eq(prLabels.labelId, labels.id))
    .where(eq(prLabels.pullRequestId, prId))
    .orderBy(labels.name);
}

async function getPRAssignees(prId: string) {
  return db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .innerJoin(prAssignees, eq(prAssignees.userId, users.id))
    .where(eq(prAssignees.pullRequestId, prId));
}

async function getPRReviewers(prId: string) {
  return db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .innerJoin(prReviewers, eq(prReviewers.userId, users.id))
    .where(eq(prReviewers.pullRequestId, prId));
}

async function getPRReviews(prId: string) {
  const reviews = await db
    .select({
      id: prReviews.id,
      body: prReviews.body,
      state: prReviews.state,
      commitOid: prReviews.commitOid,
      createdAt: prReviews.createdAt,
      authorId: prReviews.authorId,
    })
    .from(prReviews)
    .where(eq(prReviews.pullRequestId, prId))
    .orderBy(desc(prReviews.createdAt));

  return Promise.all(
    reviews.map(async (review) => {
      const author = await db.query.users.findFirst({
        where: eq(users.id, review.authorId),
        columns: { id: true, username: true, name: true, avatarUrl: true },
      });
      return {
        id: review.id,
        body: review.body,
        state: review.state,
        commitOid: review.commitOid,
        createdAt: review.createdAt,
        author: author || { id: review.authorId, username: "unknown", name: "Unknown", avatarUrl: null },
      };
    })
  );
}

async function getReactionsGrouped(prId: string, userId?: string) {
  const counts = await db
    .select({
      emoji: prReactions.emoji,
      count: sql<number>`COUNT(*)`,
    })
    .from(prReactions)
    .where(eq(prReactions.pullRequestId, prId))
    .groupBy(prReactions.emoji);

  let userEmojis: string[] = [];
  if (userId) {
    const userReactions = await db
      .select({ emoji: prReactions.emoji })
      .from(prReactions)
      .where(and(eq(prReactions.pullRequestId, prId), eq(prReactions.userId, userId)));
    userEmojis = userReactions.map((r) => r.emoji);
  }

  return counts.map((c) => ({
    emoji: c.emoji,
    count: c.count,
    reacted: userEmojis.includes(c.emoji),
  }));
}

async function getCommentReactionsGrouped(commentId: string, userId?: string) {
  const counts = await db
    .select({
      emoji: prReactions.emoji,
      count: sql<number>`COUNT(*)`,
    })
    .from(prReactions)
    .where(eq(prReactions.commentId, commentId))
    .groupBy(prReactions.emoji);

  let userEmojis: string[] = [];
  if (userId) {
    const userReactions = await db
      .select({ emoji: prReactions.emoji })
      .from(prReactions)
      .where(and(eq(prReactions.commentId, commentId), eq(prReactions.userId, userId)));
    userEmojis = userReactions.map((r) => r.emoji);
  }

  return counts.map((c) => ({
    emoji: c.emoji,
    count: c.count,
    reacted: userEmojis.includes(c.emoji),
  }));
}

async function getCommentCount(prId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(prComments)
    .where(eq(prComments.pullRequestId, prId));
  return result?.count || 0;
}

async function getRepoInfo(repoId: string) {
  const result = await db
    .select({
      id: repositories.id,
      name: repositories.name,
      ownerId: repositories.ownerId,
      username: users.username,
      userName: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(repositories)
    .innerJoin(users, eq(users.id, repositories.ownerId))
    .where(eq(repositories.id, repoId))
    .limit(1);

  const row = result[0];
  if (!row) return null;

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

async function enrichPullRequest(pr: any, currentUserId?: string) {
  const author = await db.query.users.findFirst({
    where: eq(users.id, pr.authorId),
    columns: { id: true, username: true, name: true, avatarUrl: true },
  });

  const mergedBy = pr.mergedById
    ? await db.query.users.findFirst({
        where: eq(users.id, pr.mergedById),
        columns: { id: true, username: true, name: true, avatarUrl: true },
      })
    : null;

  const closedBy = pr.closedById
    ? await db.query.users.findFirst({
        where: eq(users.id, pr.closedById),
        columns: { id: true, username: true, name: true, avatarUrl: true },
      })
    : null;

  const prLabelsData = await getPRLabels(pr.id);
  const assignees = await getPRAssignees(pr.id);
  const reviewers = await getPRReviewers(pr.id);
  const reviews = await getPRReviews(pr.id);
  const reactions = await getReactionsGrouped(pr.id, currentUserId);
  const commentCount = await getCommentCount(pr.id);

  const headRepo = await getRepoInfo(pr.headRepoId);
  const baseRepo = await getRepoInfo(pr.baseRepoId);

  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    isDraft: pr.isDraft ?? false,
    author: author || { id: pr.authorId, username: "unknown", name: "Unknown", avatarUrl: null },
    headRepo,
    headBranch: pr.headBranch,
    headOid: pr.headOid,
    baseRepo,
    baseBranch: pr.baseBranch,
    baseOid: pr.baseOid,
    merged: pr.merged,
    mergedAt: pr.mergedAt,
    mergedBy,
    mergeCommitOid: pr.mergeCommitOid,
    labels: prLabelsData,
    assignees,
    reviewers,
    reviews,
    reactions,
    commentCount,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    closedAt: pr.closedAt,
    closedBy,
  };
}

app.get("/api/repositories/:owner/:name/pulls", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");
  const stateParam = c.req.query("state") || "open";
  const labelFilter = c.req.query("label");
  const assigneeFilter = c.req.query("assignee");
  const reviewerFilter = c.req.query("reviewer");
  const authorFilter = c.req.query("author");
  const limit = parseInt(c.req.query("limit") || "30", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const repoAccess = await getRepoAndCheckAccess(owner, name, currentUser?.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  let stateCondition;
  if (stateParam === "all") {
    stateCondition = undefined;
  } else if (stateParam === "merged") {
    stateCondition = eq(pullRequests.merged, true);
  } else if (stateParam === "closed") {
    stateCondition = and(eq(pullRequests.state, "closed"), eq(pullRequests.merged, false));
  } else {
    stateCondition = eq(pullRequests.state, "open");
  }

  const conditions = [eq(pullRequests.repositoryId, repoAccess.repoId)];
  if (stateCondition) {
    conditions.push(stateCondition);
  }

  const rows = await db
    .select()
    .from(pullRequests)
    .where(and(...conditions))
    .orderBy(desc(pullRequests.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const prRows = rows.slice(0, limit);

  const prList = await Promise.all(prRows.map((pr) => enrichPullRequest(pr, currentUser?.id)));

  return c.json({ pullRequests: prList, hasMore });
});

app.post("/api/repositories/:owner/:name/pulls", requireAuth, async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const user = c.get("user")!;
  const body = await c.req.json<{
    title: string;
    body?: string;
    headRepoOwner?: string;
    headRepoName?: string;
    headBranch: string;
    baseBranch: string;
    labels?: string[];
    assignees?: string[];
    reviewers?: string[];
    isDraft?: boolean;
  }>();

  const repoAccess = await getRepoAndCheckAccess(owner, name, user.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (!body.title?.trim()) {
    return c.json({ error: "Title cannot be empty" }, 400);
  }

  if (!body.headBranch?.trim()) {
    return c.json({ error: "Head branch is required" }, 400);
  }

  const baseBranch = body.baseBranch || repoAccess.defaultBranch;

  let headRepoId = repoAccess.repoId;
  let headRepoOwnerId = repoAccess.ownerId;

  if (body.headRepoOwner && body.headRepoName) {
    const headRepoAccess = await getRepoAndCheckAccess(body.headRepoOwner, body.headRepoName, user.id);
    if (!headRepoAccess) {
      return c.json({ error: "Head repository not found" }, 404);
    }
    headRepoId = headRepoAccess.repoId;
    headRepoOwnerId = headRepoAccess.ownerId;
  }

  const headRepo = await db.query.repositories.findFirst({
    where: eq(repositories.id, headRepoId),
  });
  const baseRepo = await db.query.repositories.findFirst({
    where: eq(repositories.id, repoAccess.repoId),
  });

  if (!headRepo || !baseRepo) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const headStore = createGitStore(headRepoOwnerId, headRepo.name);
  const baseStore = createGitStore(repoAccess.ownerId, baseRepo.name);

  const headCommits = await getCommits(headStore.fs, headStore.dir, body.headBranch, 1, 0);
  const baseCommits = await getCommits(baseStore.fs, baseStore.dir, baseBranch, 1, 0);

  if (headCommits.commits.length === 0) {
    return c.json({ error: "Head branch not found" }, 400);
  }

  if (baseCommits.commits.length === 0) {
    return c.json({ error: "Base branch not found" }, 400);
  }

  const headOid = headCommits.commits[0].oid;
  const baseOid = baseCommits.commits[0].oid;

  const [maxNumber] = await db
    .select({ max: sql<number>`COALESCE(MAX(number), 0)` })
    .from(pullRequests)
    .where(eq(pullRequests.repositoryId, repoAccess.repoId));

  const [inserted] = await db
    .insert(pullRequests)
    .values({
      repositoryId: repoAccess.repoId,
      authorId: user.id,
      title: body.title,
      body: body.body,
      number: (maxNumber?.max || 0) + 1,
      headRepoId,
      headBranch: body.headBranch,
      headOid,
      baseRepoId: repoAccess.repoId,
      baseBranch,
      baseOid,
      isDraft: body.isDraft ?? false,
    })
    .returning();

  if (body.labels?.length) {
    for (const labelId of body.labels) {
      await db.insert(prLabels).values({ pullRequestId: inserted.id, labelId }).onConflictDoNothing();
    }
  }

  if (body.assignees?.length) {
    for (const assigneeId of body.assignees) {
      await db.insert(prAssignees).values({ pullRequestId: inserted.id, userId: assigneeId }).onConflictDoNothing();
    }
  }

  if (body.reviewers?.length) {
    for (const reviewerId of body.reviewers) {
      await db.insert(prReviewers).values({ pullRequestId: inserted.id, userId: reviewerId }).onConflictDoNothing();
    }
  }

  const enriched = await enrichPullRequest(inserted, user.id);
  return c.json(enriched);
});

app.get("/api/repositories/:owner/:name/pulls/count", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");

  const repoAccess = await getRepoAndCheckAccess(owner, name, currentUser?.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const [openCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(pullRequests)
    .where(and(eq(pullRequests.repositoryId, repoAccess.repoId), eq(pullRequests.state, "open")));

  const [closedCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(pullRequests)
    .where(
      and(eq(pullRequests.repositoryId, repoAccess.repoId), eq(pullRequests.state, "closed"), eq(pullRequests.merged, false))
    );

  const [mergedCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(pullRequests)
    .where(and(eq(pullRequests.repositoryId, repoAccess.repoId), eq(pullRequests.merged, true)));

  return c.json({
    open: openCount?.count || 0,
    closed: closedCount?.count || 0,
    merged: mergedCount?.count || 0,
  });
});

app.get("/api/repositories/:owner/:name/pulls/:number", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const number = parseInt(c.req.param("number"), 10);
  const currentUser = c.get("user");

  const repoAccess = await getRepoAndCheckAccess(owner, name, currentUser?.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const pr = await db.query.pullRequests.findFirst({
    where: and(eq(pullRequests.repositoryId, repoAccess.repoId), eq(pullRequests.number, number)),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const enriched = await enrichPullRequest(pr, currentUser?.id);
  return c.json(enriched);
});

app.patch("/api/pulls/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{
    title?: string;
    body?: string;
    state?: string;
  }>();

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.repositoryId),
  });

  if (user.id !== pr.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  if (body.title !== undefined && !body.title.trim()) {
    return c.json({ error: "Title cannot be empty" }, 400);
  }

  if (body.state && body.state !== "open" && body.state !== "closed") {
    return c.json({ error: "Invalid state" }, 400);
  }

  if (pr.merged && body.state) {
    return c.json({ error: "Cannot change state of merged pull request" }, 400);
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.body !== undefined) updates.body = body.body;
  if (body.state !== undefined) {
    updates.state = body.state;
    if (body.state === "closed" && pr.state === "open") {
      updates.closedAt = new Date();
      updates.closedById = user.id;
    } else if (body.state === "open" && pr.state === "closed") {
      updates.closedAt = null;
      updates.closedById = null;
    }
  }

  await db.update(pullRequests).set(updates).where(eq(pullRequests.id, id));

  return c.json({ success: true });
});

app.delete("/api/pulls/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.repositoryId),
  });

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can delete pull requests" }, 403);
  }

  await db.delete(pullRequests).where(eq(pullRequests.id, id));

  return c.json({ success: true });
});

app.get("/api/pulls/:id/diff", async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.repositoryId),
  });

  if (!repo) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (repo.visibility === "private" && currentUser?.id !== repo.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const headRepo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.headRepoId),
  });

  if (!headRepo) {
    return c.json({ error: "Head repository not found" }, 404);
  }

  const headRepoOwner = await db.query.users.findFirst({
    where: eq(users.id, headRepo.ownerId),
  });

  if (!headRepoOwner) {
    return c.json({ error: "Head repository owner not found" }, 404);
  }

  const headStore = createGitStore(headRepoOwner.id, headRepo.name);
  const diff = await getCommitDiff(headStore.fs, headStore.dir, pr.headOid);

  if (!diff) {
    return c.json({ error: "Could not compute diff" }, 500);
  }

  return c.json({
    files: diff.files,
    stats: diff.stats,
  });
});

app.get("/api/pulls/:id/commits", async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");
  const limit = parseInt(c.req.query("limit") || "30", 10);
  const skip = parseInt(c.req.query("skip") || "0", 10);

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.repositoryId),
  });

  if (!repo) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (repo.visibility === "private" && currentUser?.id !== repo.ownerId) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const headRepo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.headRepoId),
  });

  if (!headRepo) {
    return c.json({ error: "Head repository not found" }, 404);
  }

  const headRepoOwner = await db.query.users.findFirst({
    where: eq(users.id, headRepo.ownerId),
  });

  if (!headRepoOwner) {
    return c.json({ error: "Head repository owner not found" }, 404);
  }

  const headStore = createGitStore(headRepoOwner.id, headRepo.name);
  const { commits, hasMore } = await getCommits(headStore.fs, headStore.dir, pr.headBranch, limit, skip);

  return c.json({ commits, hasMore });
});

app.post("/api/pulls/:id/merge", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{
    commitMessage?: string;
  }>();

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  if (pr.state !== "open") {
    return c.json({ error: "Pull request is not open" }, 400);
  }

  if (pr.merged) {
    return c.json({ error: "Pull request is already merged" }, 400);
  }

  if (pr.isDraft) {
    return c.json({ error: "Cannot merge a draft pull request. Mark it as ready for review first." }, 400);
  }

  const baseRepo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.baseRepoId),
  });

  if (!baseRepo) {
    return c.json({ error: "Base repository not found" }, 404);
  }

  if (user.id !== baseRepo.ownerId && user.id !== pr.authorId) {
    return c.json({ error: "Not authorized to merge" }, 403);
  }

  const headRepo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.headRepoId),
  });

  if (!headRepo) {
    return c.json({ error: "Head repository not found" }, 404);
  }

  const baseStore = createGitStore(baseRepo.ownerId, baseRepo.name);
  const headStore = createGitStore(headRepo.ownerId, headRepo.name);

  // Check branch protection: required reviews
  const protectionRule = await db.query.branchProtectionRules.findFirst({
    where: and(
      eq(branchProtectionRules.repositoryId, pr.baseRepoId),
      eq(branchProtectionRules.branchName, pr.baseBranch)
    ),
  });

  // Resolve the live head commit OID for the PR branch
  let currentHeadOid: string;
  try {
    currentHeadOid = await resolveRefOid(headStore, pr.headBranch);
  } catch {
    return c.json({ error: "Could not resolve head branch ref" }, 500);
  }

  if (protectionRule?.requireReviews && protectionRule.requiredReviewCount > 0) {
    const reviews = await db.query.prReviews.findMany({
      where: eq(prReviews.pullRequestId, pr.id),
      orderBy: [desc(prReviews.createdAt)],
    });

    // Deduplicate by author (keep latest review per author)
    const latestByAuthor = new Map<string, typeof reviews[0]>();
    for (const review of reviews) {
      if (!latestByAuthor.has(review.authorId)) {
        latestByAuthor.set(review.authorId, review);
      }
    }

    // Count approvals only for the current head commit, excluding PR author
    const approvalCount = Array.from(latestByAuthor.values())
      .filter(r => r.state === "approved" && r.commitOid === currentHeadOid && r.authorId !== pr.authorId)
      .length;

    if (approvalCount < protectionRule.requiredReviewCount) {
      return c.json({
        error: `This pull request requires at least ${protectionRule.requiredReviewCount} approving review(s) for the current commit before merging. Currently has ${approvalCount}.`
      }, 403);
    }
  }

  // TOCTOU check: re-read head OID immediately before merge and fail if it changed
  try {
    const recheckHeadOid = await resolveRefOid(headStore, pr.headBranch);
    if (recheckHeadOid !== currentHeadOid) {
      return c.json({ error: "The head branch was updated during merge validation. Please retry." }, 409);
    }
  } catch {
    return c.json({ error: "Could not resolve head branch ref" }, 500);
  }

  const mergeMessage = body.commitMessage || `Merge pull request #${pr.number} from ${pr.headBranch}\n\n${pr.title}`;

  const mergeResult = await performMerge(
    baseStore,
    pr.baseBranch,
    headStore,
    pr.headBranch,
    mergeMessage,
    user.name,
    user.email
  );

  if (!mergeResult) {
    return c.json({ error: "Failed to perform merge" }, 500);
  }

  await db
    .update(pullRequests)
    .set({
      state: "merged",
      merged: true,
      mergedAt: new Date(),
      mergedById: user.id,
      mergeCommitOid: mergeResult.mergeCommitOid,
      updatedAt: new Date(),
    })
    .where(eq(pullRequests.id, id));

  await repoCache.invalidateBranch(baseRepo.ownerId, baseRepo.name, pr.baseBranch);

  return c.json({ success: true, mergeCommitOid: mergeResult.mergeCommitOid });
});

app.patch("/api/pulls/:id/ready", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.repositoryId),
  });

  if (user.id !== pr.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  if (!pr.isDraft) {
    return c.json({ error: "Pull request is not a draft" }, 400);
  }

  await db
    .update(pullRequests)
    .set({ isDraft: false, updatedAt: new Date() })
    .where(eq(pullRequests.id, id));

  return c.json({ success: true });
});

app.patch("/api/pulls/:id/draft", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.repositoryId),
  });

  if (user.id !== pr.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  if (pr.isDraft) {
    return c.json({ error: "Pull request is already a draft" }, 400);
  }

  if (pr.merged) {
    return c.json({ error: "Cannot convert merged pull request to draft" }, 400);
  }

  await db
    .update(pullRequests)
    .set({ isDraft: true, updatedAt: new Date() })
    .where(eq(pullRequests.id, id));

  return c.json({ success: true });
});

app.post("/api/pulls/:id/reviews", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{
    body?: string;
    state: "approved" | "changes_requested" | "commented";
  }>();

  if (!["approved", "changes_requested", "commented"].includes(body.state)) {
    return c.json({ error: "Invalid review state" }, 400);
  }

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const [inserted] = await db
    .insert(prReviews)
    .values({
      pullRequestId: id,
      authorId: user.id,
      body: body.body,
      state: body.state,
      commitOid: pr.headOid,
    })
    .returning();

  return c.json({
    id: inserted.id,
    body: inserted.body,
    state: inserted.state,
    commitOid: inserted.commitOid,
    createdAt: inserted.createdAt,
    author: { id: user.id, username: user.username, name: user.name, avatarUrl: user.avatarUrl },
  });
});

app.get("/api/pulls/:id/reviews", async (c) => {
  const id = c.req.param("id");

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const reviews = await getPRReviews(id);
  return c.json({ reviews });
});

app.get("/api/pulls/:id/comments", async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");
  const groupByFile = c.req.query("groupByFile") === "true";
  const filePathFilter = c.req.query("filePath");

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  let commentsQuery = db
    .select({
      id: prComments.id,
      body: prComments.body,
      filePath: prComments.filePath,
      side: prComments.side,
      lineNumber: prComments.lineNumber,
      commitOid: prComments.commitOid,
      replyToId: prComments.replyToId,
      createdAt: prComments.createdAt,
      updatedAt: prComments.updatedAt,
      authorId: prComments.authorId,
    })
    .from(prComments)
    .where(
      filePathFilter
        ? and(eq(prComments.pullRequestId, id), eq(prComments.filePath, filePathFilter))
        : eq(prComments.pullRequestId, id)
    )
    .orderBy(prComments.createdAt);

  const comments = await commentsQuery;

  const commentsList = await Promise.all(
    comments.map(async (comment) => {
      const author = await db.query.users.findFirst({
        where: eq(users.id, comment.authorId),
        columns: { id: true, username: true, name: true, avatarUrl: true },
      });

      const reactions = await getCommentReactionsGrouped(comment.id, currentUser?.id);

      return {
        id: comment.id,
        body: comment.body,
        filePath: comment.filePath,
        side: comment.side,
        lineNumber: comment.lineNumber,
        commitOid: comment.commitOid,
        replyToId: comment.replyToId,
        author: author || { id: comment.authorId, username: "unknown", name: "Unknown", avatarUrl: null },
        reactions,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      };
    })
  );

  if (groupByFile) {
    const generalComments = commentsList.filter((c) => !c.filePath);
    const inlineComments = commentsList.filter((c) => c.filePath);

    const byFile: Record<string, typeof commentsList> = {};
    for (const comment of inlineComments) {
      const path = comment.filePath!;
      if (!byFile[path]) {
        byFile[path] = [];
      }
      byFile[path].push(comment);
    }

    return c.json({ generalComments, inlineComments: byFile });
  }

  return c.json({ comments: commentsList });
});

app.post("/api/pulls/:id/comments", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{
    body: string;
    filePath?: string;
    side?: "left" | "right";
    lineNumber?: number;
    commitOid?: string;
    replyToId?: string;
  }>();

  if (!body.body?.trim()) {
    return c.json({ error: "Comment cannot be empty" }, 400);
  }

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const isInline = body.filePath && body.lineNumber !== undefined;
  if (isInline && !body.side) {
    return c.json({ error: "Side is required for inline comments" }, 400);
  }

  if (body.replyToId) {
    const parentComment = await db.query.prComments.findFirst({
      where: eq(prComments.id, body.replyToId),
    });
    if (!parentComment) {
      return c.json({ error: "Parent comment not found" }, 404);
    }
  }

  const [inserted] = await db
    .insert(prComments)
    .values({
      pullRequestId: id,
      authorId: user.id,
      body: body.body,
      filePath: body.filePath || null,
      side: isInline ? body.side : null,
      lineNumber: isInline ? body.lineNumber : null,
      commitOid: body.commitOid || pr.headOid,
      replyToId: body.replyToId || null,
    })
    .returning();

  return c.json({
    id: inserted.id,
    body: inserted.body,
    filePath: inserted.filePath,
    side: inserted.side,
    lineNumber: inserted.lineNumber,
    commitOid: inserted.commitOid,
    replyToId: inserted.replyToId,
    author: { id: user.id, username: user.username, name: user.name, avatarUrl: user.avatarUrl },
    reactions: [],
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
  });
});

app.patch("/api/pulls/comments/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ body: string }>();

  const comment = await db.query.prComments.findFirst({
    where: eq(prComments.id, id),
  });

  if (!comment) {
    return c.json({ error: "Comment not found" }, 404);
  }

  if (user.id !== comment.authorId) {
    return c.json({ error: "Only comment author can edit" }, 403);
  }

  if (!body.body?.trim()) {
    return c.json({ error: "Comment cannot be empty" }, 400);
  }

  await db.update(prComments).set({ body: body.body, updatedAt: new Date() }).where(eq(prComments.id, id));

  return c.json({ success: true });
});

app.delete("/api/pulls/comments/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const comment = await db.query.prComments.findFirst({
    where: eq(prComments.id, id),
  });

  if (!comment) {
    return c.json({ error: "Comment not found" }, 404);
  }

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, comment.pullRequestId),
  });

  const repo = pr
    ? await db.query.repositories.findFirst({
        where: eq(repositories.id, pr.repositoryId),
      })
    : null;

  if (user.id !== comment.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  await db.delete(prComments).where(eq(prComments.id, id));

  return c.json({ success: true });
});

app.post("/api/pulls/:id/labels", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ labels: string[] }>();

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.repositoryId),
  });

  if (user.id !== pr.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  for (const labelId of body.labels) {
    await db.insert(prLabels).values({ pullRequestId: id, labelId }).onConflictDoNothing();
  }

  return c.json({ success: true });
});

app.delete("/api/pulls/:id/labels/:labelId", requireAuth, async (c) => {
  const id = c.req.param("id");
  const labelId = c.req.param("labelId");
  const user = c.get("user")!;

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.repositoryId),
  });

  if (user.id !== pr.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  await db.delete(prLabels).where(and(eq(prLabels.pullRequestId, id), eq(prLabels.labelId, labelId)));

  return c.json({ success: true });
});

app.post("/api/pulls/:id/assignees", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ assignees: string[] }>();

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.repositoryId),
  });

  if (user.id !== pr.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  for (const assigneeId of body.assignees) {
    await db.insert(prAssignees).values({ pullRequestId: id, userId: assigneeId }).onConflictDoNothing();
  }

  return c.json({ success: true });
});

app.delete("/api/pulls/:id/assignees/:userId", requireAuth, async (c) => {
  const id = c.req.param("id");
  const userId = c.req.param("userId");
  const user = c.get("user")!;

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.repositoryId),
  });

  if (user.id !== pr.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  await db.delete(prAssignees).where(and(eq(prAssignees.pullRequestId, id), eq(prAssignees.userId, userId)));

  return c.json({ success: true });
});

app.post("/api/pulls/:id/reviewers", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ reviewers: string[] }>();

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.repositoryId),
  });

  if (user.id !== pr.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  for (const reviewerId of body.reviewers) {
    await db.insert(prReviewers).values({ pullRequestId: id, userId: reviewerId }).onConflictDoNothing();
  }

  return c.json({ success: true });
});

app.delete("/api/pulls/:id/reviewers/:userId", requireAuth, async (c) => {
  const id = c.req.param("id");
  const userId = c.req.param("userId");
  const user = c.get("user")!;

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, pr.repositoryId),
  });

  if (user.id !== pr.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  await db.delete(prReviewers).where(and(eq(prReviewers.pullRequestId, id), eq(prReviewers.userId, userId)));

  return c.json({ success: true });
});

app.post("/api/pulls/:id/reactions", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ emoji: string }>();

  if (!VALID_EMOJIS.includes(body.emoji)) {
    return c.json({ error: "Invalid emoji" }, 400);
  }

  const pr = await db.query.pullRequests.findFirst({
    where: eq(pullRequests.id, id),
  });

  if (!pr) {
    return c.json({ error: "Pull request not found" }, 404);
  }

  const existing = await db.query.prReactions.findFirst({
    where: and(eq(prReactions.pullRequestId, id), eq(prReactions.userId, user.id), eq(prReactions.emoji, body.emoji)),
  });

  if (existing) {
    await db
      .delete(prReactions)
      .where(and(eq(prReactions.pullRequestId, id), eq(prReactions.userId, user.id), eq(prReactions.emoji, body.emoji)));
    return c.json({ added: false });
  } else {
    await db.insert(prReactions).values({
      pullRequestId: id,
      userId: user.id,
      emoji: body.emoji,
    });
    return c.json({ added: true });
  }
});

app.post("/api/pulls/comments/:id/reactions", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ emoji: string }>();

  if (!VALID_EMOJIS.includes(body.emoji)) {
    return c.json({ error: "Invalid emoji" }, 400);
  }

  const comment = await db.query.prComments.findFirst({
    where: eq(prComments.id, id),
  });

  if (!comment) {
    return c.json({ error: "Comment not found" }, 404);
  }

  const existing = await db.query.prReactions.findFirst({
    where: and(eq(prReactions.commentId, id), eq(prReactions.userId, user.id), eq(prReactions.emoji, body.emoji)),
  });

  if (existing) {
    await db
      .delete(prReactions)
      .where(and(eq(prReactions.commentId, id), eq(prReactions.userId, user.id), eq(prReactions.emoji, body.emoji)));
    return c.json({ added: false });
  } else {
    await db.insert(prReactions).values({
      commentId: id,
      userId: user.id,
      emoji: body.emoji,
    });
    return c.json({ added: true });
  }
});

export default app;
