import { NextRequest } from "next/server";
import { type AuthenticatedUser, getUserById, getUserByEmail } from "@gitbruv/auth";
import { db } from "@gitbruv/db";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";

export type { AuthenticatedUser };

export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedUser | null> {
  const session = await getSession();
  if (session?.user) {
    const user = await getUserById(db, session.user.id);
    if (user) {
      return { id: user.id, username: user.username };
    }
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const credentials = Buffer.from(authHeader.split(" ")[1], "base64").toString("utf-8");
    const [email, password] = credentials.split(":");
    if (email && password) {
      try {
        const result = await auth.api.signInEmail({
          body: { email, password },
          asResponse: false,
        });

        if (result?.user) {
          const user = await getUserByEmail(db, email);
          if (user) {
            return { id: user.id, username: user.username };
          }
        }
      } catch {
        return null;
      }
    }
  }

  const bearerMatch = request.headers.get("authorization")?.match(/^Bearer (.+)$/);
  if (bearerMatch) {
    try {
      const tokenSession = await auth.api.getSession({
        headers: request.headers,
      });
      if (tokenSession?.user) {
        const user = await getUserById(db, tokenSession.user.id);
        if (user) {
          return { id: user.id, username: user.username };
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}
