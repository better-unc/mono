import { eq, and } from "drizzle-orm";
import { users, accounts, repositories, type Database } from "@gitbruv/db";
import type { Credentials, AuthResult } from "./types";
import { verifyPassword } from "./password";

export async function getUserByEmail(db: Database, email: string) {
  return db.query.users.findFirst({
    where: eq(users.email, email),
  });
}

export async function getUserById(db: Database, id: string) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  });
}

export async function getUserByUsername(db: Database, username: string) {
  return db.query.users.findFirst({
    where: eq(users.username, username),
  });
}

export async function getCredentialAccount(db: Database, userId: string) {
  return db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")),
  });
}

export async function verifyCredentials(db: Database, credentials: Credentials): Promise<AuthResult> {
  const user = (await getUserByEmail(db, credentials.identifier)) || (await getUserByUsername(db, credentials.identifier));

  if (!user) {
    return { success: false, user: null, error: "User not found" };
  }

  const account = await getCredentialAccount(db, user.id);
  if (!account?.password) {
    return { success: false, user: null, error: "No password set" };
  }

  const valid = await verifyPassword(credentials.password, account.password);
  if (!valid) {
    return { success: false, user: null, error: "Invalid password" };
  }

  return {
    success: true,
    user: { id: user.id, username: user.username },
  };
}

export async function getRepoWithOwner(db: Database, username: string, repoName: string) {
  const owner = await getUserByUsername(db, username);
  if (!owner) return null;

  const repo = await db.query.repositories.findFirst({
    where: and(eq(repositories.ownerId, owner.id), eq(repositories.name, repoName)),
  });

  if (!repo) return null;

  return {
    owner: { id: owner.id, username: owner.username },
    repo,
  };
}
