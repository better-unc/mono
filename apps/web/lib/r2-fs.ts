import { r2Get, r2Put, r2Delete, r2List, r2DeletePrefix, r2GetBatch, r2Head } from "./r2";
import { getCachedObject, setCachedObject, getCachedList, setCachedList } from "./git-cache";

const NOT_FOUND = Symbol("NOT_FOUND");

function normalizePath(path: string): string {
  return path.replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "");
}

function createStatResult(type: "file" | "dir", size: number) {
  const now = Date.now();
  return {
    type,
    mode: type === "dir" ? 0o40755 : 0o100644,
    size,
    ino: 0,
    mtimeMs: now,
    ctimeMs: now,
    uid: 1000,
    gid: 1000,
    dev: 0,
    isFile: () => type === "file",
    isDirectory: () => type === "dir",
    isSymbolicLink: () => false,
  };
}

export function createR2Fs(repoPrefix: string, options?: { prefetch?: boolean }) {
  const dirMarkerCache = new Set<string>();
  const fileCache = new Map<string, Buffer | typeof NOT_FOUND>();
  const listCache = new Map<string, string[]>();
  const existsCache = new Map<string, boolean>();
  const sizeCache = new Map<string, number>();
  let allKeysCache: string[] | null = null;
  let prefetchPromise: Promise<void> | null = null;

  const getKey = (filepath: string) => {
    const normalized = normalizePath(filepath);
    if (normalized.startsWith(repoPrefix)) {
      return normalized;
    }
    if (!normalized) {
      return repoPrefix;
    }
    return `${repoPrefix}/${normalized}`.replace(/\/+/g, "/");
  };

  const prefetchAllKeys = async () => {
    if (allKeysCache !== null) return;
    if (prefetchPromise) {
      await prefetchPromise;
      return;
    }
    
    prefetchPromise = (async () => {
      const keys = await r2List(repoPrefix + "/");
      allKeysCache = keys;
      for (const key of keys) {
        existsCache.set(key, true);
      }
    })();
    
    await prefetchPromise;
  };

  if (options?.prefetch !== false) {
    prefetchAllKeys();
  }

  const keyExists = async (key: string): Promise<boolean> => {
    if (existsCache.has(key)) {
      return existsCache.get(key)!;
    }
    
    if (fileCache.has(key)) {
      return fileCache.get(key) !== NOT_FOUND;
    }
    
    if (allKeysCache !== null) {
      const exists = allKeysCache.includes(key);
      existsCache.set(key, exists);
      return exists;
    }
    
    const result = await r2Head(key);
    existsCache.set(key, result.exists);
    if (result.size !== undefined) {
      sizeCache.set(key, result.size);
    }
    return result.exists;
  };

  const cachedR2Get = async (key: string): Promise<Buffer | null> => {
    if (fileCache.has(key)) {
      const cached = fileCache.get(key);
      return cached === NOT_FOUND ? null : cached!;
    }
    
    const globalCached = getCachedObject(key);
    if (globalCached) {
      fileCache.set(key, globalCached);
      existsCache.set(key, true);
      sizeCache.set(key, globalCached.length);
      return globalCached;
    }
    
    const exists = existsCache.get(key);
    if (exists === false) {
      fileCache.set(key, NOT_FOUND);
      return null;
    }
    
    const data = await r2Get(key);
    fileCache.set(key, data ?? NOT_FOUND);
    existsCache.set(key, data !== null);
    if (data) {
      sizeCache.set(key, data.length);
      setCachedObject(key, data);
    }
    return data;
  };

  const batchGet = async (keys: string[]): Promise<void> => {
    const uncachedKeys = keys.filter((key) => {
      if (fileCache.has(key)) return false;
      const globalCached = getCachedObject(key);
      if (globalCached) {
        fileCache.set(key, globalCached);
        existsCache.set(key, true);
        sizeCache.set(key, globalCached.length);
        return false;
      }
      return true;
    });
    if (uncachedKeys.length === 0) return;
    
    const results = await r2GetBatch(uncachedKeys);
    for (const [key, data] of results) {
      fileCache.set(key, data ?? NOT_FOUND);
      existsCache.set(key, data !== null);
      if (data) {
        sizeCache.set(key, data.length);
        setCachedObject(key, data);
      }
    }
  };

  const cachedR2List = async (prefix: string): Promise<string[]> => {
    if (listCache.has(prefix)) {
      return listCache.get(prefix)!;
    }
    
    const globalCached = getCachedList(prefix);
    if (globalCached) {
      listCache.set(prefix, globalCached);
      for (const key of globalCached) {
        existsCache.set(key, true);
      }
      return globalCached;
    }
    
    if (allKeysCache !== null) {
      const keys = allKeysCache.filter((k) => k.startsWith(prefix));
      listCache.set(prefix, keys);
      return keys;
    }
    
    const keys = await r2List(prefix);
    listCache.set(prefix, keys);
    setCachedList(prefix, keys);
    for (const key of keys) {
      existsCache.set(key, true);
    }
    return keys;
  };

  const readFile = async (filepath: string, options?: { encoding?: string }): Promise<Buffer | string> => {
    const key = getKey(filepath);
    const data = await cachedR2Get(key);
    if (!data) {
      const err = new Error(`ENOENT: no such file or directory, open '${filepath}'`) as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    }
    if (options?.encoding === "utf8" || options?.encoding === "utf-8") {
      return data.toString("utf-8");
    }
    return data;
  };

  const writeFile = async (filepath: string, data: Buffer | string): Promise<void> => {
    const key = getKey(filepath);
    const buffer = typeof data === "string" ? Buffer.from(data) : data;
    await r2Put(key, buffer);
    fileCache.set(key, buffer);
    existsCache.set(key, true);
    sizeCache.set(key, buffer.length);
    if (allKeysCache !== null && !allKeysCache.includes(key)) {
      allKeysCache.push(key);
    }
  };

  const unlink = async (filepath: string): Promise<void> => {
    const key = getKey(filepath);
    await r2Delete(key);
    fileCache.set(key, NOT_FOUND);
    existsCache.set(key, false);
    if (allKeysCache !== null) {
      const idx = allKeysCache.indexOf(key);
      if (idx !== -1) allKeysCache.splice(idx, 1);
    }
  };

  const readdir = async (filepath: string): Promise<string[]> => {
    const prefix = getKey(filepath);
    const fullPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const keys = await cachedR2List(fullPrefix);

    const entries = new Set<string>();
    for (const key of keys) {
      const relative = key.slice(fullPrefix.length);
      if (!relative) continue;
      const firstPart = relative.split("/")[0];
      if (firstPart) entries.add(firstPart);
    }

    return Array.from(entries);
  };

  const mkdir = async (filepath: string): Promise<void> => {
    const key = getKey(filepath);
    dirMarkerCache.add(key);
  };

  const rmdir = async (filepath: string, options?: { recursive?: boolean }): Promise<void> => {
    if (options?.recursive) {
      const prefix = getKey(filepath);
      await r2DeletePrefix(prefix.endsWith("/") ? prefix : `${prefix}/`);
    }
    const key = getKey(filepath);
    dirMarkerCache.delete(key);
  };

  const stat = async (filepath: string) => {
    const key = getKey(filepath);

    if (dirMarkerCache.has(key)) {
      return createStatResult("dir", 0);
    }

    if (sizeCache.has(key) && existsCache.get(key)) {
      return createStatResult("file", sizeCache.get(key)!);
    }

    const exists = await keyExists(key);
    if (exists) {
      if (sizeCache.has(key)) {
        return createStatResult("file", sizeCache.get(key)!);
      }
      const data = await cachedR2Get(key);
      if (data) {
        return createStatResult("file", data.length);
      }
    }

    const prefix = key.endsWith("/") ? key : `${key}/`;
    const children = await cachedR2List(prefix);
    if (children.length > 0) {
      return createStatResult("dir", 0);
    }

    const err = new Error(`ENOENT: no such file or directory, stat '${filepath}'`) as NodeJS.ErrnoException;
    err.code = "ENOENT";
    throw err;
  };

  const lstat = stat;

  const readlink = async (filepath: string): Promise<string> => {
    const err = new Error(`ENOENT: no such file or directory, readlink '${filepath}'`) as NodeJS.ErrnoException;
    err.code = "ENOENT";
    throw err;
  };

  const symlink = async (): Promise<void> => {};

  return {
    promises: {
      readFile,
      writeFile,
      unlink,
      readdir,
      mkdir,
      rmdir,
      stat,
      lstat,
      readlink,
      symlink,
    },
    readFile,
    writeFile,
    unlink,
    readdir,
    mkdir,
    rmdir,
    stat,
    lstat,
    readlink,
    symlink,
    batchGet,
    getKey,
    prefetchAllKeys,
  };
}

export function getRepoPrefix(userId: string, repoName: string): string {
  return `repos/${userId}/${repoName}`;
}

export type R2Fs = ReturnType<typeof createR2Fs>;
