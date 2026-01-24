import { createClient, type RedisClientType } from "redis";
import { config } from "./config";

let redis: RedisClientType | null = null;

export const getRedis = async (): Promise<RedisClientType | null> => {
  if (!config.redisUrl) {
    return null;
  }

  if (redis) {
    return redis;
  }

  redis = createClient({
    url: config.redisUrl,
  });

  try {
    await redis.connect();
    
  } catch (error) {
    console.error("[API] Failed to connect to Redis:", error instanceof Error ? error.message : "Unknown error");
    redis = null;
  }

  return redis;
};

export const initRedis = async (): Promise<RedisClientType> => {
  if (!config.redisUrl) {
    throw new Error("REDIS_URL is not configured");
  }

  const client = await getRedis();
  if (!client) {
    throw new Error("Failed to connect to Redis");
  }

  return client;
};

export const CACHE_TTL = {
  session: 60 * 60,
  gitObject: 60 * 60 * 24,
  refs: 60 * 5,
  tree: 60 * 30,
  file: 60 * 60,
} as const;
