import { Hono } from "hono";
import {
  db,
  users,
  repositories,
  issues,
  labels,
  issueLabels,
  issueAssignees,
  issueComments,
  issueReactions,
} from "@gitbruv/db";
import { eq, sql, and, desc } from "drizzle-orm";
import { authMiddleware, requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", authMiddleware);

const VALID_EMOJIS = ["+1", "-1", "laugh", "hooray", "confused", "heart", "rocket", "eyes"];

async function getRepoAndCheckAccess(owner: string, name: string, userId?: string) {
  const result = await db
    .select({
      id: repositories.id,
      ownerId: repositories.ownerId,
      visibility: repositories.visibility,
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

  return { repoId: row.id, ownerId: row.ownerId };
}

async function getIssueLabels(issueId: string) {
  return db
    .select({
      id: labels.id,
      name: labels.name,
      description: labels.description,
      color: labels.color,
    })
    .from(labels)
    .innerJoin(issueLabels, eq(issueLabels.labelId, labels.id))
    .where(eq(issueLabels.issueId, issueId))
    .orderBy(labels.name);
}

async function getIssueAssignees(issueId: string) {
  return db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .innerJoin(issueAssignees, eq(issueAssignees.userId, users.id))
    .where(eq(issueAssignees.issueId, issueId));
}

async function getIssueReactionsGrouped(issueId: string, userId?: string) {
  const counts = await db
    .select({
      emoji: issueReactions.emoji,
      count: sql<number>`COUNT(*)`,
    })
    .from(issueReactions)
    .where(eq(issueReactions.issueId, issueId))
    .groupBy(issueReactions.emoji);

  let userEmojis: string[] = [];
  if (userId) {
    const userReactions = await db
      .select({ emoji: issueReactions.emoji })
      .from(issueReactions)
      .where(and(eq(issueReactions.issueId, issueId), eq(issueReactions.userId, userId)));
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
      emoji: issueReactions.emoji,
      count: sql<number>`COUNT(*)`,
    })
    .from(issueReactions)
    .where(eq(issueReactions.commentId, commentId))
    .groupBy(issueReactions.emoji);

  let userEmojis: string[] = [];
  if (userId) {
    const userReactions = await db
      .select({ emoji: issueReactions.emoji })
      .from(issueReactions)
      .where(and(eq(issueReactions.commentId, commentId), eq(issueReactions.userId, userId)));
    userEmojis = userReactions.map((r) => r.emoji);
  }

  return counts.map((c) => ({
    emoji: c.emoji,
    count: c.count,
    reacted: userEmojis.includes(c.emoji),
  }));
}

async function getCommentCount(issueId: string): Promise<number> {
  const [result] = await db.select({ count: sql<number>`COUNT(*)` }).from(issueComments).where(eq(issueComments.issueId, issueId));
  return result?.count || 0;
}

app.get("/api/repositories/:owner/:name/issues", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");
  const stateParam = c.req.query("state") || "open";
  const state: "open" | "closed" = stateParam === "closed" ? "closed" : "open";
  const limit = parseInt(c.req.query("limit") || "30", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const repoAccess = await getRepoAndCheckAccess(owner, name, currentUser?.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const query = db
    .select({
      id: issues.id,
      number: issues.number,
      title: issues.title,
      body: issues.body,
      state: issues.state,
      locked: issues.locked,
      createdAt: issues.createdAt,
      updatedAt: issues.updatedAt,
      closedAt: issues.closedAt,
      authorId: issues.authorId,
      closedById: issues.closedById,
    })
    .from(issues)
    .where(and(eq(issues.repositoryId, repoAccess.repoId), eq(issues.state, state)))
    .orderBy(desc(issues.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const rows = await query;

  const hasMore = rows.length > limit;
  const issueRows = rows.slice(0, limit);

  const issueList = await Promise.all(
    issueRows.map(async (row) => {
      const author = await db.query.users.findFirst({
        where: eq(users.id, row.authorId),
        columns: { id: true, username: true, name: true, avatarUrl: true },
      });

      const closedBy = row.closedById
        ? await db.query.users.findFirst({
            where: eq(users.id, row.closedById),
            columns: { id: true, username: true, name: true, avatarUrl: true },
          })
        : null;

      const issueLabelsData = await getIssueLabels(row.id);
      const assignees = await getIssueAssignees(row.id);
      const reactions = await getIssueReactionsGrouped(row.id, currentUser?.id);
      const commentCount = await getCommentCount(row.id);

      return {
        id: row.id,
        number: row.number,
        title: row.title,
        body: row.body,
        state: row.state,
        locked: row.locked,
        author: author || { id: row.authorId, username: "unknown", name: "Unknown", avatarUrl: null },
        labels: issueLabelsData,
        assignees,
        reactions,
        commentCount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        closedAt: row.closedAt,
        closedBy,
      };
    })
  );

  return c.json({ issues: issueList, hasMore });
});

app.post("/api/repositories/:owner/:name/issues", requireAuth, async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const user = c.get("user")!;
  const body = await c.req.json<{
    title: string;
    body?: string;
    labels?: string[];
    assignees?: string[];
  }>();

  const repoAccess = await getRepoAndCheckAccess(owner, name, user.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (!body.title?.trim()) {
    return c.json({ error: "Title cannot be empty" }, 400);
  }

  const [maxNumber] = await db
    .select({ max: sql<number>`COALESCE(MAX(number), 0)` })
    .from(issues)
    .where(eq(issues.repositoryId, repoAccess.repoId));

  const [inserted] = await db
    .insert(issues)
    .values({
      repositoryId: repoAccess.repoId,
      authorId: user.id,
      title: body.title,
      body: body.body,
      number: (maxNumber?.max || 0) + 1,
    })
    .returning();

  if (body.labels?.length) {
    for (const labelId of body.labels) {
      await db.insert(issueLabels).values({ issueId: inserted.id, labelId }).onConflictDoNothing();
    }
  }

  if (body.assignees?.length) {
    for (const assigneeId of body.assignees) {
      await db.insert(issueAssignees).values({ issueId: inserted.id, userId: assigneeId }).onConflictDoNothing();
    }
  }

  const issueLabelsData = await getIssueLabels(inserted.id);
  const assignees = await getIssueAssignees(inserted.id);

  return c.json({
    id: inserted.id,
    number: inserted.number,
    title: inserted.title,
    body: inserted.body,
    state: inserted.state,
    locked: inserted.locked,
    author: { id: user.id, username: user.username, name: user.name, avatarUrl: user.avatarUrl },
    labels: issueLabelsData,
    assignees,
    reactions: [],
    commentCount: 0,
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
    closedAt: null,
    closedBy: null,
  });
});

app.get("/api/repositories/:owner/:name/issues/count", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");

  const repoAccess = await getRepoAndCheckAccess(owner, name, currentUser?.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const [openCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(issues)
    .where(and(eq(issues.repositoryId, repoAccess.repoId), eq(issues.state, "open")));

  const [closedCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(issues)
    .where(and(eq(issues.repositoryId, repoAccess.repoId), eq(issues.state, "closed")));

  return c.json({ open: openCount?.count || 0, closed: closedCount?.count || 0 });
});

app.get("/api/repositories/:owner/:name/issues/:number", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const number = parseInt(c.req.param("number"), 10);
  const currentUser = c.get("user");

  const repoAccess = await getRepoAndCheckAccess(owner, name, currentUser?.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const issue = await db.query.issues.findFirst({
    where: and(eq(issues.repositoryId, repoAccess.repoId), eq(issues.number, number)),
  });

  if (!issue) {
    return c.json({ error: "Issue not found" }, 404);
  }

  const author = await db.query.users.findFirst({
    where: eq(users.id, issue.authorId),
    columns: { id: true, username: true, name: true, avatarUrl: true },
  });

  const closedBy = issue.closedById
    ? await db.query.users.findFirst({
        where: eq(users.id, issue.closedById),
        columns: { id: true, username: true, name: true, avatarUrl: true },
      })
    : null;

  const issueLabelsData = await getIssueLabels(issue.id);
  const assignees = await getIssueAssignees(issue.id);
  const reactions = await getIssueReactionsGrouped(issue.id, currentUser?.id);
  const commentCount = await getCommentCount(issue.id);

  return c.json({
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    locked: issue.locked,
    author: author || { id: issue.authorId, username: "unknown", name: "Unknown", avatarUrl: null },
    labels: issueLabelsData,
    assignees,
    reactions,
    commentCount,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    closedAt: issue.closedAt,
    closedBy,
  });
});

app.patch("/api/issues/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{
    title?: string;
    body?: string;
    state?: string;
    locked?: boolean;
  }>();

  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, id),
  });

  if (!issue) {
    return c.json({ error: "Issue not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, issue.repositoryId),
  });

  if (user.id !== issue.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  if (body.title !== undefined && !body.title.trim()) {
    return c.json({ error: "Title cannot be empty" }, 400);
  }

  if (body.state && body.state !== "open" && body.state !== "closed") {
    return c.json({ error: "Invalid state" }, 400);
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.body !== undefined) updates.body = body.body;
  if (body.state !== undefined) {
    updates.state = body.state;
    if (body.state === "closed" && issue.state === "open") {
      updates.closedAt = new Date();
      updates.closedById = user.id;
    } else if (body.state === "open" && issue.state === "closed") {
      updates.closedAt = null;
      updates.closedById = null;
    }
  }
  if (body.locked !== undefined) updates.locked = body.locked;

  await db.update(issues).set(updates).where(eq(issues.id, id));

  return c.json({ success: true });
});

app.delete("/api/issues/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, id),
  });

  if (!issue) {
    return c.json({ error: "Issue not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, issue.repositoryId),
  });

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can delete issues" }, 403);
  }

  await db.delete(issues).where(eq(issues.id, id));

  return c.json({ success: true });
});

app.get("/api/repositories/:owner/:name/labels", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");

  const repoAccess = await getRepoAndCheckAccess(owner, name, currentUser?.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const labelsData = await db
    .select({
      id: labels.id,
      name: labels.name,
      description: labels.description,
      color: labels.color,
    })
    .from(labels)
    .where(eq(labels.repositoryId, repoAccess.repoId))
    .orderBy(labels.name);

  return c.json({ labels: labelsData });
});

app.post("/api/repositories/:owner/:name/labels", requireAuth, async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const user = c.get("user")!;
  const body = await c.req.json<{
    name: string;
    description?: string;
    color: string;
  }>();

  const repoAccess = await getRepoAndCheckAccess(owner, name, user.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (user.id !== repoAccess.ownerId) {
    return c.json({ error: "Only repo owner can create labels" }, 403);
  }

  if (!body.name?.trim()) {
    return c.json({ error: "Name cannot be empty" }, 400);
  }

  const [label] = await db
    .insert(labels)
    .values({
      repositoryId: repoAccess.repoId,
      name: body.name,
      description: body.description,
      color: body.color,
    })
    .returning();

  return c.json(label);
});

app.patch("/api/labels/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{
    name?: string;
    description?: string;
    color?: string;
  }>();

  const label = await db.query.labels.findFirst({
    where: eq(labels.id, id),
  });

  if (!label) {
    return c.json({ error: "Label not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, label.repositoryId),
  });

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can update labels" }, 403);
  }

  const [updated] = await db
    .update(labels)
    .set({
      name: body.name ?? label.name,
      description: body.description ?? label.description,
      color: body.color ?? label.color,
    })
    .where(eq(labels.id, id))
    .returning();

  return c.json(updated);
});

