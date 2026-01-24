import { Hono } from "hono";
import { db, users, repositories, accounts } from "@gitbruv/db";
import { eq, ne, and } from "drizzle-orm";
import { authMiddleware, requireAuth, type AuthVariables } from "../middleware/auth";
import { putObject, deleteObject, deletePrefix, getRepoPrefix } from "../s3";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", authMiddleware);

function cacheBustAvatarUrl(avatarUrl: string | null, updatedAt: Date): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.includes("v=")) return avatarUrl;
  const separator = avatarUrl.includes("?") ? "&" : "?";
  return `${avatarUrl}${separator}v=${updatedAt.getTime()}`;
}

app.get("/api/settings", requireAuth, async (c) => {
  const user = c.get("user")!;

  const result = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (!result) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    user: {
      ...result,
      avatarUrl: cacheBustAvatarUrl(result.avatarUrl, result.updatedAt),
    },
  });
});

app.patch("/api/settings/profile", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json<{
    name?: string;
    username?: string;
    bio?: string;
    location?: string;
    website?: string;
    pronouns?: string;
    company?: string;
    gitEmail?: string;
    defaultRepositoryVisibility?: string;
  }>();

  let normalizedUsername = body.username?.toLowerCase().replace(/ /g, "-");

  if (normalizedUsername) {
    if (!/^[a-zA-Z0-9_-]+$/.test(normalizedUsername)) {
      return c.json({ error: "Username can only contain letters, numbers, underscores, and hyphens" }, 400);
    }
    if (normalizedUsername.length < 3) {
      return c.json({ error: "Username must be at least 3 characters" }, 400);
    }

    const existing = await db.query.users.findFirst({
      where: and(eq(users.username, normalizedUsername), ne(users.id, user.id)),
    });

    if (existing) {
      return c.json({ error: "Username is already taken" }, 400);
    }
  }

  if (body.defaultRepositoryVisibility && body.defaultRepositoryVisibility !== "public" && body.defaultRepositoryVisibility !== "private") {
    return c.json({ error: "defaultRepositoryVisibility must be 'public' or 'private'" }, 400);
  }

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  const finalUsername = normalizedUsername || currentUser?.username;

  await db
    .update(users)
    .set({
      name: body.name ?? currentUser?.name,
      username: finalUsername,
      bio: body.bio ?? currentUser?.bio,
      location: body.location ?? currentUser?.location,
      website: body.website ?? currentUser?.website,
      pronouns: body.pronouns ?? currentUser?.pronouns,
      company: body.company ?? currentUser?.company,
      gitEmail: body.gitEmail ?? currentUser?.gitEmail,
      defaultRepositoryVisibility: (body.defaultRepositoryVisibility as "public" | "private") ?? currentUser?.defaultRepositoryVisibility,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return c.json({ success: true, username: finalUsername });
});

app.patch("/api/settings/preferences", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json<{
    emailNotifications?: boolean;
    theme?: string;
    language?: string;
    showEmail?: boolean;
  }>();

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  const currentPreferences = (currentUser?.preferences || {}) as Record<string, any>;

  const newPreferences = { ...currentPreferences };
  if (body.emailNotifications !== undefined) newPreferences.emailNotifications = body.emailNotifications;
  if (body.theme !== undefined) newPreferences.theme = body.theme;
  if (body.language !== undefined) newPreferences.language = body.language;
  if (body.showEmail !== undefined) newPreferences.showEmail = body.showEmail;

  await db
    .update(users)
    .set({
      preferences: newPreferences,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return c.json({ success: true });
});

app.get("/api/settings/word-wrap", requireAuth, async (c) => {
  const user = c.get("user")!;

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  const preferences = (currentUser?.preferences || {}) as Record<string, any>;
  const wordWrap = preferences.wordWrap ?? false;

  return c.json({ wordWrap });
});

app.patch("/api/settings/word-wrap", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json<{ wordWrap: boolean }>();

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  const currentPreferences = (currentUser?.preferences || {}) as Record<string, any>;
  const newPreferences = { ...currentPreferences, wordWrap: body.wordWrap };

  await db
    .update(users)
    .set({
      preferences: newPreferences,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return c.json({ success: true, wordWrap: body.wordWrap });
});

app.patch("/api/settings/email", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json<{ email: string }>();

  const existing = await db.query.users.findFirst({
    where: and(eq(users.email, body.email), ne(users.id, user.id)),
  });

  if (existing) {
    return c.json({ error: "Email already in use" }, 400);
  }

  const [updated] = await db
    .update(users)
    .set({
      email: body.email,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();

  return c.json(updated);
});

app.post("/api/settings/avatar", requireAuth, async (c) => {
  const user = c.get("user")!;
  const formData = await c.req.formData();
  const file = formData.get("avatar") as File | null;

  if (!file) {
    return c.json({ error: "No avatar file provided" }, 400);
  }

  const contentType = file.type;
  if (!contentType.startsWith("image/")) {
    return c.json({ error: "File must be an image" }, 400);
  }

  const data = await file.arrayBuffer();
  if (data.byteLength > 5 * 1024 * 1024) {
    return c.json({ error: "File size must be less than 5MB" }, 400);
  }

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (currentUser?.avatarUrl) {
    const withoutQuery = currentUser.avatarUrl.split("?")[0];
    const filename = withoutQuery.replace("/api/avatar/", "");
    if (filename) {
      const oldKey = `avatars/${filename}`;
      try {
        await deleteObject(oldKey);
      } catch {}
    }
  }

  const ext = file.name.split(".").pop() || "png";
  const key = `avatars/${user.id}.${ext}`;

  await putObject(key, Buffer.from(data), contentType);

  const timestamp = Date.now();
  const avatarUrl = `/api/avatar/${user.id}.${ext}?v=${timestamp}`;

  await db
    .update(users)
    .set({
      avatarUrl,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return c.json({ success: true, avatarUrl });
});

app.delete("/api/settings/avatar", requireAuth, async (c) => {
  const user = c.get("user")!;

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (currentUser?.avatarUrl) {
    const withoutQuery = currentUser.avatarUrl.split("?")[0];
    const filename = withoutQuery.replace("/api/avatar/", "");
    if (filename) {
      const oldKey = `avatars/${filename}`;
      try {
        await deleteObject(oldKey);
      } catch {}
    }
  }

  await db
    .update(users)
    .set({
      avatarUrl: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return c.json({ success: true, avatarUrl: null });
});

app.patch("/api/settings/social-links", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json<{
    github?: string;
    twitter?: string;
    linkedin?: string;
    custom?: string[];
  }>();

  const socialLinks: {
    github?: string;
    twitter?: string;
    linkedin?: string;
    custom?: string[];
  } = {};

  if (body.github?.trim()) {
    socialLinks.github = body.github.trim();
  }
  if (body.twitter?.trim()) {
    socialLinks.twitter = body.twitter.trim();
  }
  if (body.linkedin?.trim()) {
    socialLinks.linkedin = body.linkedin.trim();
  }
  if (body.custom?.filter((s) => s.trim()).length) {
    socialLinks.custom = body.custom.filter((s) => s.trim());
  }

  await db
    .update(users)
    .set({
      socialLinks,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return c.json({ success: true });
});

app.patch("/api/settings/password", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json<{
    currentPassword: string;
    newPassword: string;
  }>();

  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")),
  });

  if (!account || !account.password) {
    return c.json({ error: "No password set for this account" }, 400);
  }

  const valid = await Bun.password.verify(body.currentPassword, account.password);
  if (!valid) {
    return c.json({ error: "Current password is incorrect" }, 400);
  }

  const newHash = await Bun.password.hash(body.newPassword, { algorithm: "bcrypt", cost: 12 });

  await db
    .update(accounts)
    .set({
      password: newHash,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, account.id));

  return c.json({ success: true });
});

app.delete("/api/settings/account", requireAuth, async (c) => {
  const user = c.get("user")!;

  const repos = await db.query.repositories.findMany({
    where: eq(repositories.ownerId, user.id),
    columns: { name: true },
  });

  for (const repo of repos) {
    const repoPrefix = getRepoPrefix(user.id, repo.name);
    try {
      await deletePrefix(repoPrefix);
    } catch {}
  }

  const avatarPrefix = `avatars/${user.id}`;
  try {
    await deletePrefix(avatarPrefix);
  } catch {}

  await db.delete(users).where(eq(users.id, user.id));

  return c.json({ success: true });
});

app.get("/api/settings/current-user", requireAuth, async (c) => {
  const user = c.get("user")!;

  const result = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (!result) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    id: result.id,
    name: result.name,
    email: result.email,
    emailVerified: result.emailVerified,
    username: result.username,
    bio: result.bio,
    location: result.location,
    website: result.website,
    pronouns: result.pronouns,
    avatarUrl: result.avatarUrl,
    company: result.company,
    gitEmail: result.gitEmail,
    defaultRepositoryVisibility: result.defaultRepositoryVisibility,
    preferences: result.preferences,
    socialLinks: result.socialLinks,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    lastActiveAt: result.lastActiveAt,
  });
});

export default app;
