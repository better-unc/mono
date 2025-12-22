/// <reference types="@cloudflare/workers-types" />

const NOT_FOUND = Symbol("NOT_FOUND");

interface ErrnoException extends Error {
  code?: string;
}

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

export function getRepoPrefix(userId: string, repoName: string): string {
  return `repos/${userId}/${repoName}`;
}

export function createR2Fs(bucket: R2Bucket, repoPrefix: string) {
  const dirMarkerCache = new Set<string>();
  const fileCache = new Map<string, ArrayBuffer | typeof NOT_FOUND>();
  const listCache = new Map<string, string[]>();

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

  const cachedR2Get = async (key: string): Promise<ArrayBuffer | null> => {
    if (fileCache.has(key)) {
      const cached = fileCache.get(key);
      return cached === NOT_FOUND ? null : cached!;
    }
    const obj = await bucket.get(key);
    if (!obj) {
      fileCache.set(key, NOT_FOUND);
      return null;
    }
    const data = await obj.arrayBuffer();
    fileCache.set(key, data);
    return data;
  };

  const cachedR2List = async (prefix: string): Promise<string[]> => {
    if (listCache.has(prefix)) {
      return listCache.get(prefix)!;
    }
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const result = await bucket.list({ prefix, cursor });
      for (const obj of result.objects) {
        keys.push(obj.key);
      }
      cursor = result.truncated ? result.cursor : undefined;
    } while (cursor);
    listCache.set(prefix, keys);
    return keys;
  };

  const readFile = async (filepath: string, options?: { encoding?: string }): Promise<Uint8Array | string> => {
    const key = getKey(filepath);
    const data = await cachedR2Get(key);
    if (!data) {
      const err = new Error(`ENOENT: no such file or directory, open '${filepath}'`) as ErrnoException;
      err.code = "ENOENT";
      throw err;
    }
    const bytes = new Uint8Array(data);
    if (options?.encoding === "utf8" || options?.encoding === "utf-8") {
      return new TextDecoder().decode(bytes);
    }
    return bytes;
  };

  const writeFile = async (filepath: string, data: Uint8Array | string): Promise<void> => {
    const key = getKey(filepath);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    await bucket.put(key, bytes);
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(arrayBuffer).set(bytes);
    fileCache.set(key, arrayBuffer);
  };

  const unlink = async (filepath: string): Promise<void> => {
    const key = getKey(filepath);
    await bucket.delete(key);
    fileCache.set(key, NOT_FOUND);
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
      const fullPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
      const keys = await cachedR2List(fullPrefix);
      for (const key of keys) {
        await bucket.delete(key);
      }
    }
    const key = getKey(filepath);
    dirMarkerCache.delete(key);
  };

  const stat = async (filepath: string) => {
    const key = getKey(filepath);

    if (dirMarkerCache.has(key)) {
      return createStatResult("dir", 0);
    }

    const data = await cachedR2Get(key);
    if (data) {
      return createStatResult("file", data.byteLength);
    }

    const prefix = key.endsWith("/") ? key : `${key}/`;
    const children = await cachedR2List(prefix);
    if (children.length > 0) {
      return createStatResult("dir", 0);
    }

    const err = new Error(`ENOENT: no such file or directory, stat '${filepath}'`) as ErrnoException;
    err.code = "ENOENT";
    throw err;
  };

  const lstat = stat;

  const readlink = async (filepath: string): Promise<string> => {
    const err = new Error(`ENOENT: no such file or directory, readlink '${filepath}'`) as ErrnoException;
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
  };
}

export type R2Fs = ReturnType<typeof createR2Fs>;
