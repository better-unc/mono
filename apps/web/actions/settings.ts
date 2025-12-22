"use server";

import { db, users, accounts, repositories } from "@gitbruv/db";
import { getSession } from "@/lib/session";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { r2Put, r2Delete } from "@/lib/r2";

export async function updateProfile(data: {
  name: string;
  username: string;
  bio?: string;
  location?: string;
  website?: string;
  pronouns?: string;
}) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const normalizedUsername = data.username.toLowerCase().replace(/\s+/g, "-");

  if (!/^[a-zA-Z0-9_-]+$/.test(normalizedUsername)) {
    throw new Error("Username can only contain letters, numbers, underscores, and hyphens");
  }

  if (normalizedUsername.length < 3) {
    throw new Error("Username must be at least 3 characters");
  }

  const existingUser = await db.query.users.findFirst({
    where: and(
      eq(users.username, normalizedUsername),
    ),
  });

  if (existingUser && existingUser.id !== session.user.id) {
    throw new Error("Username is already taken");
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
    .where(eq(users.id, session.user.id));

  revalidatePath("/settings");
  revalidatePath(`/${normalizedUsername}`);

  return { success: true, username: normalizedUsername };
}

export async function updateSocialLinks(data: {
  github?: string;
  twitter?: string;
  linkedin?: string;
  custom?: string[];
}) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

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
    .where(eq(users.id, session.user.id));

  revalidatePath("/settings");

  return { success: true };
}

export async function updateAvatar(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const file = formData.get("avatar") as File;
  if (!file || file.size === 0) {
    throw new Error("No file provided");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File size must be less than 5MB");
  }

  const ext = file.name.split(".").pop() || "png";
  const key = `avatars/${session.user.id}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await r2Put(key, buffer);

  const avatarUrl = `/api/avatar/${session.user.id}.${ext}`;

  await db
    .update(users)
    .set({
      image: avatarUrl,
      avatarUrl,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  revalidatePath("/settings");
  revalidatePath("/");

  return { success: true, avatarUrl };
}

export async function updateEmail(data: { email: string }) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, data.email),
  });

  if (existingUser && existingUser.id !== session.user.id) {
    throw new Error("Email is already in use");
  }

  await db
    .update(users)
    .set({
      email: data.email,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  revalidatePath("/settings/account");

  return { success: true };
}

export async function updatePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    throw new Error("User not found");
  }

  try {
    await auth.api.signInEmail({
      body: { email: user.email, password: data.currentPassword },
    });
  } catch {
    throw new Error("Current password is incorrect");
  }

  await auth.api.changePassword({
    body: {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    },
    headers: {
      cookie: `better-auth.session_token=${session.session.token}`,
    },
  });

  return { success: true };
}

export async function deleteAccount() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const userRepos = await db.query.repositories.findMany({
    where: eq(repositories.ownerId, session.user.id),
  });

  const { r2DeletePrefix } = await import("@/lib/r2");
  for (const repo of userRepos) {
    try {
      await r2DeletePrefix(`repos/${session.user.id}/${repo.name}.git`);
    } catch {}
  }

  try {
    await r2Delete(`avatars/${session.user.id}`);
  } catch {}

  await db.delete(users).where(eq(users.id, session.user.id));

  return { success: true };
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  return user;
}