app.delete("/api/labels/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const label = await db.query.labels.findFirst({
    where: eq(labels.id, id),
  });

  if (!label) {
    return c.json({ error: "Label not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, label.repositoryId),
  });

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can delete labels" }, 403);
  }

  await db.delete(labels).where(eq(labels.id, id));

  return c.json({ success: true });
});

app.post("/api/issues/:id/labels", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ labels: string[] }>();

  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, id),
  });

  if (!issue) {
    return c.json({ error: "Issue not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, issue.repositoryId),
  });

  if (user.id !== issue.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  for (const labelId of body.labels) {
    await db.insert(issueLabels).values({ issueId: id, labelId }).onConflictDoNothing();
  }

  return c.json({ success: true });
});

app.delete("/api/issues/:id/labels/:labelId", requireAuth, async (c) => {
  const id = c.req.param("id");
  const labelId = c.req.param("labelId");
  const user = c.get("user")!;

  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, id),
  });

  if (!issue) {
    return c.json({ error: "Issue not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, issue.repositoryId),
  });

  if (user.id !== issue.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  await db.delete(issueLabels).where(and(eq(issueLabels.issueId, id), eq(issueLabels.labelId, labelId)));

  return c.json({ success: true });
});

app.post("/api/issues/:id/assignees", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ assignees: string[] }>();

  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, id),
  });

  if (!issue) {
    return c.json({ error: "Issue not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, issue.repositoryId),
  });

  if (user.id !== issue.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  for (const assigneeId of body.assignees) {
    await db.insert(issueAssignees).values({ issueId: id, userId: assigneeId }).onConflictDoNothing();
  }

  return c.json({ success: true });
});

