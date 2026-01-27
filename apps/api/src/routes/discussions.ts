import { Hono } from "hono";
import {
  db,
  users,
  repositories,
  discussions,
  discussionCategories,
  discussionComments,
  discussionReactions,
} from "@gitbruv/db";
import { eq, sql, and, desc, isNull } from "drizzle-orm";
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
  if (!row) return null;

  if (row.visibility === "private" && userId !== row.ownerId) {
    return null;
  }

  return { repoId: row.id, ownerId: row.ownerId };
}

async function getDiscussionReactionsGrouped(discussionId: string, userId?: string) {
  const counts = await db
    .select({
      emoji: discussionReactions.emoji,
      count: sql<number>`COUNT(*)`,
    })
    .from(discussionReactions)
    .where(eq(discussionReactions.discussionId, discussionId))
    .groupBy(discussionReactions.emoji);

  let userEmojis: string[] = [];
  if (userId) {
    const userReactions = await db
      .select({ emoji: discussionReactions.emoji })
      .from(discussionReactions)
      .where(and(eq(discussionReactions.discussionId, discussionId), eq(discussionReactions.userId, userId)));
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
      emoji: discussionReactions.emoji,
      count: sql<number>`COUNT(*)`,
    })
    .from(discussionReactions)
    .where(eq(discussionReactions.commentId, commentId))
    .groupBy(discussionReactions.emoji);

  let userEmojis: string[] = [];
  if (userId) {
    const userReactions = await db
      .select({ emoji: discussionReactions.emoji })
      .from(discussionReactions)
      .where(and(eq(discussionReactions.commentId, commentId), eq(discussionReactions.userId, userId)));
    userEmojis = userReactions.map((r) => r.emoji);
  }

  return counts.map((c) => ({
    emoji: c.emoji,
    count: c.count,
    reacted: userEmojis.includes(c.emoji),
  }));
}

