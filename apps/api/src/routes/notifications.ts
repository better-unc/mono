import { Hono } from "hono";
import { db, users, notifications } from "@gitbruv/db";
import { eq, sql, and, desc } from "drizzle-orm";
import { authMiddleware, requireAuth, type AuthVariables } from "../middleware/auth";
import { notifyUser } from "../websocket";
import { sendNotificationEmail } from "../email";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", authMiddleware);

async function enrichNotification(notification: any) {
  let actor = null;
  if (notification.actorId) {
    actor = await db.query.users.findFirst({
      where: eq(users.id, notification.actorId),
      columns: { id: true, username: true, name: true, avatarUrl: true },
    });
  }

  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    resourceType: notification.resourceType,
    resourceId: notification.resourceId,
    repoOwner: notification.repoOwner,
    repoName: notification.repoName,
    resourceNumber: notification.resourceNumber,
    actor,
    read: notification.read,
    createdAt: notification.createdAt,
  };
}

app.get("/api/notifications", requireAuth, async (c) => {
  const user = c.get("user")!;
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);
  const offset = parseInt(c.req.query("offset") || "0", 10);
  const unreadOnly = c.req.query("unread") === "true";

  const conditions = [eq(notifications.userId, user.id)];
  if (unreadOnly) {
    conditions.push(eq(notifications.read, false));
  }

  const results = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = results.length > limit;
  const notificationsList = await Promise.all(
    results.slice(0, limit).map(enrichNotification)
  );

  return c.json({ notifications: notificationsList, hasMore });
});

app.get("/api/notifications/unread-count", requireAuth, async (c) => {
  const user = c.get("user")!;

  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));

  return c.json({ count: result?.count || 0 });
});

app.patch("/api/notifications/:id/read", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const notification = await db.query.notifications.findFirst({
    where: eq(notifications.id, id),
  });

  if (!notification) {
    return c.json({ error: "Notification not found" }, 404);
  }

  if (notification.userId !== user.id) {
    return c.json({ error: "Not authorized" }, 403);
  }

  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, id));

  return c.json({ success: true });
});

app.post("/api/notifications/mark-all-read", requireAuth, async (c) => {
  const user = c.get("user")!;

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));

  return c.json({ success: true });
});

app.delete("/api/notifications/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const notification = await db.query.notifications.findFirst({
    where: eq(notifications.id, id),
  });

  if (!notification) {
    return c.json({ error: "Notification not found" }, 404);
  }

  if (notification.userId !== user.id) {
    return c.json({ error: "Not authorized" }, 403);
  }

  await db.delete(notifications).where(eq(notifications.id, id));

  return c.json({ success: true });
});

export type NotificationType =
  | "issue_comment"
  | "issue_assigned"
  | "issue_closed"
  | "pr_comment"
  | "pr_review"
  | "pr_merged"
  | "pr_assigned"
  | "mention"
  | "discussion_reply";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  resourceType?: "issue" | "pull_request" | "discussion";
  resourceId?: string;
  actorId?: string;
  repoOwner?: string;
  repoName?: string;
  resourceNumber?: number;
  sendEmail?: boolean;
};

export async function createNotification(input: CreateNotificationInput) {
  const [inserted] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      actorId: input.actorId,
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      resourceNumber: input.resourceNumber,
    })
    .returning();

  const enriched = await enrichNotification(inserted);

  notifyUser(input.userId, {
    type: "notification",
    notification: enriched,
  });

  if (input.sendEmail) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, input.userId),
    });

    if (user?.email && user.preferences?.emailNotifications !== false) {
      let actionUrl: string | undefined;
      if (input.repoOwner && input.repoName && input.resourceNumber) {
        const resourcePath = input.resourceType === "issue" ? "issues" : input.resourceType === "pull_request" ? "pulls" : "discussions";
        actionUrl = `/${input.repoOwner}/${input.repoName}/${resourcePath}/${input.resourceNumber}`;
      }

      await sendNotificationEmail(user.email, input.title, input.body || "", actionUrl, "View");

      await db
        .update(notifications)
        .set({ emailSent: true })
        .where(eq(notifications.id, inserted.id));
    }
  }

  return enriched;
}

export async function createNotifications(inputs: CreateNotificationInput[]) {
  return Promise.all(inputs.map(createNotification));
}

export default app;
