import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { apiKey } from "better-auth/plugins";
import { db, users, sessions, accounts, verifications, apiKeys } from "@gitbruv/db";
import { APIError } from "better-auth/api";

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

const getTrustedOrigins = (): string[] => {
  const origins: string[] = ["http://localhost:3000"];

  if (process.env.PUBLIC_SERVER_URL) {
    origins.push(process.env.PUBLIC_SERVER_URL);
  }

  if (process.env.BETTER_AUTH_URL) {
    origins.push(process.env.BETTER_AUTH_URL);
  }

  return origins;
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
      apikey: apiKeys,
    },
  }),
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  plugins: [
    apiKey({
      defaultPrefix: "gitbruv_",
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

export type Session = typeof auth.$Infer.Session;
