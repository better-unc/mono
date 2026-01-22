import { normalizeUrl } from "@gitbruv/lib";

const baseOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:8081",
  "http://10.0.2.2:3001",
  "exp://localhost:8081",
  "exp://192.168.*.*:8081",
];

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL,
  s3: {
    endpoint: process.env.S3_ENDPOINT!,
    region: process.env.S3_REGION || "auto",
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    bucket: process.env.S3_BUCKET!,
  },
  betterAuthSecret: process.env.BETTER_AUTH_SECRET!,
  nodeEnv: process.env.NODE_ENV || "development",
  apiUrl: process.env.API_URL!,
  webUrl: process.env.WEB_URL!,
  expoPublicApiUrl: process.env.EXPO_PUBLIC_API_URL!,
};

export const getApiUrl = (): string => {
  if (config.apiUrl) {
    return normalizeUrl(config.apiUrl);
  }

  if (config.nodeEnv === "production") {
    throw new Error("API_URL must be set in production");
  }

  return `http://localhost:${config.port}`;
};

export const getWebUrl = (): string => {
  if (config.webUrl) {
    return normalizeUrl(config.webUrl);
  }

  if (config.nodeEnv === "production") {
    throw new Error("API_URL must be set in production");
  }

  return "http://localhost:3000";
};

export const getTrustedOrigins = (): string[] => {
  const origins: string[] = [...baseOrigins, "exp://*"];

  if (config.apiUrl) {
    origins.push(normalizeUrl(config.apiUrl));
  }

  if (config.webUrl) {
    origins.push(normalizeUrl(config.webUrl));
  }

  if (config.expoPublicApiUrl) {
    origins.push(normalizeUrl(config.expoPublicApiUrl));
  }

  return origins;
};

export const getAllowedOrigins = (): string[] => {
  const allowedOrigins = [...baseOrigins];

  if (config.apiUrl) {
    allowedOrigins.push(normalizeUrl(config.apiUrl));
  }

  if (config.webUrl) {
    allowedOrigins.push(normalizeUrl(config.webUrl));
  }

  if (config.expoPublicApiUrl) {
    allowedOrigins.push(normalizeUrl(config.expoPublicApiUrl));
  }

  return allowedOrigins;
};

console.log("Allowed origins:", getAllowedOrigins());
console.log("Trusted origins:", getTrustedOrigins());
console.log("API URL:", getApiUrl());
console.log("Web URL:", getWebUrl());