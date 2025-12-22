import { r2Get, r2Put, r2List, r2Delete } from "./r2";
import { getRepoPrefix } from "./r2-fs";
import fs from "fs/promises";
import path from "path";
import os from "os";

export async function syncR2ToLocal(userId: string, repoName: string): Promise<string> {
  const repoPrefix = getRepoPrefix(userId, `${repoName}.git`);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gitbruv-"));

  const keys = await r2List(repoPrefix);

  for (const key of keys) {
    const relativePath = key.slice(repoPrefix.length + 1);
    if (!relativePath) continue;

    const localPath = path.join(tempDir, relativePath);
    const localDir = path.dirname(localPath);

    await fs.mkdir(localDir, { recursive: true });

    const data = await r2Get(key);
    if (data) {
      await fs.writeFile(localPath, data);
    }
  }

  await fs.mkdir(path.join(tempDir, "objects"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "objects/info"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "objects/pack"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "refs"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "refs/heads"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "refs/tags"), { recursive: true });

  const headPath = path.join(tempDir, "HEAD");
  try {
    await fs.access(headPath);
  } catch {
    await fs.writeFile(headPath, "ref: refs/heads/main\n");
  }

  const configPath = path.join(tempDir, "config");
  try {
    await fs.access(configPath);
  } catch {
    await fs.writeFile(
      configPath,
      `[core]
\trepositoryformatversion = 0
\tfilemode = true
\tbare = true
`
    );
  }

  return tempDir;
}

export async function syncLocalToR2(localDir: string, userId: string, repoName: string): Promise<void> {
  const repoPrefix = getRepoPrefix(userId, `${repoName}.git`);

  const existingKeys = await r2List(repoPrefix);
  const existingSet = new Set(existingKeys);
  const newKeys = new Set<string>();

  async function uploadDir(dirPath: string, r2Prefix: string) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const localPath = path.join(dirPath, entry.name);
      const r2Key = `${r2Prefix}/${entry.name}`;

      if (entry.isDirectory()) {
        await uploadDir(localPath, r2Key);
      } else if (entry.isFile()) {
        const data = await fs.readFile(localPath);
        await r2Put(r2Key, data);
        newKeys.add(r2Key);
      }
    }
  }

  await uploadDir(localDir, repoPrefix);

  for (const key of existingSet) {
    if (!newKeys.has(key)) {
      await r2Delete(key);
    }
  }
}

export async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {}
}

export async function withTempRepo<T>(userId: string, repoName: string, operation: (tempDir: string) => Promise<T>, syncBack: boolean = false): Promise<T> {
  const tempDir = await syncR2ToLocal(userId, repoName);

  try {
    const result = await operation(tempDir);

    if (syncBack) {
      await syncLocalToR2(tempDir, userId, repoName);
    }

    return result;
  } finally {
    await cleanupTempDir(tempDir);
  }
}
