import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { apiKey } from "better-auth/plugins";
import { db, users, sessions, accounts, verifications, apiKeys, passkeys } from "@gitbruv/db";
import { APIError } from "better-auth/api";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { getRedis } from "./redis";
import { getApiUrl, getWebUrl, getTrustedOrigins, config } from "./config";

const BLOCKED_EMAIL_DOMAINS = [
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "guerrillamail.org",
  "10minutemail.com",
  "mailinator.com",
  "throwaway.email",
  "fakeinbox.com",
  "trashmail.com",
  "maildrop.cc",
  "yopmail.com",
  "disposablemail.com",
  "getnada.com",
  "mohmal.com",
  "sharklasers.com",
  "spam4.me",
  "grr.la",
  "dispostable.com",
  "mailnesia.com",
  "spamgourmet.com",
];

function containsEmoji(str: string): boolean {
  return /\p{Extended_Pictographic}/u.test(str);
}

function isValidUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters" };
  }

  if (username.length > 39) {
    return { valid: false, error: "Username must be 39 characters or less" };
  }

  if (containsEmoji(username)) {
    return { valid: false, error: "Username cannot contain emojis" };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return {
      valid: false,
      error: "Username can only contain letters, numbers, hyphens, and underscores",
    };
  }

  if (!/[a-zA-Z0-9]/.test(username)) {
    return {
      valid: false,
      error: "Username must contain at least one letter or number",
    };
  }

  if (username.startsWith("-") || username.endsWith("-")) {
    return { valid: false, error: "Username cannot start or end with a hyphen" };
  }

  if (username.includes("--")) {
    return {
      valid: false,
      error: "Username cannot contain consecutive hyphens",
    };
  }

  return { valid: true };
}

function isBlockedEmailDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return true;
  return BLOCKED_EMAIL_DOMAINS.includes(domain);
}

let authInstance: ReturnType<typeof betterAuth> | null = null;
let authInitPromise: Promise<ReturnType<typeof betterAuth>> | null = null;

export const initAuth = async () => {
  if (authInstance) {
    return authInstance;
  }

  if (authInitPromise) {
    return authInitPromise;
  }

  authInitPromise = (async () => {
    const redis = await getRedis();
    const apiUrl = getApiUrl();
    console.log(`[API] Better Auth baseURL: ${apiUrl}`);

  authInstance = betterAuth({
    baseURL: apiUrl,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        apikey: apiKeys,
        passkey: passkeys,
      },
    }),
    secondaryStorage: redis ? {
      get: async (key) => {
        return await redis.get(key);
      },
      set: async (key, value, ttl) => {
        if (ttl) await redis.set(key, value, { EX: ttl });
        else await redis.set(key, value);
      },
      delete: async (key) => {
        await redis.del(key);
      },
    } : undefined,
    session: {
      storeSessionInDatabase: true,
    },
    trustedOrigins: getTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      apiKey({
        defaultPrefix: "gitbruv_",
      }),
      expo({}),
      passkey({
        rpID: new URL(getWebUrl()).hostname,
        rpName: "gitbruv",
        origin: getWebUrl(),
        authenticatorSelection: {
          authenticatorAttachment: undefined,
          residentKey: "preferred",
          userVerification: "preferred",
        },
      }),
    ],
    user: {
      additionalFields: {
        username: {
          type: "string",
          required: true,
          input: true,
        },
      },
    },
    advanced: { disableOriginCheck: true },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (isBlockedEmailDomain(user.email)) {
              throw new APIError("BAD_REQUEST", {
                message: "This email domain is not allowed. Please use a different email address.",
              });
            }

            const username = (user as { username?: string }).username;
            if (username) {
              const validation = isValidUsername(username);
              if (!validation.valid) {
                throw new APIError("BAD_REQUEST", {
                  message: validation.error,
                });
              }
            }

            return { data: user };
          },
        },
      },
    },
  });

    return authInstance;
  })();

  return authInitPromise;
};

export const getAuth = () => {
  if (!authInstance) {
    throw new Error("Auth not initialized. Call initAuth() first.");
  }
  return authInstance;
};

export async function verifyCredentials(request: Request): Promise<Response> {
  const secret = config.betterAuthSecret;
  if (!secret) {
    console.error("[API] verify-credentials: missing BETTER_AUTH_SECRET");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const provided = request.headers.get("x-internal-auth");
  if (!provided || provided !== secret) {
    console.warn("[API] verify-credentials: invalid internal auth header");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { email?: string; password?: string } | null = null;
  try {
    body = await request.json() as { email?: string; password?: string };
  } catch {
    body = null;
  }

  const email = body?.email;
  const password = body?.password;
  const safeEmail = typeof email === "string" ? email.replace(/^(.).+(@.+)$/, "$1***$2") : "unknown";

  if (!email || !password || typeof email !== "string" || typeof password !== "string" || !email.includes("@")) {
    console.warn("[API] verify-credentials: invalid body", { email: safeEmail });
    return new Response(JSON.stringify({ error: "Invalid credentials" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = getAuth();
  let user: any = null;
  try {
    console.log(`[API] verify-credentials: attempting sign-in for ${safeEmail}`);
    const result: any = await auth.api.signInEmail({
      body: {
        email,
        password,
        rememberMe: false,
      },
      headers: request.headers,
    });
    user = result?.user ?? result?.session?.user ?? null;
    if (user) {
      console.info(`[API] verify-credentials: sign-in successful`, { userId: user.id, email: safeEmail });
    } else {
      console.warn(`[API] verify-credentials: sign-in ok but no user`, { email: safeEmail });
    }
  } catch (error) {
    console.warn(`[API] verify-credentials: sign-in failed`, {
      email: safeEmail,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    user = null;
  }

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      user,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export type Session = Awaited<ReturnType<ReturnType<typeof betterAuth>["api"]["getSession"]>>;
