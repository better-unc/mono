import git from "isomorphic-git";
import { createS3Fs, type S3Fs } from "./s3-fs";
import { getRepoPrefix } from "../s3";
import { getCached, setCache, repoCache, CACHE_TTL } from "../cache";

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
  mode: string;
  path: string;
  oid: string;
  type: "blob" | "tree" | "commit" | string;
}

export interface DiffHunkLine {
  type: "context" | "addition" | "deletion";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffHunkLine[];
}

export interface FileDiff {
  path: string;
  oldPath?: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
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

export interface GitStore {
  fs: S3Fs;
  dir: string;
  ownerId: string;
  repoName: string;
}

export function createGitStore(ownerId: string, repoName: string): GitStore {
  const prefix = getRepoPrefix(ownerId, repoName);
  const fs = createS3Fs(prefix);
  return { fs, dir: "/", ownerId, repoName };
}

export async function listBranches(fs: S3Fs, dir: string): Promise<string[]> {
  try {
    const branches = await git.listBranches({ fs, dir });
    if (branches.length > 0) {
      
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
      const refPath = `${refsDir}/${entry}`;
      try {
        const refContent = await fs.promises.readFile(refPath, "utf8");
        
        branches.push(entry);
      } catch (error) {
        console.error(`[Git] listBranches: failed to read ${refPath}:`, error);
        continue;
      }
    }

    
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
    
    return true;
  } catch (error) {
    console.error(`[Git] refExists: ${ref} failed:`, error instanceof Error ? error.message : error);
    try {
      const refPath = normalizeRef(ref);
      const content = await fs.promises.readFile(refPath, "utf8");
      
      return content.toString().trim().length === 40;
    } catch (readError) {
      console.error(`[Git] refExists: failed to read ref file:`, readError);
      return false;
    }
  }
}

async function objectExists(fs: S3Fs, oid: string): Promise<boolean> {
  try {
    const prefix = oid.substring(0, 2);
    const suffix = oid.substring(2);
    const objectPath = `.git/objects/${prefix}/${suffix}`;
    await fs.promises.stat(objectPath);
    return true;
  } catch (error: any) {
    if (error.code === "ENOENT" || error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    return false;
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
      
      return { commits: [], hasMore: false };
    }

    

    let commitOid: string;
    try {
      commitOid = await git.resolveRef({ fs, dir, ref: normalizedRef });
    } catch (error) {
      console.error(`[Git] getCommits: resolveRef failed, trying manual read:`, error);
      try {
        const refContent = await fs.promises.readFile(normalizedRef, "utf8");
        commitOid = refContent.toString().trim();
        
      } catch (readError) {
        console.error(`[Git] getCommits: failed to read ref manually:`, readError);
        return { commits: [], hasMore: false };
      }
    }

    if (!(await objectExists(fs, commitOid))) {
      console.error(`[Git] getCommits: commit ${commitOid} does not exist`);
      return { commits: [], hasMore: false };
    }

    const commits: CommitInfo[] = [];
    let count = 0;
    let skipped = 0;
    let currentOid: string | null = commitOid;
    let hasMore = false;

    while (currentOid && count < limit + skip) {
      try {
        const { commit } = await git.readCommit({ fs, dir, oid: currentOid });
        
        if (skipped >= skip) {
          if (count < limit) {
            commits.push({
              oid: currentOid,
              message: commit.message,
              author: {
                name: commit.author.name,
                email: commit.author.email,
              },
              timestamp: commit.author.timestamp * 1000,
            });
            count++;
          } else {
            hasMore = true;
            break;
          }
        } else {
          skipped++;
        }

        currentOid = commit.parent.length > 0 ? commit.parent[0] : null;
      } catch (error: any) {
        if (error.code === "NotFoundError" || error.message?.includes("Could not find")) {
          break;
        }
        throw error;
      }
    }

    return { commits, hasMore };
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

    let commitOid: string;
    try {
      commitOid = await git.resolveRef({ fs, dir, ref: normalizedRef });
    } catch (error) {
      try {
        const refContent = await fs.promises.readFile(normalizedRef, "utf8");
        commitOid = refContent.toString().trim();
      } catch {
        return 0;
      }
    }

    if (!(await objectExists(fs, commitOid))) {
      return 0;
    }

    let count = 0;
    let currentOid: string | null = commitOid;

    while (currentOid) {
      try {
        const { commit } = await git.readCommit({ fs, dir, oid: currentOid });
        count++;
        currentOid = commit.parent.length > 0 ? commit.parent[0] : null;
      } catch (error: any) {
        if (error.code === "NotFoundError" || error.message?.includes("Could not find")) {
          break;
        }
        throw error;
      }
    }

    return count;
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

    let commitOid: string;
    try {
      commitOid = await git.resolveRef({ fs, dir, ref: normalizedRef });
    } catch (error) {
      try {
        const refContent = await fs.promises.readFile(normalizedRef, "utf8");
        commitOid = refContent.toString().trim();
      } catch {
        return null;
      }
    }

    if (!(await objectExists(fs, commitOid))) {
      return null;
    }

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
      mode: entry.mode,
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

    let commitOid: string;
    try {
      commitOid = await git.resolveRef({ fs, dir, ref: normalizedRef });
    } catch (error) {
      try {
        const refContent = await fs.promises.readFile(normalizedRef, "utf8");
        commitOid = refContent.toString().trim();
      } catch {
        return null;
      }
    }

    if (!(await objectExists(fs, commitOid))) {
      return null;
    }

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
  } catch (error) {
    console.error(`[Git] getCommitByOid error for ${oid}:`, error);
    return null;
  }
}

interface ChangedFile {
  path: string;
  status: string;
  oldOid: string | null;
  newOid: string | null;
}

async function compareTreesRecursive(
  fs: S3Fs,
  dir: string,
  parentTreeOid: string | null,
  currentTreeOid: string,
  basePath: string
): Promise<ChangedFile[]> {
  const results: ChangedFile[] = [];

  const currentEntries: TreeEntry[] = [];
  const parentEntries: TreeEntry[] = [];

  try {
    const currentTree = await git.readTree({ fs, dir, oid: currentTreeOid });
    for (const entry of currentTree.tree) {
      currentEntries.push(entry as TreeEntry);
    }
  } catch (e) {
    console.error(`[Git] compareTreesRecursive: failed to read current tree ${currentTreeOid}:`, e);
    return results;
  }

  if (parentTreeOid) {
    try {
      const parentTree = await git.readTree({ fs, dir, oid: parentTreeOid });
      for (const entry of parentTree.tree) {
        parentEntries.push(entry as TreeEntry);
      }
    } catch (e) {
      console.error(`[Git] compareTreesRecursive: failed to read parent tree ${parentTreeOid}:`, e);
    }
  }

  const parentMap = new Map<string, TreeEntry>();
  for (const entry of parentEntries) {
    parentMap.set(entry.path, entry);
  }

  const currentMap = new Map<string, TreeEntry>();
  for (const entry of currentEntries) {
    currentMap.set(entry.path, entry);
  }

  for (const entry of currentEntries) {
    const fullPath = basePath ? `${basePath}/${entry.path}` : entry.path;
    const parentEntry = parentMap.get(entry.path);

    if (!parentEntry) {
      if (entry.type === "blob") {
        results.push({ path: fullPath, status: "added", oldOid: null, newOid: entry.oid });
      } else if (entry.type === "tree") {
        const subResults = await compareTreesRecursive(fs, dir, null, entry.oid, fullPath);
        results.push(...subResults);
      }
    } else if (parentEntry.oid !== entry.oid) {
      if (entry.type === "blob" && parentEntry.type === "blob") {
        results.push({ path: fullPath, status: "modified", oldOid: parentEntry.oid, newOid: entry.oid });
      } else if (entry.type === "tree" && parentEntry.type === "tree") {
        const subResults = await compareTreesRecursive(fs, dir, parentEntry.oid, entry.oid, fullPath);
        results.push(...subResults);
      } else {
        results.push({ path: fullPath, status: "modified", oldOid: parentEntry.oid, newOid: entry.oid });
      }
    }
  }

  for (const entry of parentEntries) {
    if (!currentMap.has(entry.path)) {
      const fullPath = basePath ? `${basePath}/${entry.path}` : entry.path;
      if (entry.type === "blob") {
        results.push({ path: fullPath, status: "deleted", oldOid: entry.oid, newOid: null });
      } else if (entry.type === "tree") {
        const subResults = await compareTreesRecursive(fs, dir, entry.oid, entry.oid, fullPath);
        for (const r of subResults) {
          results.push({ path: r.path, status: "deleted", oldOid: r.oldOid, newOid: null });
        }
      }
    }
  }

  return results;
}

async function generateDiffHunks(
  fs: S3Fs,
  dir: string,
  oldOid: string | null,
  newOid: string | null,
  status: string
): Promise<DiffHunk[]> {
  try {
    let oldContent = "";
    let newContent = "";

    if (oldOid) {
      const { blob } = await git.readBlob({ fs, dir, oid: oldOid });
      oldContent = new TextDecoder().decode(blob);
    }

    if (newOid) {
      const { blob } = await git.readBlob({ fs, dir, oid: newOid });
      newContent = new TextDecoder().decode(blob);
    }

    const oldLines = oldContent ? oldContent.split("\n") : [];
    const newLines = newContent ? newContent.split("\n") : [];

    if (status === "added") {
      if (newLines.length === 0) return [];
      return [{
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: newLines.length,
        lines: newLines.map((content, i) => ({
          type: "addition" as const,
          content,
          newLineNumber: i + 1,
        })),
      }];
    }

    if (status === "deleted") {
      if (oldLines.length === 0) return [];
      return [{
        oldStart: 1,
        oldLines: oldLines.length,
        newStart: 0,
        newLines: 0,
        lines: oldLines.map((content, i) => ({
          type: "deletion" as const,
          content,
          oldLineNumber: i + 1,
        })),
      }];
    }

    const hunks: DiffHunk[] = [];
    const diffResult = simpleDiff(oldLines, newLines);

    if (diffResult.length > 0) {
      let currentHunk: DiffHunk | null = null;

      for (const change of diffResult) {
        if (!currentHunk || change.oldLine > (currentHunk.oldStart + currentHunk.oldLines + 3)) {
          if (currentHunk) hunks.push(currentHunk);
          currentHunk = {
            oldStart: Math.max(1, change.oldLine - 3),
            oldLines: 0,
            newStart: Math.max(1, change.newLine - 3),
            newLines: 0,
            lines: [],
          };
        }

        if (change.type === "delete") {
          currentHunk.lines.push({
            type: "deletion",
            content: change.content,
            oldLineNumber: change.oldLine,
          });
          currentHunk.oldLines++;
        } else if (change.type === "insert") {
          currentHunk.lines.push({
            type: "addition",
            content: change.content,
            newLineNumber: change.newLine,
          });
          currentHunk.newLines++;
        }
      }

      if (currentHunk) hunks.push(currentHunk);
    }

    return hunks;
  } catch (e) {
    console.error(`[Git] generateDiffHunks error:`, e);
    return [];
  }
}

interface DiffChange {
  type: "insert" | "delete";
  content: string;
  oldLine: number;
  newLine: number;
}

function simpleDiff(oldLines: string[], newLines: string[]): DiffChange[] {
  const changes: DiffChange[] = [];

  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx >= oldLines.length) {
      changes.push({
        type: "insert",
        content: newLines[newIdx],
        oldLine: oldIdx + 1,
        newLine: newIdx + 1,
      });
      newIdx++;
    } else if (newIdx >= newLines.length) {
      changes.push({
        type: "delete",
        content: oldLines[oldIdx],
        oldLine: oldIdx + 1,
        newLine: newIdx + 1,
      });
      oldIdx++;
    } else if (oldLines[oldIdx] === newLines[newIdx]) {
      oldIdx++;
      newIdx++;
    } else if (!newSet.has(oldLines[oldIdx])) {
      changes.push({
        type: "delete",
        content: oldLines[oldIdx],
        oldLine: oldIdx + 1,
        newLine: newIdx + 1,
      });
      oldIdx++;
    } else if (!oldSet.has(newLines[newIdx])) {
      changes.push({
        type: "insert",
        content: newLines[newIdx],
        oldLine: oldIdx + 1,
        newLine: newIdx + 1,
      });
      newIdx++;
    } else {
      changes.push({
        type: "delete",
        content: oldLines[oldIdx],
        oldLine: oldIdx + 1,
        newLine: newIdx + 1,
      });
      oldIdx++;
    }
  }

  return changes;
}

