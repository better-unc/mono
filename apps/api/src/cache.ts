import { createClient, type RedisClientType } from "redis";
import { config } from "./config";

let redis: RedisClientType | null = null;
let connectionAttempted = false;

export const getRedisClient = async (): Promise<RedisClientType | null> => {
  if (!config.redisUrl) {
    return null;
  }

  if (redis) {
    return redis;
  }

  if (connectionAttempted) {
    return null;
  }

  connectionAttempted = true;

  try {
    redis = createClient({ url: config.redisUrl });
    await redis.connect();

    return redis;
  } catch (error) {
    console.error("[Cache] Redis connection failed:", error instanceof Error ? error.message : "Unknown");
    redis = null;
    return null;
  }
};

export const CACHE_TTL = {
  session: 60 * 60,
  gitObject: 60 * 60 * 24,
  refs: 60 * 5,
  branches: 60 * 5,
  tree: 60 * 30,
  file: 60 * 60,
  commits: 60 * 10,
} as const;

function cacheKey(type: string, ...parts: string[]): string {
  return `gitbruv:${type}:${parts.join(":")}`;
}

export async function getCached<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const data = await client.get(key);
    if (data) {
      return JSON.parse(data) as T;
    }
  } catch {
  }
  return null;
}

export async function setCache<T>(key: string, value: T, ttl: number): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(value), { EX: ttl });
  } catch {
  }
}

export async function deleteCache(key: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.del(key);
  } catch {
  }
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch {
  }
}

export const repoCache = {
  branchesKey: (userId: string, repoName: string) =>
    cacheKey("branches", userId, repoName),

  commitsKey: (userId: string, repoName: string, branch: string, limit: number, skip: number) =>
    cacheKey("commits", userId, repoName, branch, String(limit), String(skip)),

  commitCountKey: (userId: string, repoName: string, branch: string) =>
    cacheKey("commit-count", userId, repoName, branch),

  treeKey: (userId: string, repoName: string, branch: string, path: string) =>
    cacheKey("tree", userId, repoName, branch, path || "root"),

  fileKey: (userId: string, repoName: string, branch: string, path: string) =>
    cacheKey("file", userId, repoName, branch, path),

  refKey: (userId: string, repoName: string, ref: string) =>
    cacheKey("ref", userId, repoName, ref),

  async invalidateRepo(userId: string, repoName: string): Promise<void> {
    await deleteCachePattern(`gitbruv:*:${userId}:${repoName}:*`);
    await deleteCachePattern(`gitbruv:*:${userId}:${repoName}`);

  },

  async invalidateBranch(userId: string, repoName: string, branch: string): Promise<void> {
    await deleteCachePattern(`gitbruv:commits:${userId}:${repoName}:${branch}:*`);
    await deleteCache(repoCache.commitCountKey(userId, repoName, branch));
    await deleteCachePattern(`gitbruv:tree:${userId}:${repoName}:${branch}:*`);
    await deleteCachePattern(`gitbruv:file:${userId}:${repoName}:${branch}:*`);
    await deleteCache(repoCache.refKey(userId, repoName, branch));
    await deleteCache(repoCache.branchesKey(userId, repoName));

  },
};
