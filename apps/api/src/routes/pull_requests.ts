import { type Hono } from "hono";
import { type AppEnv } from "../types";
import { authMiddleware } from "../middleware/auth";
import { pullRequests, pullRequestEvents, repositories, users } from "@gitbruv/db";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import git from "isomorphic-git";
import { createR2Fs, getRepoPrefix } from "../r2-fs";

export function registerPullRequestRoutes(app: Hono<AppEnv>) {
    // List PRs for a repository
    app.get("/api/repositories/:owner/:name/pulls", authMiddleware, async (c) => {
        const owner = c.req.param("owner")!;
        const name = c.req.param("name")!;
        const status = c.req.query("status") as "open" | "merged" | "closed" | undefined;
        const db = c.get("db");

        const repoOwner = await db.query.users.findFirst({
            where: eq(users.username, owner),
        });

        if (!repoOwner) return c.json({ error: "Repository not found" }, 404);

        const repo = await db.query.repositories.findFirst({
            where: and(eq(repositories.ownerId, repoOwner.id), eq(repositories.name, name)),
        });

        if (!repo) return c.json({ error: "Repository not found" }, 404);

        const pulls = await db.query.pullRequests.findMany({
            where: status
                ? and(eq(pullRequests.repositoryId, repo.id), eq(pullRequests.status, status))
                : eq(pullRequests.repositoryId, repo.id),
            with: {
                author: true,
            },
            orderBy: [desc(pullRequests.createdAt)],
        });

        return c.json(pulls);
    });

    // Create a new PR
    app.post("/api/repositories/:owner/:name/pulls", authMiddleware, async (c) => {
        const user = c.get("user");
        if (!user) return c.text("Unauthorized", 401);

        const owner = c.req.param("owner")!;
        const name = c.req.param("name")!;
        const data = await c.req.json<{
            title: string;
            description?: string;
            base: string;
            head: string;
            headOwner?: string;
            headRepo?: string;
        }>();
        const db = c.get("db");

        // Get the base repository (where the PR is opened)
        const repoOwner = await db.query.users.findFirst({
            where: eq(users.username, owner),
        });

        if (!repoOwner) return c.json({ error: "Repository not found" }, 404);

        const repo = await db.query.repositories.findFirst({
            where: and(eq(repositories.ownerId, repoOwner.id), eq(repositories.name, name)),
        });

        if (!repo) return c.json({ error: "Repository not found" }, 404);

        // Get the head repository (where the head branch comes from)
        // Defaults to the same repo if not specified
        let headRepo = repo;
        let headRepoOwner = repoOwner;

        if (data.headOwner && data.headRepo) {
            const foundHeadRepoOwner = await db.query.users.findFirst({
                where: eq(users.username, data.headOwner),
            });

            if (!foundHeadRepoOwner) return c.json({ error: "Head repository not found" }, 404);
            headRepoOwner = foundHeadRepoOwner;

            const foundHeadRepo = await db.query.repositories.findFirst({
                where: and(eq(repositories.ownerId, foundHeadRepoOwner.id), eq(repositories.name, data.headRepo)),
            });

            if (!foundHeadRepo) return c.json({ error: "Head repository not found" }, 404);
            headRepo = foundHeadRepo;
        }

        const s3 = c.get("s3");

        // Verify base branch exists in base repo
        const baseRepoPrefix = getRepoPrefix(repoOwner.id, `${repo.name}.git`);
        const baseFs = createR2Fs(s3, baseRepoPrefix);

        try {
            await git.resolveRef({ fs: baseFs, gitdir: "/", ref: data.base });
        } catch {
            return c.json({ error: "Invalid base branch" }, 400);
        }

        // Verify head branch exists in head repo
        const headRepoPrefix = getRepoPrefix(headRepoOwner.id, `${headRepo.name}.git`);
        const headFs = createR2Fs(s3, headRepoPrefix);

        try {
            await git.resolveRef({ fs: headFs, gitdir: "/", ref: data.head });
        } catch {
            return c.json({ error: "Invalid head branch" }, 400);
        }

        // Get the current base commit OID to track sync state
        const baseCommitOid = await git.resolveRef({ fs: baseFs, gitdir: "/", ref: data.base });
        const headOid = await git.resolveRef({ fs: headFs, gitdir: "/", ref: data.head });

        // Get commits between base and head for the initial event
        const headCommits = await git.log({ fs: headFs, gitdir: "/", ref: headOid });
        const baseCommits = await git.log({ fs: baseFs, gitdir: "/", ref: baseCommitOid });
        const baseSet = new Set(baseCommits.map(c => c.oid));

        const prCommits: Array<{ oid: string; message: string; author: { name: string; email: string }; timestamp: number }> = [];
        for (const commit of headCommits) {
            if (baseSet.has(commit.oid)) break;
            prCommits.push({
                oid: commit.oid,
                message: commit.commit.message,
                author: { name: commit.commit.author.name, email: commit.commit.author.email },
                timestamp: commit.commit.author.timestamp * 1000,
            });
        }

        // Get next PR number for the base repo
        const result = await db
            .select({ maxNumber: sql<number>`max(${pullRequests.number})` })
            .from(pullRequests)
            .where(eq(pullRequests.repositoryId, repo.id));

        const nextNumber = (Number(result[0]?.maxNumber) || 0) + 1;

        const [pr] = await db
            .insert(pullRequests)
            .values({
                number: nextNumber,
                title: data.title,
                description: data.description || null,
                baseBranch: data.base,
                headBranch: data.head,
                baseCommitOid, // Store the base commit OID at PR creation time
                repositoryId: repo.id,
                headRepositoryId: headRepo.id !== repo.id ? headRepo.id : null,
                authorId: user.id,
            })
            .returning();

        // Record initial commits as an event
        if (prCommits.length > 0) {
            await db.insert(pullRequestEvents).values({
                pullRequestId: pr.id,
                type: "commit",
                actorId: user.id,
                data: { commits: prCommits.reverse() }, // Oldest first
            });
        }

        return c.json(pr);
    });

    // Get PR detail
    app.get("/api/repositories/:owner/:name/pulls/:number", authMiddleware, async (c) => {
        const owner = c.req.param("owner")!;
        const name = c.req.param("name")!;
        const number = parseInt(c.req.param("number")!, 10);
        const db = c.get("db");

        const repoOwner = await db.query.users.findFirst({
            where: eq(users.username, owner),
        });

        if (!repoOwner) return c.json({ error: "Repository not found" }, 404);

        const repo = await db.query.repositories.findFirst({
            where: and(eq(repositories.ownerId, repoOwner.id), eq(repositories.name, name)),
        });

        if (!repo) return c.json({ error: "Repository not found" }, 404);

        const pr = await db.query.pullRequests.findFirst({
            where: and(eq(pullRequests.repositoryId, repo.id), eq(pullRequests.number, number)),
            with: {
                author: true,
            }
        });

        if (!pr) return c.json({ error: "PR not found" }, 404);

        return c.json(pr);
    });

    // Get PR events (for conversation timeline)
    app.get("/api/repositories/:owner/:name/pulls/:number/events", authMiddleware, async (c) => {
        const owner = c.req.param("owner")!;
        const name = c.req.param("name")!;
        const number = parseInt(c.req.param("number")!, 10);
        const db = c.get("db");

        const repoOwner = await db.query.users.findFirst({
            where: eq(users.username, owner),
        });

        if (!repoOwner) return c.json({ error: "Repository not found" }, 404);

        const repo = await db.query.repositories.findFirst({
            where: and(eq(repositories.ownerId, repoOwner.id), eq(repositories.name, name)),
        });

        if (!repo) return c.json({ error: "Repository not found" }, 404);

        const pr = await db.query.pullRequests.findFirst({
            where: and(eq(pullRequests.repositoryId, repo.id), eq(pullRequests.number, number)),
        });

        if (!pr) return c.json({ error: "PR not found" }, 404);

        const events = await db.query.pullRequestEvents.findMany({
            where: eq(pullRequestEvents.pullRequestId, pr.id),
            with: {
                actor: true,
            },
            orderBy: [asc(pullRequestEvents.createdAt)],
        });

        return c.json(events);
    });

    // Get PR commits
    app.get("/api/repositories/:owner/:name/pulls/:number/commits", authMiddleware, async (c) => {
        const owner = c.req.param("owner")!;
        const name = c.req.param("name")!;
        const number = parseInt(c.req.param("number")!, 10);
        const db = c.get("db");
        const s3 = c.get("s3");

        const repoOwner = await db.query.users.findFirst({ where: eq(users.username, owner) });
        if (!repoOwner) return c.json({ error: "Not found" }, 404);
        const repo = await db.query.repositories.findFirst({ where: and(eq(repositories.ownerId, repoOwner.id), eq(repositories.name, name)) });
        if (!repo) return c.json({ error: "Not found" }, 404);
        const pr = await db.query.pullRequests.findFirst({
            where: and(eq(pullRequests.repositoryId, repo.id), eq(pullRequests.number, number)),
            with: { headRepository: { with: { owner: true } } }
        });
        if (!pr) return c.json({ error: "Not found" }, 404);

        // Base repo filesystem
        const baseRepoPrefix = getRepoPrefix(repoOwner.id, `${repo.name}.git`);
        const baseFs = createR2Fs(s3, baseRepoPrefix);

        // Head repo filesystem (may be same as base if same-repo PR)
        let headFs = baseFs;
        if (pr.headRepositoryId && pr.headRepository) {
            const headRepoPrefix = getRepoPrefix(pr.headRepository.ownerId, `${pr.headRepository.name}.git`);
            headFs = createR2Fs(s3, headRepoPrefix);
        }

        try {
            const headOid = await git.resolveRef({ fs: headFs, gitdir: "/", ref: pr.headBranch });
            const baseOid = await git.resolveRef({ fs: baseFs, gitdir: "/", ref: pr.baseBranch });

            const commits = await git.log({ fs: headFs, gitdir: "/", ref: headOid });
            const baseCommits = await git.log({ fs: baseFs, gitdir: "/", ref: baseOid });
            const baseSet = new Set(baseCommits.map(c => c.oid));

            const prCommits = [];
            for (const commit of commits) {
                if (baseSet.has(commit.oid)) break;
                prCommits.push({
                    oid: commit.oid,
                    message: commit.commit.message,
                    author: commit.commit.author,
                    timestamp: commit.commit.author.timestamp * 1000,
                });
            }

            return c.json(prCommits);
        } catch (err) {
            console.error(err);
            return c.json({ error: "Failed to fetch commits" }, 500);
        }
    });

    // Get PR diff
    app.get("/api/repositories/:owner/:name/pulls/:number/diff", authMiddleware, async (c) => {
        const owner = c.req.param("owner")!;
        const name = c.req.param("name")!;
        const number = parseInt(c.req.param("number")!, 10);
        const db = c.get("db");
        const s3 = c.get("s3");

        const repoOwner = await db.query.users.findFirst({ where: eq(users.username, owner) });
        if (!repoOwner) return c.json({ error: "Not found" }, 404);
        const repo = await db.query.repositories.findFirst({ where: and(eq(repositories.ownerId, repoOwner.id), eq(repositories.name, name)) });
        if (!repo) return c.json({ error: "Not found" }, 404);
        const pr = await db.query.pullRequests.findFirst({
            where: and(eq(pullRequests.repositoryId, repo.id), eq(pullRequests.number, number)),
            with: { headRepository: { with: { owner: true } } }
        });
        if (!pr) return c.json({ error: "Not found" }, 404);

        // Base repo filesystem
        const baseRepoPrefix = getRepoPrefix(repoOwner.id, `${repo.name}.git`);
        const baseFs = createR2Fs(s3, baseRepoPrefix);

        // Head repo filesystem (may be same as base if same-repo PR)
        let headFs = baseFs;
        const isCrossRepo = !!(pr.headRepositoryId && pr.headRepository);
        if (isCrossRepo && pr.headRepository) {
            const headRepoPrefix = getRepoPrefix(pr.headRepository.ownerId, `${pr.headRepository.name}.git`);
            headFs = createR2Fs(s3, headRepoPrefix);
        }

        try {
            const headOid = await git.resolveRef({ fs: headFs, gitdir: "/", ref: pr.headBranch });
            const currentBaseOid = await git.resolveRef({ fs: baseFs, gitdir: "/", ref: pr.baseBranch });

            // Helper to read blob content as text
            async function readBlobContent(fs: typeof baseFs, oid: string): Promise<string | null> {
                try {
                    const { blob } = await git.readBlob({ fs, gitdir: "/", oid });
                    return new TextDecoder("utf-8").decode(blob);
                } catch {
                    return null;
                }
            }

            // Check if PR is out of sync (base branch has moved since PR creation)
            const storedBaseOid = pr.baseCommitOid;
            const isOutOfSync = storedBaseOid && storedBaseOid !== currentBaseOid;

            // For cross-repo PRs, find the merge base to calculate the correct diff
            // The merge base is the common ancestor between head and base branches
            let mergeBaseOid: string | null = null;
            let behindBy = 0;
            let hasConflicts = false;
            let conflictingFiles: string[] = [];

            if (isCrossRepo) {
                // Get all commits from the head repo's branch (the fork)
                const headCommits = await git.log({ fs: headFs, gitdir: "/", ref: headOid });
                const headCommitOids = new Set(headCommits.map(c => c.oid));

                // Get commits from base repo, finding where they diverged
                const baseCommits = await git.log({ fs: baseFs, gitdir: "/", ref: currentBaseOid });

                // Find the merge base (first common commit)
                for (const commit of baseCommits) {
                    if (headCommitOids.has(commit.oid)) {
                        mergeBaseOid = commit.oid;
                        break;
                    }
                }

                // Calculate how many commits behind the head branch is
                if (mergeBaseOid) {
                    for (const commit of baseCommits) {
                        if (commit.oid === mergeBaseOid) break;
                        behindBy++;
                    }
                }

                // If no merge base found, fall back to stored base commit
                if (!mergeBaseOid && storedBaseOid) {
                    mergeBaseOid = storedBaseOid;
                }
            }

            // Determine which base commit to diff against
            // For cross-repo PRs, use merge base; for same-repo, use current base
            const diffBaseOid = isCrossRepo && mergeBaseOid ? mergeBaseOid : currentBaseOid;

            // For same-repo PRs, use git.walk directly
            if (!isCrossRepo) {
                const changes = await git.walk({
                    fs: baseFs,
                    gitdir: "/",
                    trees: [git.TREE({ ref: diffBaseOid }), git.TREE({ ref: headOid })],
                    map: async function (filepath, [base, head]) {
                        if (filepath === ".") return;
                        const bOid = await base?.oid();
                        const hOid = await head?.oid();
                        if (bOid === hOid) return;

                        let type: "added" | "deleted" | "modified" = "modified";
                        if (!bOid) type = "added";
                        else if (!hOid) type = "deleted";

                        // Read file content
                        const baseContent = bOid ? await readBlobContent(baseFs, bOid) : null;
                        const headContent = hOid ? await readBlobContent(baseFs, hOid) : null;

                        return { path: filepath, type, baseOid: bOid, headOid: hOid, baseContent, headContent };
                    }
                });

                return c.json({
                    diffs: changes.filter(Boolean),
                    syncStatus: {
                        isOutOfSync: false,
                        behindBy: 0,
                        hasConflicts: false,
                        conflictingFiles: [],
                        baseBranch: pr.baseBranch,
                    }
                });
            }

            // For cross-repo PRs, we need to:
            // 1. Get files at the merge base (what the head started from)
            // 2. Get files in the head (what the PR author has now)
            // 3. If out of sync, also get current base files to detect conflicts

            const mergeBaseFiles = new Map<string, string>();
            const headFiles = new Map<string, string>();
            const currentBaseFiles = new Map<string, string>();

            // Walk merge base tree (from head repo, since it should have the commit)
            if (mergeBaseOid) {
                await git.walk({
                    fs: headFs,
                    gitdir: "/",
                    trees: [git.TREE({ ref: mergeBaseOid })],
                    map: async function (filepath, [entry]) {
                        if (filepath === ".") return;
                        const oid = await entry?.oid();
                        const type = await entry?.type();
                        if (type === "blob" && oid) {
                            mergeBaseFiles.set(filepath, oid);
                        }
                    }
                });
            }

            // Walk head tree
            await git.walk({
                fs: headFs,
                gitdir: "/",
                trees: [git.TREE({ ref: headOid })],
                map: async function (filepath, [entry]) {
                    if (filepath === ".") return;
                    const oid = await entry?.oid();
                    const type = await entry?.type();
                    if (type === "blob" && oid) {
                        headFiles.set(filepath, oid);
                    }
                }
            });

            // Walk current base tree (to detect conflicts if out of sync)
            if (isOutOfSync || behindBy > 0) {
                await git.walk({
                    fs: baseFs,
                    gitdir: "/",
                    trees: [git.TREE({ ref: currentBaseOid })],
                    map: async function (filepath, [entry]) {
                        if (filepath === ".") return;
                        const oid = await entry?.oid();
                        const type = await entry?.type();
                        if (type === "blob" && oid) {
                            currentBaseFiles.set(filepath, oid);
                        }
                    }
                });

                // Detect conflicts: files that changed in both base and head since merge base
                const allPaths = new Set([...mergeBaseFiles.keys(), ...headFiles.keys(), ...currentBaseFiles.keys()]);
                for (const filepath of allPaths) {
                    const mergeBaseOidVal = mergeBaseFiles.get(filepath);
                    const headOidVal = headFiles.get(filepath);
                    const currentBaseOidVal = currentBaseFiles.get(filepath);

                    // File changed in head (PR author's changes)
                    const changedInHead = mergeBaseOidVal !== headOidVal;
                    // File changed in base (upstream changes)
                    const changedInBase = mergeBaseOidVal !== currentBaseOidVal;

                    // Conflict if both changed the same file differently
                    if (changedInHead && changedInBase && headOidVal !== currentBaseOidVal) {
                        hasConflicts = true;
                        conflictingFiles.push(filepath);
                    }
                }
            }

            // Calculate the diff (what the PR author actually changed from the merge base)
            const diffs: { path: string; type: "added" | "deleted" | "modified"; baseOid?: string; headOid?: string; baseContent?: string | null; headContent?: string | null }[] = [];
            const allPaths = new Set([...mergeBaseFiles.keys(), ...headFiles.keys()]);

            for (const filepath of allPaths) {
                const bOid = mergeBaseFiles.get(filepath);
                const hOid = headFiles.get(filepath);

                if (bOid === hOid) continue;

                let type: "added" | "deleted" | "modified" = "modified";
                if (!bOid) type = "added";
                else if (!hOid) type = "deleted";

                // Read file content
                // For merge base content, try head repo first (should have it), fall back to base repo
                let baseContent: string | null = null;
                if (bOid) {
                    baseContent = await readBlobContent(headFs, bOid);
                    if (baseContent === null) {
                        baseContent = await readBlobContent(baseFs, bOid);
                    }
                }
                const headContent = hOid ? await readBlobContent(headFs, hOid) : null;

                diffs.push({ path: filepath, type, baseOid: bOid, headOid: hOid, baseContent, headContent });
            }

            return c.json({
                diffs,
                syncStatus: {
                    isOutOfSync: behindBy > 0,
                    behindBy,
                    hasConflicts,
                    conflictingFiles,
                    baseBranch: pr.baseBranch,
                    mergeBaseOid,
                }
            });
        } catch (err) {
            console.error(err);
            return c.json({ error: "Failed to generate diff" }, 500);
        }
    });

    // Update branch (merge base into head for out-of-sync PRs)
    app.post("/api/repositories/:owner/:name/pulls/:number/update-branch", authMiddleware, async (c) => {
        const user = c.get("user");
        if (!user) return c.text("Unauthorized", 401);

        const owner = c.req.param("owner")!;
        const name = c.req.param("name")!;
        const number = parseInt(c.req.param("number")!, 10);
        const db = c.get("db");
        const s3 = c.get("s3");

        // Get full user data for commit authorship
        const fullUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
        if (!fullUser) return c.json({ error: "User not found" }, 404);

        const repoOwner = await db.query.users.findFirst({ where: eq(users.username, owner) });
        if (!repoOwner) return c.json({ error: "Not found" }, 404);
        const repo = await db.query.repositories.findFirst({ where: and(eq(repositories.ownerId, repoOwner.id), eq(repositories.name, name)) });
        if (!repo) return c.json({ error: "Not found" }, 404);
        const pr = await db.query.pullRequests.findFirst({
            where: and(eq(pullRequests.repositoryId, repo.id), eq(pullRequests.number, number)),
            with: { headRepository: { with: { owner: true } }, author: true }
        });
        if (!pr || pr.status !== "open") return c.json({ error: "PR not found or not open" }, 400);

        // Only PR author or base repo owner can update the branch
        const isAuthor = user.id === pr.authorId;
        const isRepoOwner = user.id === repoOwner.id;
        if (!isAuthor && !isRepoOwner) {
            return c.json({ error: "Only the PR author or repository owner can update this branch" }, 403);
        }

        // This only works for cross-repo PRs
        if (!pr.headRepositoryId || !pr.headRepository) {
            return c.json({ error: "Branch update is only available for cross-repository PRs" }, 400);
        }

        const baseRepoPrefix = getRepoPrefix(repoOwner.id, `${repo.name}.git`);
        const baseFs = createR2Fs(s3, baseRepoPrefix);
        const headRepoPrefix = getRepoPrefix(pr.headRepository.ownerId, `${pr.headRepository.name}.git`);
        const headFs = createR2Fs(s3, headRepoPrefix);

        try {
            const currentBaseOid = await git.resolveRef({ fs: baseFs, gitdir: "/", ref: pr.baseBranch });
            const headOid = await git.resolveRef({ fs: headFs, gitdir: "/", ref: pr.headBranch });

            // Find merge base
            const headCommits = await git.log({ fs: headFs, gitdir: "/", ref: headOid });
            const headCommitOids = new Set(headCommits.map(c => c.oid));
            const baseCommits = await git.log({ fs: baseFs, gitdir: "/", ref: currentBaseOid });

            let mergeBaseOid: string | null = null;
            for (const commit of baseCommits) {
                if (headCommitOids.has(commit.oid)) {
                    mergeBaseOid = commit.oid;
                    break;
                }
            }

            if (!mergeBaseOid) {
                return c.json({ error: "Could not find common ancestor" }, 400);
            }

            // Already up to date
            if (mergeBaseOid === currentBaseOid) {
                return c.json({ message: "Branch is already up to date", updated: false });
            }

            // Calculate how many commits behind (for the event)
            let behindBy = 0;
            for (const commit of baseCommits) {
                if (commit.oid === mergeBaseOid) break;
                behindBy++;
            }

            // Copy new objects from base repo to head repo (the fork)
            // Using git.readObject/writeObject to handle both loose and packed objects
            const copiedObjects = new Set<string>();
            
            const copyObjectToHead = async (oid: string, type?: string) => {
                if (copiedObjects.has(oid)) return;
                copiedObjects.add(oid);

                // Check if object already exists in head
                const objPath = `/objects/${oid.slice(0, 2)}/${oid.slice(2)}`;
                try {
                    await headFs.promises.readFile(objPath);
                    return; // Already exists as loose object
                } catch {
                    // Object doesn't exist as loose object, try to copy
                }

                // Try to copy the raw object file first (fastest method)
                try {
                    const objData = await baseFs.promises.readFile(objPath);
                    await headFs.promises.writeFile(objPath, objData);
                    return;
                } catch {
                    // Object might be in a packfile, use git API to read/write
                }

                // Fall back to using git API (handles packfiles)
                try {
                    const { object, type: objType } = await git.readObject({
                        fs: baseFs,
                        gitdir: "/",
                        oid,
                        format: "content",
                    });

                    // Only write if it's a valid git object type
                    if (objType === "commit" || objType === "tree" || objType === "blob" || objType === "tag") {
                        await git.writeObject({
                            fs: headFs,
                            gitdir: "/",
                            type: objType,
                            object: object as Uint8Array,
                        });
                    }
                } catch (err) {
                    console.error(`Failed to copy object ${oid}:`, err);
                    // Continue anyway - the object might already exist in head via another means
                }
            };

            // Copy commits and their trees/blobs from base to head repo
            for (const commit of baseCommits) {
                if (commit.oid === mergeBaseOid) break;

                await copyObjectToHead(commit.oid, "commit");

                // Copy tree and all blobs recursively
                const copyTreeRecursive = async (treeOid: string) => {
                    await copyObjectToHead(treeOid, "tree");

                    try {
                        const entries = await git.walk({
                            fs: baseFs,
                            gitdir: "/",
                            trees: [git.TREE({ ref: treeOid })],
                            map: async (filepath, [entry]) => {
                                if (filepath === ".") return;
                                const entryOid = await entry?.oid();
                                const entryType = await entry?.type();
                                return { oid: entryOid, type: entryType };
                            }
                        });

                        for (const entry of entries.filter(Boolean)) {
                            if (!entry?.oid) continue;
                            await copyObjectToHead(entry.oid, entry.type);
                            if (entry.type === "tree") {
                                await copyTreeRecursive(entry.oid);
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to walk tree ${treeOid}:`, err);
                    }
                };

                await copyTreeRecursive(commit.commit.tree);
            }

            // Get trees for merge base, head, and current base
            const getTreeFiles = async (fs: typeof baseFs, ref: string) => {
                const files = new Map<string, { oid: string; mode: number }>();
                await git.walk({
                    fs,
                    gitdir: "/",
                    trees: [git.TREE({ ref })],
                    map: async (filepath, [entry]) => {
                        if (filepath === ".") return;
                        const oid = await entry?.oid();
                        const type = await entry?.type();
                        const mode = await entry?.mode();
                        if (type === "blob" && oid) {
                            files.set(filepath, { oid, mode: mode || 0o100644 });
                        }
                    }
                });
                return files;
            };

            const mergeBaseFiles = await getTreeFiles(headFs, mergeBaseOid);
            const headFiles = await getTreeFiles(headFs, headOid);
            const baseFiles = await getTreeFiles(baseFs, currentBaseOid);

            // Check for conflicts
            const allPaths = new Set([...mergeBaseFiles.keys(), ...headFiles.keys(), ...baseFiles.keys()]);
            const conflicts: string[] = [];

            for (const filepath of allPaths) {
                const mergeBaseFile = mergeBaseFiles.get(filepath);
                const headFile = headFiles.get(filepath);
                const baseFile = baseFiles.get(filepath);

                const changedInHead = mergeBaseFile?.oid !== headFile?.oid;
                const changedInBase = mergeBaseFile?.oid !== baseFile?.oid;

                if (changedInHead && changedInBase && headFile?.oid !== baseFile?.oid) {
                    conflicts.push(filepath);
                }
            }

            if (conflicts.length > 0) {
                return c.json({ error: "Cannot auto-merge: conflicts detected", conflicts }, 409);
            }

            // Create merged tree (three-way merge)
            // For each file: if changed in base but not head, take base; if changed in head, take head
            const mergedFiles = new Map<string, { oid: string; mode: number }>();

            for (const filepath of allPaths) {
                const mergeBaseFile = mergeBaseFiles.get(filepath);
                const headFile = headFiles.get(filepath);
                const baseFile = baseFiles.get(filepath);

                const changedInHead = mergeBaseFile?.oid !== headFile?.oid;
                const changedInBase = mergeBaseFile?.oid !== baseFile?.oid;

                if (changedInHead) {
                    // Head changes take priority (PR author's changes)
                    if (headFile) {
                        mergedFiles.set(filepath, headFile);
                    }
                    // If headFile is undefined, file was deleted in head
                } else if (changedInBase) {
                    // Take base changes
                    if (baseFile) {
                        mergedFiles.set(filepath, baseFile);
                    }
                    // If baseFile is undefined, file was deleted in base
                } else {
                    // No changes, keep as-is
                    if (headFile) {
                        mergedFiles.set(filepath, headFile);
                    }
                }
            }

            // Build the tree structure for git using a simpler recursive approach
            const buildTreeFromFiles = async (files: Map<string, { oid: string; mode: number }>): Promise<string> => {
                // Organize files into a tree structure
                type TreeNode = {
                    type: "blob" | "tree";
                    oid?: string;
                    mode?: number;
                    children?: Map<string, TreeNode>;
                };

                const root: TreeNode = { type: "tree", children: new Map() };

                // Build the tree structure
                for (const [filepath, { oid, mode }] of files) {
                    const parts = filepath.split("/");
                    let current = root;

                    for (let i = 0; i < parts.length - 1; i++) {
                        const part = parts[i];
                        if (!current.children!.has(part)) {
                            current.children!.set(part, { type: "tree", children: new Map() });
                        }
                        current = current.children!.get(part)!;
                    }

                    const filename = parts[parts.length - 1];
                    current.children!.set(filename, { type: "blob", oid, mode });
                }

                // Recursively write trees bottom-up
                const writeTreeNode = async (node: TreeNode): Promise<string> => {
                    if (node.type === "blob") {
                        return node.oid!;
                    }

                    const entries: { mode: string; path: string; oid: string; type: "blob" | "tree" }[] = [];

                    for (const [name, child] of node.children!) {
                        const childOid = await writeTreeNode(child);
                        entries.push({
                            mode: child.type === "tree" ? "040000" : (child.mode || 0o100644).toString(8).padStart(6, "0"),
                            path: name,
                            oid: childOid,
                            type: child.type,
                        });
                    }

                    // Sort entries by name (git requirement)
                    entries.sort((a, b) => a.path.localeCompare(b.path));

                    return await git.writeTree({
                        fs: headFs,
                        gitdir: "/",
                        tree: entries,
                    });
                };

                return await writeTreeNode(root);
            };

            const mergedTreeOid = await buildTreeFromFiles(mergedFiles);

            // Create merge commit
            const mergeCommitOid = await git.writeCommit({
                fs: headFs,
                gitdir: "/",
                commit: {
                    message: `Merge branch '${pr.baseBranch}' from ${owner}/${name} into ${pr.headBranch}`,
                    tree: mergedTreeOid,
                    parent: [headOid, currentBaseOid],
                    author: {
                        name: fullUser.name,
                        email: fullUser.email,
                        timestamp: Math.floor(Date.now() / 1000),
                        timezoneOffset: 0,
                    },
                    committer: {
                        name: fullUser.name,
                        email: fullUser.email,
                        timestamp: Math.floor(Date.now() / 1000),
                        timezoneOffset: 0,
                    },
                },
            });

            // Update the head branch ref
            await git.writeRef({
                fs: headFs,
                gitdir: "/",
                ref: `refs/heads/${pr.headBranch}`,
                value: mergeCommitOid,
                force: true,
            });

            // Update the PR's baseCommitOid to reflect the new sync state
            await db
                .update(pullRequests)
                .set({
                    baseCommitOid: currentBaseOid,
                    updatedAt: new Date(),
                })
                .where(eq(pullRequests.id, pr.id));

            // Record branch update event
            await db.insert(pullRequestEvents).values({
                pullRequestId: pr.id,
                type: "branch_update",
                actorId: user.id,
                data: {
                    mergeCommitOid,
                    baseBranch: pr.baseBranch,
                    commitCount: behindBy,
                },
            });

            return c.json({
                message: "Branch updated successfully",
                updated: true,
                mergeCommitOid,
            });
        } catch (err) {
            console.error(err);
            return c.json({ error: "Failed to update branch" }, 500);
        }
    });

    // Merge PR
    app.patch("/api/repositories/:owner/:name/pulls/:number/merge", authMiddleware, async (c) => {
        const user = c.get("user");
        if (!user) return c.text("Unauthorized", 401);

        const owner = c.req.param("owner")!;
        const name = c.req.param("name")!;
        const number = parseInt(c.req.param("number")!, 10);
        const db = c.get("db");
        const s3 = c.get("s3");

        const repoOwner = await db.query.users.findFirst({ where: eq(users.username, owner) });
        if (!repoOwner) return c.json({ error: "Not found" }, 404);
        const repo = await db.query.repositories.findFirst({ where: and(eq(repositories.ownerId, repoOwner.id), eq(repositories.name, name)) });
        if (!repo) return c.json({ error: "Not found" }, 404);

        // Authorization: Only the repository owner can merge PRs
        if (repo.ownerId !== user.id) {
            return c.json({ error: "Only the repository owner can merge pull requests" }, 403);
        }

        const pr = await db.query.pullRequests.findFirst({
            where: and(eq(pullRequests.repositoryId, repo.id), eq(pullRequests.number, number)),
            with: { headRepository: { with: { owner: true } } }
        });
        if (!pr || pr.status !== "open") return c.json({ error: "PR not found or not open" }, 400);

        const baseRepoPrefix = getRepoPrefix(repoOwner.id, `${repo.name}.git`);
        const baseFs = createR2Fs(s3, baseRepoPrefix);

        try {
            let headOid: string;

            // For cross-repo PRs, we need to copy git objects from the fork
            if (pr.headRepositoryId && pr.headRepository) {
                const headRepoPrefix = getRepoPrefix(pr.headRepository.ownerId, `${pr.headRepository.name}.git`);
                const headFs = createR2Fs(s3, headRepoPrefix);

                headOid = await git.resolveRef({ fs: headFs, gitdir: "/", ref: pr.headBranch });

                // Get all commits from head that aren't in base
                const baseOid = await git.resolveRef({ fs: baseFs, gitdir: "/", ref: pr.baseBranch });
                const headCommits = await git.log({ fs: headFs, gitdir: "/", ref: headOid });
                const baseCommits = await git.log({ fs: baseFs, gitdir: "/", ref: baseOid });
                const baseSet = new Set(baseCommits.map(c => c.oid));

                // Copy objects for each new commit and its tree/blobs
                // Using git API to handle both loose and packed objects
                const copiedObjects = new Set<string>();

                const copyObjectToBase = async (oid: string) => {
                    if (copiedObjects.has(oid)) return;
                    copiedObjects.add(oid);

                    const objPath = `/objects/${oid.slice(0, 2)}/${oid.slice(2)}`;
                    
                    // Check if already exists in base
                    try {
                        await baseFs.promises.readFile(objPath);
                        return;
                    } catch {
                        // Need to copy
                    }

                    // Try raw file copy first
                    try {
                        const objData = await headFs.promises.readFile(objPath);
                        await baseFs.promises.writeFile(objPath, objData);
                        return;
                    } catch {
                        // Object might be in packfile
                    }

                    // Fall back to git API for packfiles
                    try {
                        const { object, type: objType } = await git.readObject({
                            fs: headFs,
                            gitdir: "/",
                            oid,
                            format: "content",
                        });

                        if (objType === "commit" || objType === "tree" || objType === "blob" || objType === "tag") {
                            await git.writeObject({
                                fs: baseFs,
                                gitdir: "/",
                                type: objType,
                                object: object as Uint8Array,
                            });
                        }
                    } catch (err) {
                        console.error(`Failed to copy object ${oid}:`, err);
                    }
                };

                for (const commit of headCommits) {
                    if (baseSet.has(commit.oid)) break;

                    await copyObjectToBase(commit.oid);

                    // Copy tree and blobs for this commit
                    const copyTreeRecursive = async (treeOid: string) => {
                        await copyObjectToBase(treeOid);

                        try {
                            const entries = await git.walk({
                                fs: headFs,
                                gitdir: "/",
                                trees: [git.TREE({ ref: treeOid })],
                                map: async (filepath, [entry]) => {
                                    if (filepath === ".") return;
                                    const entryOid = await entry?.oid();
                                    const entryType = await entry?.type();
                                    return { oid: entryOid, type: entryType };
                                }
                            });

                            for (const entry of entries.filter(Boolean)) {
                                if (!entry?.oid) continue;
                                await copyObjectToBase(entry.oid);
                                if (entry.type === "tree") {
                                    await copyTreeRecursive(entry.oid);
                                }
                            }
                        } catch (err) {
                            console.error(`Failed to walk tree ${treeOid}:`, err);
                        }
                    };

                    await copyTreeRecursive(commit.commit.tree);
                }
            } else {
                // Same-repo PR: just get the head oid
                headOid = await git.resolveRef({ fs: baseFs, gitdir: "/", ref: pr.headBranch });
            }

            await git.writeRef({
                fs: baseFs,
                gitdir: "/",
                ref: `refs/heads/${pr.baseBranch}`,
                value: headOid,
                force: true
            });

            const [updatedPr] = await db
                .update(pullRequests)
                .set({
                    status: "merged",
                    mergedBy: user.id,
                    mergedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(pullRequests.id, pr.id))
                .returning();

            return c.json(updatedPr);
        } catch (err) {
            console.error(err);
            return c.json({ error: "Merge failed" }, 500);
        }
    });
}
