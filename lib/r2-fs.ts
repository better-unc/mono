import { r2Get, r2Put, r2Delete, r2Exists, r2List, r2DeletePrefix } from "./r2";

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

export function createR2Fs(repoPrefix: string) {
  const dirMarkerCache = new Set<string>();

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

  const readFile = async (filepath: string, options?: { encoding?: string }): Promise<Buffer | string> => {
    const key = getKey(filepath);
    const data = await r2Get(key);
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
    console.log("[R2FS] writeFile:", key, "size:", typeof data === "string" ? data.length : data.length);
    await r2Put(key, typeof data === "string" ? Buffer.from(data) : data);
  };

  const unlink = async (filepath: string): Promise<void> => {
    const key = getKey(filepath);
    await r2Delete(key);
  };

  const readdir = async (filepath: string): Promise<string[]> => {
    const prefix = getKey(filepath);
    const fullPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const keys = await r2List(fullPrefix);

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

    const exists = await r2Exists(key);
    if (exists) {
      const data = await r2Get(key);
      return createStatResult("file", data?.length || 0);
    }

    const prefix = key.endsWith("/") ? key : `${key}/`;
    const children = await r2List(prefix);
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
  };
}

export function getRepoPrefix(userId: string, repoName: string): string {
  return `repos/${userId}/${repoName}`;
}
