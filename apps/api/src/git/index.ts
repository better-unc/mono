import git from "isomorphic-git";
import { createS3Fs, type S3Fs } from "./s3-fs";
import { getRepoPrefix } from "../s3";

export interface CommitAuthor {
  name: string;
  email: string;
  username?: string;
  userId?: string;
  avatarUrl?: string | null;
}

export interface CommitInfo {
  oid: string;
  message: string;
  author: CommitAuthor;
  timestamp: number;
}

export interface TreeEntry {
  name: string;
  path: string;
  oid: string;
  type: string;
}

export interface FileDiff {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface CommitDiff {
  commit: CommitInfo;
  parent: string | null;
  files: FileDiff[];
  stats: {
    additions: number;
    deletions: number;
    filesChanged: number;
  };
}

export function createGitStore(ownerId: string, repoName: string): { fs: S3Fs; dir: string } {
  const prefix = getRepoPrefix(ownerId, repoName);
  const fs = createS3Fs(prefix);
  return { fs, dir: "/" };
}

export async function listBranches(fs: S3Fs, dir: string): Promise<string[]> {
  try {
    const branches = await git.listBranches({ fs, dir });
    if (branches.length > 0) {
      console.log(`[Git] listBranches found ${branches.length} branches:`, branches);
      return branches;
    }
  } catch (error) {
    console.error(`[Git] listBranches error:`, error);
  }

  try {
    const refsDir = "refs/heads";
    const entries = await fs.promises.readdir(refsDir);
    const branches: string[] = [];
    
    for (const entry of entries) {
      try {
        const refPath = `${refsDir}/${entry}`;
        const refContent = await fs.promises.readFile(refPath, "utf8");
        console.log(`[Git] listBranches: found ref ${refPath} -> ${refContent.trim()}`);
        branches.push(entry);
      } catch (error) {
        console.error(`[Git] listBranches: failed to read ${refPath}:`, error);
        continue;
      }
    }
    
    console.log(`[Git] listBranches (manual) found ${branches.length} branches:`, branches);
    return branches;
  } catch (error) {
    console.error(`[Git] listBranches (manual) error:`, error);
    return [];
  }
}

function normalizeRef(ref: string): string {
  if (ref.startsWith("refs/")) {
    return ref;
  }
  if (ref === "HEAD") {
    return "HEAD";
  }
  return `refs/heads/${ref}`;
}

export async function refExists(fs: S3Fs, dir: string, ref: string): Promise<boolean> {
  try {
    const normalizedRef = normalizeRef(ref);
    const resolved = await git.resolveRef({ fs, dir, ref: normalizedRef });
    console.log(`[Git] refExists: ${ref} (${normalizedRef}) -> ${resolved}`);
    return true;
  } catch (error) {
    console.error(`[Git] refExists: ${ref} failed:`, error instanceof Error ? error.message : error);
    try {
      const refPath = normalizeRef(ref);
      const content = await fs.promises.readFile(refPath, "utf8");
      console.log(`[Git] refExists: manually read ${refPath} -> ${content.trim()}`);
      return content.trim().length === 40;
    } catch (readError) {
      console.error(`[Git] refExists: failed to read ref file:`, readError);
      return false;
    }
  }
}

export async function getCommits(
  fs: S3Fs,
  dir: string,
  ref: string,
  limit: number,
  skip: number
): Promise<{ commits: CommitInfo[]; hasMore: boolean }> {
  try {
    const normalizedRef = normalizeRef(ref);
    const exists = await refExists(fs, dir, ref);
    if (!exists) {
      console.log(`[Git] getCommits: ref ${ref} (${normalizedRef}) does not exist`);
      return { commits: [], hasMore: false };
    }

    console.log(`[Git] getCommits: reading log for ref ${ref} (${normalizedRef})`);
    
    let commitOid: string;
    try {
      commitOid = await git.resolveRef({ fs, dir, ref: normalizedRef });
    } catch (error) {
      console.error(`[Git] getCommits: resolveRef failed, trying manual read:`, error);
      try {
        const refContent = await fs.promises.readFile(normalizedRef, "utf8");
        commitOid = refContent.trim();
        console.log(`[Git] getCommits: manually read ref -> ${commitOid}`);
      } catch (readError) {
        console.error(`[Git] getCommits: failed to read ref manually:`, readError);
        return { commits: [], hasMore: false };
      }
    }

    const commits: CommitInfo[] = [];
    let count = 0;
    let skipped = 0;

    const logs = await git.log({ fs, dir, ref: commitOid, depth: limit + skip + 1 });
    console.log(`[Git] getCommits: found ${logs.length} commits`);

    for (const entry of logs) {
      if (skipped < skip) {
        skipped++;
        continue;
      }

      if (count >= limit) {
        return { commits, hasMore: true };
      }

      const commit = entry.commit;
      commits.push({
        oid: entry.oid,
        message: commit.message,
        author: {
          name: commit.author.name,
          email: commit.author.email,
        },
        timestamp: commit.author.timestamp * 1000,
      });
      count++;
    }

    return { commits, hasMore: false };
  } catch (error) {
    console.error("[Git] getCommits error:", error);
    return { commits: [], hasMore: false };
  }
}

export async function getCommitCount(fs: S3Fs, dir: string, ref: string): Promise<number> {
  try {
    const normalizedRef = normalizeRef(ref);
    const exists = await refExists(fs, dir, ref);
    if (!exists) {
      return 0;
    }

    const logs = await git.log({ fs, dir, ref: normalizedRef });
    return logs.length;
  } catch (error) {
    console.error("[Git] getCommitCount error:", error);
    return 0;
  }
}

export async function getTree(
  fs: S3Fs,
  dir: string,
  ref: string,
  filepath: string
): Promise<TreeEntry[] | null> {
  try {
    const normalizedRef = normalizeRef(ref);
    const exists = await refExists(fs, dir, ref);
    if (!exists) {
      return null;
    }

    const commitOid = await git.resolveRef({ fs, dir, ref: normalizedRef });
    const { commit } = await git.readCommit({ fs, dir, oid: commitOid });

    let treeOid = commit.tree;

    if (filepath && filepath !== "") {
      const parts = filepath.split("/").filter(Boolean);
      for (const part of parts) {
        const tree = await git.readTree({ fs, dir, oid: treeOid });
        const entry = tree.tree.find((e) => e.path === part);
        if (!entry || entry.type !== "tree") {
          return null;
        }
        treeOid = entry.oid;
      }
    }

    const tree = await git.readTree({ fs, dir, oid: treeOid });

    const entries: TreeEntry[] = tree.tree.map((entry) => ({
      name: entry.path,
      path: filepath ? `${filepath}/${entry.path}` : entry.path,
      oid: entry.oid,
      type: entry.type === "blob" ? "blob" : "tree",
    }));

    entries.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "tree" ? -1 : 1;
    });

