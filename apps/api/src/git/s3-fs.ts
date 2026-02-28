import { getObject, putObject, deleteObject, listObjects, objectExists } from "../s3";

export interface S3FsStats {
  type: "file" | "dir";
  mode: number;
  size: number;
  ino: number;
  mtimeMs: number;
  ctimeMs: number;
  uid: number;
  gid: number;
  dev: number;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

export function createS3Fs(basePath: string) {
  const normalize = (filepath: string): string => {
    let path = filepath.startsWith("/") ? filepath.slice(1) : filepath;
    if (path === ".git" || path === ".git/") {
      return basePath;
    }
    if (path.startsWith(".git/")) {
      path = path.slice(5);
    }
    if (!path || path === "/") {
      return basePath;
    }
    return `${basePath}/${path}`.replace(/\/+/g, "/").replace(/\/$/, "");
  };

  const fs = {
    promises: {
      async readFile(
        filepath: string,
        options?: { encoding?: string } | string
      ): Promise<Buffer | string> {
        const key = normalize(filepath);
        const data = await getObject(key);
        if (!data) {
          const err = new Error(`ENOENT: no such file or directory, open '${filepath}'`) as NodeJS.ErrnoException;
          err.code = "ENOENT";
          throw err;
        }

        const encoding = typeof options === "string" ? options : options?.encoding;
        if (encoding === "utf8" || encoding === "utf-8") {
          return data.toString("utf8");
        }
        return data;
      },

      async writeFile(filepath: string, data: Buffer | Uint8Array | string): Promise<void> {
        const key = normalize(filepath);
        await putObject(key, data instanceof Buffer ? data : Buffer.from(data));
      },

      async unlink(filepath: string): Promise<void> {
        const key = normalize(filepath);
        await deleteObject(key);
      },

      async readdir(filepath: string): Promise<string[]> {
        const prefix = normalize(filepath);
        const searchPrefix = prefix.endsWith("/") ? prefix : prefix + "/";
        const keys = await listObjects(searchPrefix);

        const entries = new Set<string>();
        for (const key of keys) {
          const relative = key.slice(searchPrefix.length);
          if (relative) {
            const firstPart = relative.split("/")[0];
            if (firstPart) {
              entries.add(firstPart);
            }
          }
        }

        return Array.from(entries);
      },

      async mkdir(_filepath: string, _options?: { recursive?: boolean }): Promise<void> {
        return;
      },

      async rmdir(filepath: string): Promise<void> {
        const prefix = normalize(filepath);
        const keys = await listObjects(prefix + "/");
        for (const key of keys) {
          await deleteObject(key);
        }
      },

      async stat(filepath: string): Promise<S3FsStats> {
        const key = normalize(filepath);

        if (key === basePath) {
          return {
            type: "dir",
            mode: 0o040755,
            size: 0,
            ino: 0,
            mtimeMs: Date.now(),
            ctimeMs: Date.now(),
            uid: 1000,
            gid: 1000,
            dev: 0,
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          };
        }

        const exists = await objectExists(key);
        if (exists) {
          const data = await getObject(key);
          return {
            type: "file",
            mode: 0o100644,
            size: data?.length || 0,
            ino: 0,
            mtimeMs: Date.now(),
            ctimeMs: Date.now(),
            uid: 1000,
            gid: 1000,
            dev: 0,
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          };
        }

        const dirPrefix = key + "/";
        const keys = await listObjects(dirPrefix);
        if (keys.length > 0) {
          return {
            type: "dir",
            mode: 0o040755,
            size: 0,
            ino: 0,
            mtimeMs: Date.now(),
            ctimeMs: Date.now(),
            uid: 1000,
            gid: 1000,
            dev: 0,
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
          };
        }

        const err = new Error(`ENOENT: no such file or directory, stat '${filepath}'`) as NodeJS.ErrnoException;
        err.code = "ENOENT";
        throw err;
      },

      async lstat(filepath: string): Promise<S3FsStats> {
        return this.stat(filepath);
      },

      async readlink(filepath: string): Promise<string> {
        const data = await this.readFile(filepath, "utf8");
        return data as string;
      },

      async symlink(target: string, filepath: string): Promise<void> {
        await this.writeFile(filepath, target);
      },

      async chmod(_filepath: string, _mode: number): Promise<void> {
        return;
      },

      async rename(oldPath: string, newPath: string): Promise<void> {
        const data = await this.readFile(oldPath);
        await this.writeFile(newPath, data as Buffer);
        await this.unlink(oldPath);
      },
    },
  };

  return fs;
}

export type S3Fs = ReturnType<typeof createS3Fs>;
