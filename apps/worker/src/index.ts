import { Hono, type Context, type MiddlewareHandler } from "hono";
import git from "isomorphic-git";
import { type Env } from "./env";
import { createDb } from "./db";
import { createR2Fs, getRepoPrefix } from "./r2-fs";
import { authenticateRequest, getRepoOwnerAndRepo, type AuthenticatedUser } from "./auth";
import { getRefsAdvertisement, handleUploadPack, handleReceivePack } from "./git-handler";
import { type Database, repositories } from "@gitbruv/db";

type RepoData = {
  owner: { id: string; username: string };
  repo: typeof repositories.$inferSelect;
  repoPrefix: string;
};

type Variables = {
  db: Database;
  repoData: RepoData;
  user: AuthenticatedUser | null;
};

type AppEnv = { Bindings: Env; Variables: Variables };

const app = new Hono<AppEnv>();

const CHUNK_SIZE = 64 * 1024;

const repoMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const username = c.req.param("username")!;
  let repoName = c.req.param("repo")!;

  if (repoName.endsWith(".git")) {
    repoName = repoName.slice(0, -4);
  }

  const db = createDb(c.env.DB.connectionString);
  c.set("db", db);

  const result = await getRepoOwnerAndRepo(db, username, repoName);
  if (!result) {
    return c.text("Repository not found", 404);
  }

  const repoPrefix = getRepoPrefix(result.owner.id, `${repoName}.git`);
  c.set("repoData", { ...result, repoPrefix });

  await next();
};

const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const db = c.get("db");
  const user = await authenticateRequest(c.req.raw, db);
  c.set("user", user);
  await next();
};

const requireAuth = (c: Context<AppEnv>, ownerId: string): Response | null => {
  const user = c.get("user");
  if (!user || user.id !== ownerId) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="gitbruv"' },
    });
  }
  return null;
};

app.get("/:username/:repo/info/refs", repoMiddleware, authMiddleware, async (c) => {
  const { repo, repoPrefix } = c.get("repoData");
  const service = c.req.query("service");

  if (service !== "git-upload-pack" && service !== "git-receive-pack") {
    return c.text("Not found", 404);
  }

  if (service === "git-receive-pack") {
    const authError = requireAuth(c, repo.ownerId);
    if (authError) return authError;
  } else if (repo.visibility === "private") {
    const authError = requireAuth(c, repo.ownerId);
    if (authError) return authError;
  }

  const fs = createR2Fs(c.env.REPO_BUCKET, repoPrefix);
  const refs = await getRefsAdvertisement(fs, "/", service);

  const packet = `# service=${service}\n`;
  const packetLen = (packet.length + 4).toString(16).padStart(4, "0");
  const encoder = new TextEncoder();
  const header = encoder.encode(packetLen + packet + "0000");
  const response = new Uint8Array(header.length + refs.length);
  response.set(header, 0);
  response.set(refs, header.length);

  return new Response(response, {
    headers: {
      "Content-Type": `application/x-${service}-advertisement`,
      "Cache-Control": "no-cache",
    },
  });
});

app.post("/:username/:repo/git-upload-pack", repoMiddleware, authMiddleware, async (c) => {
  const { repo, repoPrefix } = c.get("repoData");

  if (repo.visibility === "private") {
    const authError = requireAuth(c, repo.ownerId);
    if (authError) return authError;
  }

  const body = new Uint8Array(await c.req.arrayBuffer());
  const fs = createR2Fs(c.env.REPO_BUCKET, repoPrefix);
  const response = await handleUploadPack(fs, "/", body);

  return new Response(response, {
    headers: {
      "Content-Type": "application/x-git-upload-pack-result",
      "Cache-Control": "no-cache",
    },
  });
});

app.post("/:username/:repo/git-receive-pack", repoMiddleware, authMiddleware, async (c) => {
  const { repo, repoPrefix } = c.get("repoData");

  const authError = requireAuth(c, repo.ownerId);
  if (authError) return authError;

  const body = new Uint8Array(await c.req.arrayBuffer());
  const fs = createR2Fs(c.env.REPO_BUCKET, repoPrefix);
  const response = await handleReceivePack(fs, "/", body);

  return new Response(response, {
    headers: {
      "Content-Type": "application/x-git-receive-pack-result",
      "Cache-Control": "no-cache",
    },
  });
});

app.get("/file/:username/:repo/:branch/*", repoMiddleware, authMiddleware, async (c) => {
  const { repo, repoPrefix } = c.get("repoData");
  const branch = c.req.param("branch")!;
  const filePath = c.req.path.split("/").slice(5).join("/");

  if (repo.visibility === "private") {
    const authError = requireAuth(c, repo.ownerId);
    if (authError) return authError;
  }

  const fs = createR2Fs(c.env.REPO_BUCKET, repoPrefix);

  try {
    const commits = await git.log({
      fs,
      gitdir: "/",
      ref: branch,
      depth: 1,
    });

    if (commits.length === 0) {
      return c.json({ error: "Branch not found" }, 404);
    }

    const commitOid = commits[0].oid;
    const parts = filePath.split("/").filter(Boolean);
    const fileName = parts.pop()!;

    let currentTree = (await git.readTree({ fs, gitdir: "/", oid: commitOid })).tree;

    for (const part of parts) {
      const entry = currentTree.find((e) => e.path === part && e.type === "tree");
      if (!entry) {
        return c.json({ error: "Path not found" }, 404);
      }
      currentTree = (await git.readTree({ fs, gitdir: "/", oid: entry.oid })).tree;
    }

    const fileEntry = currentTree.find((e) => e.path === fileName && e.type === "blob");
    if (!fileEntry) {
      return c.json({ error: "File not found" }, 404);
    }

    const { blob } = await git.readBlob({
      fs,
      gitdir: "/",
      oid: fileEntry.oid,
    });

    const rangeHeader = c.req.header("range");

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : Math.min(start + CHUNK_SIZE - 1, blob.length - 1);
        const chunk = blob.slice(start, end + 1);

        return new Response(chunk, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${blob.length}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunk.length.toString(),
            "Content-Type": "application/octet-stream",
          },
        });
      }
    }

    const stream = new ReadableStream({
      start(controller) {
        let offset = 0;
        const push = () => {
          if (offset >= blob.length) {
            controller.close();
            return;
          }
          const chunk = blob.slice(offset, offset + CHUNK_SIZE);
          controller.enqueue(chunk);
          offset += CHUNK_SIZE;
          setTimeout(push, 0);
        };
        push();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": blob.length.toString(),
        "Accept-Ranges": "bytes",
        "X-Total-Size": blob.length.toString(),
      },
    });
  } catch (err) {
    console.error("File streaming error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.get("/avatar/:filename", async (c) => {
  const filename = c.req.param("filename")!;
  const key = `avatars/${filename}`;

  const obj = await c.env.REPO_BUCKET.get(key);

  if (!obj) {
    return new Response(null, { status: 404 });
  }

  const ext = filename.split(".").pop()?.toLowerCase();
  let contentType = "image/png";

  if (ext === "jpg" || ext === "jpeg") {
    contentType = "image/jpeg";
  } else if (ext === "gif") {
    contentType = "image/gif";
  } else if (ext === "webp") {
    contentType = "image/webp";
  }

  return new Response(obj.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

app.notFound((c) => c.text("Not found", 404));

export default app;