    return entries;
  } catch (error) {
    console.error("[Git] getTree error:", error);
    return null;
  }
}

export async function getFile(
  fs: S3Fs,
  dir: string,
  ref: string,
  filepath: string
): Promise<{ content: string; oid: string } | null> {
  try {
    const normalizedRef = normalizeRef(ref);
    const exists = await refExists(fs, dir, ref);
    if (!exists) {
      return null;
    }

    const commitOid = await git.resolveRef({ fs, dir, ref: normalizedRef });
    const { commit } = await git.readCommit({ fs, dir, oid: commitOid });

    const parts = filepath.split("/").filter(Boolean);
    let treeOid = commit.tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const tree = await git.readTree({ fs, dir, oid: treeOid });
      const entry = tree.tree.find((e) => e.path === parts[i]);
      if (!entry || entry.type !== "tree") {
        return null;
      }
      treeOid = entry.oid;
    }

    const tree = await git.readTree({ fs, dir, oid: treeOid });
    const filename = parts[parts.length - 1];
    const fileEntry = tree.tree.find((e) => e.path === filename && e.type === "blob");

    if (!fileEntry) {
      return null;
    }

    const { blob } = await git.readBlob({ fs, dir, oid: fileEntry.oid });
    const content = new TextDecoder().decode(blob);

    return { content, oid: fileEntry.oid };
  } catch (error) {
    console.error("[Git] getFile error:", error);
    return null;
  }
}

export async function getBlobByOid(
  fs: S3Fs,
  dir: string,
  oid: string
): Promise<string | null> {
  try {
    const { blob } = await git.readBlob({ fs, dir, oid });
    return new TextDecoder().decode(blob);
  } catch {
    return null;
  }
}