export async function getCommitDiff(
  fs: S3Fs,
  dir: string,
  oid: string
): Promise<CommitDiff | null> {
  try {
    if (!(await objectExists(fs, oid))) {
      return null;
    }
    
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

    try {
      const currentTree = commit.tree;
      let parentTree: string | null = null;

      if (parentOid && await objectExists(fs, parentOid)) {
        try {
          const parentCommit = await git.readCommit({ fs, dir, oid: parentOid });
          parentTree = parentCommit.commit.tree;
        } catch (error: any) {
          if (error.code === "NotFoundError" || error.message?.includes("Could not find")) {
            parentTree = null;
          } else {
            throw error;
          }
        }
      }

      

      const changedFiles = await compareTreesRecursive(fs, dir, parentTree, currentTree, "");

      for (const file of changedFiles) {
        const hunks = await generateDiffHunks(fs, dir, file.oldOid, file.newOid, file.status);

        let additionCount = 0;
        let deletionCount = 0;
        for (const hunk of hunks) {
          for (const line of hunk.lines) {
            if (line.type === "addition") additionCount++;
            if (line.type === "deletion") deletionCount++;
          }
        }

        additions += additionCount;
        deletions += deletionCount;

        files.push({
          path: file.path,
          status: file.status as "added" | "modified" | "deleted" | "renamed",
          additions: additionCount,
          deletions: deletionCount,
          hunks,
        });
      }

      
    } catch (walkError) {
      console.error(`[Git] getCommitDiff walk error:`, walkError);
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
  } catch (error) {
    console.error(`[Git] getCommitDiff error for ${oid}:`, error);
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

export async function listBranchesCached(store: GitStore): Promise<string[]> {
  const cacheKey = repoCache.branchesKey(store.ownerId, store.repoName);
  const cached = await getCached<string[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const branches = await listBranches(store.fs, store.dir);
  await setCache(cacheKey, branches, CACHE_TTL.branches);
  return branches;
}

export async function getCommitsCached(
  store: GitStore,
  ref: string,
  limit: number,
  skip: number
): Promise<{ commits: CommitInfo[]; hasMore: boolean }> {
  const cacheKey = repoCache.commitsKey(store.ownerId, store.repoName, ref, limit, skip);
  const cached = await getCached<{ commits: CommitInfo[]; hasMore: boolean }>(cacheKey);
  if (cached && cached.commits && cached.commits.length > 0) {
    return cached;
  }

  const result = await getCommits(store.fs, store.dir, ref, limit, skip);
  if (result.commits.length > 0) {
    await setCache(cacheKey, result, CACHE_TTL.commits);
  }
  return result;
}

export async function getCommitCountCached(store: GitStore, ref: string): Promise<number> {
  const cacheKey = repoCache.commitCountKey(store.ownerId, store.repoName, ref);
  const cached = await getCached<number>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const count = await getCommitCount(store.fs, store.dir, ref);
  if (count > 0) {
    await setCache(cacheKey, count, CACHE_TTL.commits);
  }
  return count;
}

export async function getTreeCached(
  store: GitStore,
  ref: string,
  filepath: string
): Promise<TreeEntry[] | null> {
  const cacheKey = repoCache.treeKey(store.ownerId, store.repoName, ref, filepath);
  const cached = await getCached<TreeEntry[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const tree = await getTree(store.fs, store.dir, ref, filepath);
  if (tree) {
    await setCache(cacheKey, tree, CACHE_TTL.tree);
  }
  return tree;
}

export async function getFileCached(
  store: GitStore,
  ref: string,
  filepath: string
): Promise<{ content: string; oid: string } | null> {
  const cacheKey = repoCache.fileKey(store.ownerId, store.repoName, ref, filepath);
  const cached = await getCached<{ content: string; oid: string }>(cacheKey);
  if (cached) {
    return cached;
  }

  const file = await getFile(store.fs, store.dir, ref, filepath);
  if (file) {
    await setCache(cacheKey, file, CACHE_TTL.file);
  }
  return file;
}

export { repoCache };
