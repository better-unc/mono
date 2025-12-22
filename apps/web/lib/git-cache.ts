type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;
  private defaultTtl: number;

  constructor(maxSize: number = 1000, defaultTtlMs: number = 60000) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtlMs;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtl),
    });
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  deletePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (typeof key === "string" && key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

const objectCache = new LRUCache<string, Buffer>(5000, 300000);
const refCache = new LRUCache<string, string>(500, 30000);
const listCache = new LRUCache<string, string[]>(200, 30000);

export function getCachedObject(key: string): Buffer | undefined {
  return objectCache.get(key);
}

export function setCachedObject(key: string, data: Buffer): void {
  objectCache.set(key, data);
}

export function getCachedRef(key: string): string | undefined {
  return refCache.get(key);
}

export function setCachedRef(key: string, oid: string): void {
  refCache.set(key, oid);
}

export function getCachedList(prefix: string): string[] | undefined {
  return listCache.get(prefix);
}

export function setCachedList(prefix: string, keys: string[]): void {
  listCache.set(prefix, keys);
}

export function invalidateRepoCache(repoPrefix: string): void {
  objectCache.deletePrefix(repoPrefix);
  refCache.deletePrefix(repoPrefix);
  listCache.deletePrefix(repoPrefix);
}