async function enrichDiscussion(discussion: any, currentUserId?: string) {
  const author = await db.query.users.findFirst({
    where: eq(users.id, discussion.authorId),
    columns: { id: true, username: true, name: true, avatarUrl: true },
  });

  const category = discussion.categoryId
    ? await db.query.discussionCategories.findFirst({
        where: eq(discussionCategories.id, discussion.categoryId),
      })
    : null;

  const [commentCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(discussionComments)
    .where(eq(discussionComments.discussionId, discussion.id));

  const reactions = await getDiscussionReactionsGrouped(discussion.id, currentUserId);

  return {
    id: discussion.id,
    number: discussion.number,
    title: discussion.title,
    body: discussion.body,
    author: author || { id: discussion.authorId, username: "unknown", name: "Unknown", avatarUrl: null },
    category: category ? { id: category.id, name: category.name, emoji: category.emoji } : null,
    isPinned: discussion.isPinned,
    isLocked: discussion.isLocked,
    isAnswered: discussion.isAnswered,
    answerId: discussion.answerId,
    reactions,
    commentCount: commentCount?.count || 0,
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
  };
}

app.get("/api/repositories/:owner/:name/discussions", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");
  const categoryFilter = c.req.query("category");
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const repoAccess = await getRepoAndCheckAccess(owner, name, currentUser?.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const conditions = [eq(discussions.repositoryId, repoAccess.repoId)];
  if (categoryFilter) {
    conditions.push(eq(discussions.categoryId, categoryFilter));
  }

  const rows = await db
    .select()
    .from(discussions)
    .where(and(...conditions))
    .orderBy(desc(discussions.isPinned), desc(discussions.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const discussionsList = await Promise.all(
    rows.slice(0, limit).map((d) => enrichDiscussion(d, currentUser?.id))
  );

  return c.json({ discussions: discussionsList, hasMore });
});

app.get("/api/repositories/:owner/:name/discussions/categories", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const currentUser = c.get("user");

  const repoAccess = await getRepoAndCheckAccess(owner, name, currentUser?.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const categories = await db
    .select()
    .from(discussionCategories)
    .where(eq(discussionCategories.repositoryId, repoAccess.repoId))
    .orderBy(discussionCategories.name);

  return c.json({ categories });
});

app.post("/api/repositories/:owner/:name/discussions/categories", requireAuth, async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const user = c.get("user")!;
  const body = await c.req.json<{ name: string; emoji?: string; description?: string }>();

  const repoAccess = await getRepoAndCheckAccess(owner, name, user.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (user.id !== repoAccess.ownerId) {
    return c.json({ error: "Only repo owner can create categories" }, 403);
  }

  if (!body.name?.trim()) {
    return c.json({ error: "Category name is required" }, 400);
  }

  const [inserted] = await db
    .insert(discussionCategories)
    .values({
      repositoryId: repoAccess.repoId,
      name: body.name,
      emoji: body.emoji,
      description: body.description,
    })
    .returning();

  return c.json(inserted);
});

app.get("/api/repositories/:owner/:name/discussions/:number", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const number = parseInt(c.req.param("number"), 10);
  const currentUser = c.get("user");

  const repoAccess = await getRepoAndCheckAccess(owner, name, currentUser?.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const discussion = await db.query.discussions.findFirst({
    where: and(eq(discussions.repositoryId, repoAccess.repoId), eq(discussions.number, number)),
  });

  if (!discussion) {
    return c.json({ error: "Discussion not found" }, 404);
  }

  const enriched = await enrichDiscussion(discussion, currentUser?.id);
  return c.json(enriched);
});

app.post("/api/repositories/:owner/:name/discussions", requireAuth, async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const user = c.get("user")!;
  const body = await c.req.json<{ title: string; body: string; categoryId?: string }>();

  const repoAccess = await getRepoAndCheckAccess(owner, name, user.id);
  if (!repoAccess) {
    return c.json({ error: "Repository not found" }, 404);
  }

  if (!body.title?.trim()) {
    return c.json({ error: "Title is required" }, 400);
  }

  if (!body.body?.trim()) {
    return c.json({ error: "Body is required" }, 400);
  }

  const [maxNumber] = await db
    .select({ max: sql<number>`COALESCE(MAX(number), 0)` })
    .from(discussions)
    .where(eq(discussions.repositoryId, repoAccess.repoId));

  const [inserted] = await db
    .insert(discussions)
    .values({
      repositoryId: repoAccess.repoId,
      authorId: user.id,
      title: body.title,
      body: body.body,
      categoryId: body.categoryId || null,
      number: (maxNumber?.max || 0) + 1,
    })
    .returning();

  const enriched = await enrichDiscussion(inserted, user.id);
  return c.json(enriched);
});

app.patch("/api/discussions/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ title?: string; body?: string; categoryId?: string }>();

  const discussion = await db.query.discussions.findFirst({
    where: eq(discussions.id, id),
  });

  if (!discussion) {
    return c.json({ error: "Discussion not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, discussion.repositoryId),
  });

  if (user.id !== discussion.authorId && user.id !== repo?.ownerId) {
    return c.json({ error: "Not authorized" }, 403);
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.body !== undefined) updates.body = body.body;
  if (body.categoryId !== undefined) updates.categoryId = body.categoryId || null;

  await db.update(discussions).set(updates).where(eq(discussions.id, id));

  return c.json({ success: true });
});

app.patch("/api/discussions/:id/pin", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const discussion = await db.query.discussions.findFirst({
    where: eq(discussions.id, id),
  });

  if (!discussion) {
    return c.json({ error: "Discussion not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, discussion.repositoryId),
  });

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can pin discussions" }, 403);
  }

  await db
    .update(discussions)
    .set({ isPinned: !discussion.isPinned, updatedAt: new Date() })
    .where(eq(discussions.id, id));

  return c.json({ success: true, isPinned: !discussion.isPinned });
});

app.patch("/api/discussions/:id/lock", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const discussion = await db.query.discussions.findFirst({
    where: eq(discussions.id, id),
  });

  if (!discussion) {
    return c.json({ error: "Discussion not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, discussion.repositoryId),
  });

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can lock discussions" }, 403);
  }

  await db
    .update(discussions)
    .set({ isLocked: !discussion.isLocked, updatedAt: new Date() })
    .where(eq(discussions.id, id));

  return c.json({ success: true, isLocked: !discussion.isLocked });
});

app.delete("/api/discussions/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const discussion = await db.query.discussions.findFirst({
    where: eq(discussions.id, id),
  });

  if (!discussion) {
    return c.json({ error: "Discussion not found" }, 404);
  }

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, discussion.repositoryId),
  });

  if (user.id !== repo?.ownerId) {
    return c.json({ error: "Only repo owner can delete discussions" }, 403);
  }

  await db.delete(discussions).where(eq(discussions.id, id));

  return c.json({ success: true });
});

app.get("/api/discussions/:id/comments", async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");

  const discussion = await db.query.discussions.findFirst({
    where: eq(discussions.id, id),
  });

  if (!discussion) {
    return c.json({ error: "Discussion not found" }, 404);
  }

  const comments = await db
    .select()
    .from(discussionComments)
    .where(eq(discussionComments.discussionId, id))
    .orderBy(discussionComments.createdAt);

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
        parentId: comment.parentId,
        isAnswer: comment.isAnswer,
        author: author || { id: comment.authorId, username: "unknown", name: "Unknown", avatarUrl: null },
        reactions,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      };
    })
  );

  return c.json({ comments: commentsList });
});

