import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { apiKey } from "better-auth/plugins";
import { db, users, sessions, accounts, verifications, apiKeys, passkeys } from "@gitbruv/db";
import { APIError } from "better-auth/api";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { secondaryStorage } from "./secondary-storage";

const normalizeUrl = (url: string) => {
  if (url.startsWith("http")) return url;
  if (url.includes("localhost") || url.startsWith("127.0.0.1") || url.startsWith("::1")) {
    return `http://${url}`;
  }
  return `https://${url}`;
};

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

const getApiUrl = (): string => {
  if (process.env.BETTER_AUTH_URL) {
    return normalizeUrl(process.env.BETTER_AUTH_URL);
  }

  if (process.env.API_URL) {
    return normalizeUrl(process.env.API_URL);
  }

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return normalizeUrl(process.env.RAILWAY_PUBLIC_DOMAIN);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_URL, API_URL, or RAILWAY_PUBLIC_DOMAIN must be set in production");
  }

  return "http://localhost:3001";
};

const getWebUrl = (): string => {
  if (process.env.BETTER_AUTH_URL) {
    return normalizeUrl(process.env.BETTER_AUTH_URL);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_URL or RAILWAY_PUBLIC_DOMAIN must be set in production");
  }

  return "http://localhost:3000";
};

const getTrustedOrigins = (): string[] => {
  const origins: string[] = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:8081",
    "http://10.0.2.2:3001",
    "exp://localhost:8081",
    "exp://192.168.*.*:8081",
    "exp://*",
  ];

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    origins.push(normalizeUrl(process.env.RAILWAY_PUBLIC_DOMAIN));
  }

  if (process.env.API_URL) {
    origins.push(normalizeUrl(process.env.API_URL));
  }

  if (process.env.EXPO_PUBLIC_API_URL) {
    origins.push(normalizeUrl(process.env.EXPO_PUBLIC_API_URL));
  }

  return origins;
};

export const auth = betterAuth({
  baseURL: getApiUrl(),
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
  secondaryStorage: secondaryStorage(),
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
      rpID:
        process.env.NODE_ENV === "production"
          ? (() => {
              const url = getWebUrl();
              try {
                return new URL(url).hostname;
              } catch {
                return "localhost";
              }
            })()
          : "localhost",
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

export type Session = typeof auth.$Infer.Session;
