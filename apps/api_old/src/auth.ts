import { type AuthenticatedUser, type Credentials, getRepoWithOwner, getUserById } from "@gitbruv/auth";
import { auth } from "@gitbruv/auth/server";
import { type Database, repositories, sessions } from "@gitbruv/db";
import { eq, and, gt } from "drizzle-orm";

export type { AuthenticatedUser };

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...v] = c.trim().split("=");
      return [key, v.join("=")];
    })
  );
}

export function parseBasicAuth(request: Request): Credentials | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return null;
  }
  const credentials = atob(authHeader.slice(6));
  const colonIndex = credentials.indexOf(":");
  if (colonIndex === -1) {
    return null;
  }
  return {
    identifier: credentials.slice(0, colonIndex),
    password: credentials.slice(colonIndex + 1),
  };
}

async function verifyApiKey(key: string): Promise<{ valid: boolean; userId?: string }> {
  console.log("[Auth] Verifying API key via Better Auth...");

  try {
    const result = await auth.api.verifyApiKey({
      body: { key },
    });

    console.log("[Auth] Better Auth result:", JSON.stringify(result));

    if (result.valid && result.key?.userId) {
      console.log("[Auth] API key valid for user:", result.key.userId);
      return { valid: true, userId: result.key.userId };
    }

    console.log("[Auth] API key invalid:", result.error?.message || "Unknown error");
    return { valid: false };
  } catch (err) {
    console.error("[Auth] Error verifying API key:", err);
    return { valid: false };
  }
}

export async function authenticateRequest(request: Request, db: Database): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.token, token),
    });

    if (session && session.expiresAt > new Date()) {
      const user = await getUserById(db, session.userId);
      if (user) {
        return { id: user.id, username: user.username };
      }
    }
    return null;
  }

  const cookies = parseCookies(request.headers.get("cookie"));
  const sessionToken = cookies["better-auth.session_token"];

  if (sessionToken) {
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.token, sessionToken), gt(sessions.expiresAt, new Date())),
    });

    if (session) {
      const user = await getUserById(db, session.userId);
      if (user) {
        return { id: user.id, username: user.username };
      }
    }
  }

  const creds = parseBasicAuth(request);
  if (!creds) {
    console.log("[Auth] No Basic auth credentials found");
    return null;
  }

  console.log("[Auth] Basic auth for user:", creds.identifier);
  const apiKeyResult = await verifyApiKey(creds.password);
  if (apiKeyResult.valid && apiKeyResult.userId) {
    const user = await getUserById(db, apiKeyResult.userId);
    if (user && user.username.toLowerCase() === creds.identifier.toLowerCase()) {
      console.log("[Auth] Successfully authenticated:", user.username);
      return { id: user.id, username: user.username };
    }
    console.log("[Auth] Username mismatch - expected:", creds.identifier, "got:", user?.username);
  }

  console.log("[Auth] Authentication failed for:", creds.identifier);
  return null;
}

export async function getRepoOwnerAndRepo(
  db: Database,
  username: string,
  repoName: string
): Promise<{ owner: { id: string; username: string }; repo: typeof repositories.$inferSelect } | null> {
  return getRepoWithOwner(db, username, repoName);
}
