import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

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

export interface S3Config {
  client: S3Client;
  bucket: string;
}

export function createS3Client(endpoint: string, accessKeyId: string, secretAccessKey: string): S3Client {
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function createR2Fs(config: S3Config, repoPrefix: string) {
  const { client, bucket } = config;
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

  const cachedS3Get = async (key: string): Promise<ArrayBuffer | null> => {
    if (fileCache.has(key)) {
      const cached = fileCache.get(key);
      return cached === NOT_FOUND ? null : cached!;
    }
    try {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!response.Body) {
        fileCache.set(key, NOT_FOUND);
        return null;
      }
      const data = await response.Body.transformToByteArray();
      const arrayBuffer = new ArrayBuffer(data.byteLength);
      new Uint8Array(arrayBuffer).set(data);
      fileCache.set(key, arrayBuffer);
      return arrayBuffer;
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error.name === "NoSuchKey") {
        fileCache.set(key, NOT_FOUND);
        return null;
      }
      throw err;
    }
  };

  const cachedS3List = async (prefix: string): Promise<string[]> => {
    if (listCache.has(prefix)) {
      return listCache.get(prefix)!;
    }
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      for (const obj of response.Contents || []) {
        if (obj.Key) {
          keys.push(obj.Key);
        }
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
    listCache.set(prefix, keys);
    return keys;
  };

  const readFile = async (filepath: string, options?: { encoding?: string }): Promise<Uint8Array | string> => {
    const key = getKey(filepath);
    const data = await cachedS3Get(key);
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
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes }));
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(arrayBuffer).set(bytes);
    fileCache.set(key, arrayBuffer);
  };

  const unlink = async (filepath: string): Promise<void> => {
    const key = getKey(filepath);
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    fileCache.set(key, NOT_FOUND);
  };

  const readdir = async (filepath: string): Promise<string[]> => {
    const prefix = getKey(filepath);
    const fullPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const keys = await cachedS3List(fullPrefix);

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
      const keys = await cachedS3List(fullPrefix);
      if (keys.length > 0) {
        const batches: string[][] = [];
        for (let i = 0; i < keys.length; i += 1000) {
          batches.push(keys.slice(i, i + 1000));
        }
        for (const batch of batches) {
          await client.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: { Objects: batch.map((key) => ({ Key: key })) },
            })
          );
        }
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

    const data = await cachedS3Get(key);
    if (data) {
      return createStatResult("file", data.byteLength);
    }

    const prefix = key.endsWith("/") ? key : `${key}/`;
    const children = await cachedS3List(prefix);
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

export async function s3DeletePrefix(config: S3Config, prefix: string): Promise<void> {
  const { client, bucket } = config;
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of response.Contents || []) {
      if (obj.Key) {
        keys.push(obj.Key);
      }
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  if (keys.length > 0) {
    const batches: string[][] = [];
    for (let i = 0; i < keys.length; i += 1000) {
      batches.push(keys.slice(i, i + 1000));
    }
    for (const batch of batches) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((key) => ({ Key: key })) },
        })
      );
    }
  }
}