export async function getCommitByOid(
  fs: S3Fs,
  dir: string,
  oid: string
): Promise<{ commit: CommitInfo; parent: string | null } | null> {
  try {
    const { commit } = await git.readCommit({ fs, dir, oid });
    return {
      commit: {
        oid,
        message: commit.message,
        author: {
          name: commit.author.name,
          email: commit.author.email,
        },
        timestamp: commit.author.timestamp * 1000,
      },
      parent: commit.parent.length > 0 ? commit.parent[0] : null,
    };
  } catch {
    return null;
  }
}

export async function getCommitDiff(
  fs: S3Fs,
  dir: string,
  oid: string
): Promise<CommitDiff | null> {
  try {
    const { commit } = await git.readCommit({ fs, dir, oid });
    const parentOid = commit.parent.length > 0 ? commit.parent[0] : null;

    const commitInfo: CommitInfo = {
      oid,
      message: commit.message,
      author: {
        name: commit.author.name,
        email: commit.author.email,
      },
      timestamp: commit.author.timestamp * 1000,
    };

    const files: FileDiff[] = [];
    let additions = 0;
    let deletions = 0;

    if (parentOid) {
      const changes = await git.walk({
        fs,
        dir,
        trees: [git.TREE({ ref: parentOid }), git.TREE({ ref: oid })],
        map: async (filepath, [A, B]) => {
          if (filepath === ".") return null;

          const aOid = A ? await A.oid() : null;
          const bOid = B ? await B.oid() : null;

          if (aOid === bOid) return null;

          const aType = A ? await A.type() : null;
          const bType = B ? await B.type() : null;

          if (aType === "tree" || bType === "tree") return null;

          let status: string;
          if (!aOid) {
            status = "added";
          } else if (!bOid) {
            status = "deleted";
          } else {
            status = "modified";
          }

          return { path: filepath, status, aOid, bOid };
        },
      });

      for (const change of changes.filter(Boolean)) {
        files.push({
          path: change.path,
          status: change.status,
          additions: 0,
          deletions: 0,
        });
      }
    }

    return {
      commit: commitInfo,
      parent: parentOid,
      files,
      stats: {
        additions,
        deletions,
        filesChanged: files.length,
      },
    };
  } catch {
    return null;
  }
}

export async function getRefsAdvertisement(
  fs: S3Fs,
  dir: string,
  service: string
): Promise<Buffer> {
  try {
    const refs: string[] = [];
    const capabilities =
      service === "git-upload-pack"
        ? "multi_ack thin-pack side-band side-band-64k ofs-delta shallow deepen-since deepen-not deepen-relative no-progress include-tag multi_ack_detailed symref=HEAD:refs/heads/main agent=gitbruv/1.0"
        : "report-status report-status-v2 delete-refs quiet atomic ofs-delta push-options object-format=sha1 agent=gitbruv/1.0";

    const branches = await git.listBranches({ fs, dir });
    let headOid: string | null = null;

    try {
      headOid = await git.resolveRef({ fs, dir, ref: "HEAD" });
    } catch {
      headOid = null;
    }

    let first = true;
    for (const branch of branches) {
      try {
        const normalizedBranch = normalizeRef(branch);
        const oid = await git.resolveRef({ fs, dir, ref: normalizedBranch });
        const refName = `refs/heads/${branch}`;

        if (first) {
          refs.push(`${oid} ${refName}\0${capabilities}\n`);
          first = false;
        } else {
          refs.push(`${oid} ${refName}\n`);
        }
      } catch {
        continue;
      }
    }

    if (refs.length === 0 && headOid) {
      refs.push(`${headOid} refs/heads/main\0${capabilities}\n`);
    }

    if (refs.length === 0) {
      const zeroOid = "0".repeat(40);
      refs.push(`${zeroOid} capabilities^{}\0${capabilities}\n`);
    }

    const lines: Buffer[] = [];
    for (const line of refs) {
      const len = line.length + 4;
      const lenHex = len.toString(16).padStart(4, "0");
      lines.push(Buffer.from(lenHex + line));
    }
    lines.push(Buffer.from("0000"));

    return Buffer.concat(lines);
  } catch {
    const zeroOid = "0".repeat(40);
    const capabilities = "agent=gitbruv/1.0";
    const line = `${zeroOid} capabilities^{}\0${capabilities}\n`;
    const len = line.length + 4;
    const lenHex = len.toString(16).padStart(4, "0");
    return Buffer.from(lenHex + line + "0000");
  }
}