app.delete("/api/issues/:id/assignees/:userId", requireAuth, async (c) => {
  const id = c.req.param("id");
  const userId = c.req.param("userId");
  const user = c.get("user")!;

  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, id),
  });

  if (!issue) {
    return c.json({ error: "Issue not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, issue.repositoryId),
  });

  if (user.id !== issue.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  await db.delete(issueAssignees).where(and(eq(issueAssignees.issueId, id), eq(issueAssignees.userId, userId)));

  return c.json({ success: true });
});

app.get("/api/issues/:id/comments", async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");

  const comments = await db
    .select({
      id: issueComments.id,
      body: issueComments.body,
      createdAt: issueComments.createdAt,
      updatedAt: issueComments.updatedAt,
      authorId: issueComments.authorId,
    })
    .from(issueComments)
    .where(eq(issueComments.issueId, id))
    .orderBy(issueComments.createdAt);

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
        author: author || { id: comment.authorId, username: "unknown", name: "Unknown", avatarUrl: null },
        reactions,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      };
    })
  );

  return c.json({ comments: commentsList });
});

app.post("/api/issues/:id/comments", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ body: string }>();

  if (!body.body?.trim()) {
    return c.json({ error: "Comment cannot be empty" }, 400);
  }

  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, id),
  });

  if (!issue) {
    return c.json({ error: "Issue not found" }, 404);
  }

  const [inserted] = await db
    .insert(issueComments)
    .values({
      issueId: id,
      authorId: user.id,
      body: body.body,
    })
    .returning();

  return c.json({
    id: inserted.id,
    body: inserted.body,
    author: { id: user.id, username: user.username, name: user.name, avatarUrl: user.avatarUrl },
    reactions: [],
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
  });
});