app.post("/api/discussions/:id/comments", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ body: string; parentId?: string }>();

  if (!body.body?.trim()) {
    return c.json({ error: "Comment cannot be empty" }, 400);
  }

  const discussion = await db.query.discussions.findFirst({
    where: eq(discussions.id, id),
  });

  if (!discussion) {
    return c.json({ error: "Discussion not found" }, 404);
  }

  if (discussion.isLocked) {
    return c.json({ error: "Discussion is locked" }, 403);
  }

  const [inserted] = await db
    .insert(discussionComments)
    .values({
      discussionId: id,
      authorId: user.id,
      body: body.body,
      parentId: body.parentId || null,
    })
    .returning();

  return c.json({
    id: inserted.id,
    body: inserted.body,
    parentId: inserted.parentId,
    isAnswer: inserted.isAnswer,
    author: { id: user.id, username: user.username, name: user.name, avatarUrl: user.avatarUrl },
    reactions: [],
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
  });
});

app.patch("/api/discussions/comments/:id/answer", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const comment = await db.query.discussionComments.findFirst({
    where: eq(discussionComments.id, id),
  });

  if (!comment) {
    return c.json({ error: "Comment not found" }, 404);
  }

  const discussion = await db.query.discussions.findFirst({
    where: eq(discussions.id, comment.discussionId),
  });

  if (!discussion) {
    return c.json({ error: "Discussion not found" }, 404);
  }

  if (user.id !== discussion.authorId) {
    return c.json({ error: "Only discussion author can mark answers" }, 403);
  }

  if (comment.isAnswer) {
    await db
      .update(discussionComments)
      .set({ isAnswer: false })
      .where(eq(discussionComments.id, id));

    await db
      .update(discussions)
      .set({ isAnswered: false, answerId: null, updatedAt: new Date() })
      .where(eq(discussions.id, discussion.id));

    return c.json({ success: true, isAnswer: false });
  }

  await db
    .update(discussionComments)
    .set({ isAnswer: false })
    .where(eq(discussionComments.discussionId, discussion.id));

  await db
    .update(discussionComments)
    .set({ isAnswer: true })
    .where(eq(discussionComments.id, id));

  await db
    .update(discussions)
    .set({ isAnswered: true, answerId: id, updatedAt: new Date() })
    .where(eq(discussions.id, discussion.id));

  return c.json({ success: true, isAnswer: true });
});

app.post("/api/discussions/:id/reactions", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ emoji: string }>();

  if (!VALID_EMOJIS.includes(body.emoji)) {
    return c.json({ error: "Invalid emoji" }, 400);
  }

  const discussion = await db.query.discussions.findFirst({
    where: eq(discussions.id, id),
  });

  if (!discussion) {
    return c.json({ error: "Discussion not found" }, 404);
  }

  const existing = await db.query.discussionReactions.findFirst({
    where: and(
      eq(discussionReactions.discussionId, id),
      eq(discussionReactions.userId, user.id),
      eq(discussionReactions.emoji, body.emoji)
    ),
  });

  if (existing) {
    await db.delete(discussionReactions).where(eq(discussionReactions.id, existing.id));
    return c.json({ added: false });
  } else {
    await db.insert(discussionReactions).values({
      discussionId: id,
      userId: user.id,
      emoji: body.emoji,
    });
    return c.json({ added: true });
  }
});

app.post("/api/discussions/comments/:id/reactions", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await c.req.json<{ emoji: string }>();

  if (!VALID_EMOJIS.includes(body.emoji)) {
    return c.json({ error: "Invalid emoji" }, 400);
  }

  const comment = await db.query.discussionComments.findFirst({
    where: eq(discussionComments.id, id),
  });

  if (!comment) {
    return c.json({ error: "Comment not found" }, 404);
  }

  const existing = await db.query.discussionReactions.findFirst({
    where: and(
      eq(discussionReactions.commentId, id),
      eq(discussionReactions.userId, user.id),
      eq(discussionReactions.emoji, body.emoji)
    ),
  });

  if (existing) {
    await db.delete(discussionReactions).where(eq(discussionReactions.id, existing.id));
    return c.json({ added: false });
  } else {
    await db.insert(discussionReactions).values({
      commentId: id,
      userId: user.id,
      emoji: body.emoji,
    });
    return c.json({ added: true });
  }
});

export default app;
