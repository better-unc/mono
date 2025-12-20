import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, repositories } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/session";
import git from "isomorphic-git";
import { createR2Fs, getRepoPrefix } from "@/lib/r2-fs";

const CHUNK_SIZE = 64 * 1024;

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;

  if (path.length < 4) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const [username, repoName, branch, ...fileParts] = path;
  const filePath = fileParts.join("/");

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const repo = await db.query.repositories.findFirst({
    where: and(eq(repositories.ownerId, user.id), eq(repositories.name, repoName)),
  });

  if (!repo) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  if (repo.visibility === "private") {
    const session = await getSession();
    if (!session?.user || session.user.id !== repo.ownerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  const repoPrefix = getRepoPrefix(user.id, `${repoName}.git`);
  const fs = createR2Fs(repoPrefix);

  try {
    const commits = await git.log({
      fs,
      gitdir: "/",
      ref: branch,
      depth: 1,
    });

    if (commits.length === 0) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    const commitOid = commits[0].oid;
    const parts = filePath.split("/").filter(Boolean);
    const fileName = parts.pop()!;

    let currentTree = (await git.readTree({ fs, gitdir: "/", oid: commitOid })).tree;

    for (const part of parts) {
      const entry = currentTree.find((e) => e.path === part && e.type === "tree");
      if (!entry) {
        return NextResponse.json({ error: "Path not found" }, { status: 404 });
      }
      currentTree = (await git.readTree({ fs, gitdir: "/", oid: entry.oid })).tree;
    }

    const fileEntry = currentTree.find((e) => e.path === fileName && e.type === "blob");
    if (!fileEntry) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const { blob } = await git.readBlob({
      fs,
      gitdir: "/",
      oid: fileEntry.oid,
    });

    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : Math.min(start + CHUNK_SIZE - 1, blob.length - 1);
        const chunk = blob.slice(start, end + 1);

        return new NextResponse(chunk, {
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

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": blob.length.toString(),
        "Accept-Ranges": "bytes",
        "X-Total-Size": blob.length.toString(),
      },
    });
  } catch (err) {
    console.error("File streaming error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

