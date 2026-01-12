import { type Hono } from "hono";
import { PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { type AppEnv } from "../types";
import { authMiddleware } from "../middleware/auth";
import { users, repositories, accounts } from "@gitbruv/db";
import { eq, and } from "drizzle-orm";
import { getRepoPrefix, s3DeletePrefix } from "../r2-fs";
import { verifyPassword, hashPassword } from "@gitbruv/auth";

export function registerSettingsRoutes(app: Hono<AppEnv>) {
  app.patch("/api/settings/profile", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const data = await c.req.json<{ name: string; username: string; bio?: string; location?: string; website?: string; pronouns?: string }>();
    const db = c.get("db");

    const normalizedUsername = data.username.toLowerCase().replace(/\s+/g, "-");

    if (!/^[a-zA-Z0-9_-]+$/.test(normalizedUsername)) {
      return c.json({ error: "Username can only contain letters, numbers, underscores, and hyphens" }, 400);
    }

    if (normalizedUsername.length < 3) {
      return c.json({ error: "Username must be at least 3 characters" }, 400);
    }

    const existingUser = await db.query.users.findFirst({
      where: and(eq(users.username, normalizedUsername)),
    });

    if (existingUser && existingUser.id !== user.id) {
      return c.json({ error: "Username is already taken" }, 400);
    }

    await db
      .update(users)
      .set({
        name: data.name,
        username: normalizedUsername,
        bio: data.bio || null,
        location: data.location || null,
        website: data.website || null,
        pronouns: data.pronouns || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return c.json({ success: true, username: normalizedUsername });
  });

  app.patch("/api/settings/social-links", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const data = await c.req.json<{ github?: string; twitter?: string; linkedin?: string; custom?: string[] }>();
    const db = c.get("db");

    const socialLinks = {
      github: data.github || undefined,
      twitter: data.twitter || undefined,
      linkedin: data.linkedin || undefined,
      custom: data.custom?.filter(Boolean) || undefined,
    };

    await db
      .update(users)
      .set({
        socialLinks,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return c.json({ success: true });
  });

  app.post("/api/settings/avatar", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const formData = await c.req.formData();
    const file = formData.get("avatar") as File;

    if (!file || file.size === 0) {
      return c.json({ error: "No file provided" }, 400);
    }

    if (!file.type.startsWith("image/")) {
      return c.json({ error: "File must be an image" }, 400);
    }

    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: "File size must be less than 5MB" }, 400);
    }

    const ext = file.name.split(".").pop() || "png";
    const key = `avatars/${user.id}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const s3 = c.get("s3");

    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        Body: new Uint8Array(arrayBuffer),
        ContentType: file.type,
      })
    );

    const workerUrl = c.req.url.split("/api")[0];
    const timestamp = Date.now();
    const avatarUrl = `${workerUrl}/avatar/${user.id}.${ext}?v=${timestamp}`;

    const db = c.get("db");
    await db
      .update(users)
      .set({
        avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return c.json({ success: true, avatarUrl });
  });

  app.patch("/api/settings/email", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const data = await c.req.json<{ email: string }>();
    const db = c.get("db");

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    });

    if (existingUser && existingUser.id !== user.id) {
      return c.json({ error: "Email is already in use" }, 400);
    }

    await db
      .update(users)
      .set({
        email: data.email,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return c.json({ success: true });
  });

  app.patch("/api/settings/password", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const data = await c.req.json<{ currentPassword: string; newPassword: string }>();
    const db = c.get("db");

    const account = await db.query.accounts.findFirst({
      where: and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")),
    });

    if (!account?.password) {
      return c.json({ error: "No password set for this account" }, 400);
    }

    const valid = await verifyPassword(data.currentPassword, account.password);
    if (!valid) {
      return c.json({ error: "Current password is incorrect" }, 400);
    }

    const hashedPassword = await hashPassword(data.newPassword);
    await db
      .update(accounts)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id));

    return c.json({ success: true });
  });

  app.delete("/api/settings/account", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const db = c.get("db");
    const s3 = c.get("s3");

    const userRepos = await db.query.repositories.findMany({
      where: eq(repositories.ownerId, user.id),
    });

    for (const repo of userRepos) {
      try {
        const repoPrefix = getRepoPrefix(user.id, `${repo.name}.git`);
        await s3DeletePrefix(s3, repoPrefix);
      } catch {}
    }

    try {
      const avatarKeys: string[] = [];
      let continuationToken: string | undefined;
      do {
        const response = await s3.client.send(
          new ListObjectsV2Command({
            Bucket: s3.bucket,
            Prefix: `avatars/${user.id}`,
            ContinuationToken: continuationToken,
          })
        );
        for (const obj of response.Contents || []) {
          if (obj.Key) {
            avatarKeys.push(obj.Key);
          }
        }
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);

      await Promise.all(avatarKeys.map((key) => s3.client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }))));
    } catch {}

    await db.delete(users).where(eq(users.id, user.id));

    return c.json({ success: true });
  });

  app.get("/api/settings/current-user", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.text("Unauthorized", 401);
    }

    const db = c.get("db");
    const userData = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!userData) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(userData);
  });
}
