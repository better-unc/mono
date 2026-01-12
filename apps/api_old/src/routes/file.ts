import { type Hono } from "hono";
import git from "isomorphic-git";
import { type AppEnv } from "../types";
import { repoMiddleware } from "../middleware/repo";
import { authMiddleware, requireAuth } from "../middleware/auth";
import { createR2Fs } from "../r2-fs";

const CHUNK_SIZE = 64 * 1024;

export function registerFileRoutes(app: Hono<AppEnv>) {
  app.options("/file/:username/:repo/:branch/*", (c) => {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range",
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

    const s3 = c.get("s3");
    const fs = createR2Fs(s3, repoPrefix);

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
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
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
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        },
      });
    } catch (err) {
      console.error("File streaming error:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
  });
}
