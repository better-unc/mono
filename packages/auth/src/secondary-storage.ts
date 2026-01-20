import type { SecondaryStorage } from 'better-auth';
import { Redis } from '@upstash/redis';

export function secondaryStorage(): SecondaryStorage | undefined {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return undefined;
  }

  const client = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  return {
    get: async (key) => {
      const value = (await client.get<string | null>(key)) ?? null;

      if (typeof value === 'string') {
        return value;
      }

      return value ? JSON.stringify(value) : null;
    },
    set: async (key, value, ttl) => {
      if (ttl) {
        await client.set(key, value, { ex: ttl });
      } else {
        await client.set(key, value);
      }
    },
    delete: async (key) => {
      await client.del(key);
    },
  };
}