app.patch("/api/issues/comments/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ body: string }>();

  const comment = await db.query.issueComments.findFirst({
    where: eq(issueComments.id, id),
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

  await db.update(issueComments).set({ body: body.body, updatedAt: new Date() }).where(eq(issueComments.id, id));

  return c.json({ success: true });
});

app.delete("/api/issues/comments/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const comment = await db.query.issueComments.findFirst({
    where: eq(issueComments.id, id),
  });

  if (!comment) {
    return c.json({ error: "Comment not found" }, 404);
  }

  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, comment.issueId),
  });

  const repo = issue
    ? await db.query.repositories.findFirst({
        where: eq(repositories.id, issue.repositoryId),
      })
    : null;

  if (user.id !== comment.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  await db.delete(issueComments).where(eq(issueComments.id, id));

  return c.json({ success: true });
});

app.post("/api/issues/:id/reactions", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ emoji: string }>();

  if (!VALID_EMOJIS.includes(body.emoji)) {
    return c.json({ error: "Invalid emoji" }, 400);
  }

  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, id),
  });

  if (!issue) {
    return c.json({ error: "Issue not found" }, 404);
  }

  const existing = await db.query.issueReactions.findFirst({
    where: and(eq(issueReactions.issueId, id), eq(issueReactions.userId, user.id), eq(issueReactions.emoji, body.emoji)),
  });

  if (existing) {
    await db
      .delete(issueReactions)
      .where(and(eq(issueReactions.issueId, id), eq(issueReactions.userId, user.id), eq(issueReactions.emoji, body.emoji)));
    return c.json({ added: false });
  } else {
    await db.insert(issueReactions).values({
      issueId: id,
      userId: user.id,
      emoji: body.emoji,
    });
    return c.json({ added: true });
  }
});

app.post("/api/issues/comments/:id/reactions", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ emoji: string }>();

  if (!VALID_EMOJIS.includes(body.emoji)) {
    return c.json({ error: "Invalid emoji" }, 400);
  }

  const comment = await db.query.issueComments.findFirst({
    where: eq(issueComments.id, id),
  });

  if (!comment) {
    return c.json({ error: "Comment not found" }, 404);
  }

  const existing = await db.query.issueReactions.findFirst({
    where: and(eq(issueReactions.commentId, id), eq(issueReactions.userId, user.id), eq(issueReactions.emoji, body.emoji)),
  });

  if (existing) {
    await db
      .delete(issueReactions)
      .where(and(eq(issueReactions.commentId, id), eq(issueReactions.userId, user.id), eq(issueReactions.emoji, body.emoji)));
    return c.json({ added: false });
  } else {
    await db.insert(issueReactions).values({
      commentId: id,
      userId: user.id,
      emoji: body.emoji,
    });
    return c.json({ added: true });
  }
});

export default app;
