import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, repositories } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import git from "isomorphic-git";
import { createR2Fs, getRepoPrefix } from "@/lib/r2-fs";
import { getSession } from "@/lib/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string; repo: string }> }
) {
  const { username, repo: repoName } = await params;
  const searchParams = request.nextUrl.searchParams;
  const branch = searchParams.get("branch") || "main";
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Path required" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const repo = await db.query.repositories.findFirst({
    where: and(eq(repositories.ownerId, user.id), eq(repositories.name, repoName)),
  });

  if (!repo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (repo.visibility === "private") {
    const session = await getSession();
    if (!session?.user || session.user.id !== repo.ownerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const commitOid = commits[0].oid;
    const parts = path.split("/").filter(Boolean);
    const fileName = parts.pop()!;

    let currentTree = (await git.readTree({ fs, gitdir: "/", oid: commitOid })).tree;

    for (const part of parts) {
      const entry = currentTree.find((e) => e.path === part && e.type === "tree");
      if (!entry) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      currentTree = (await git.readTree({ fs, gitdir: "/", oid: entry.oid })).tree;
    }

    const fileEntry = currentTree.find((e) => e.path === fileName && e.type === "blob");
    if (!fileEntry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { blob } = await git.readBlob({
      fs,
      gitdir: "/",
      oid: fileEntry.oid,
    });

    const isBinary = checkBinary(blob);

    if (isBinary) {
      return NextResponse.json(
        {
          oid: fileEntry.oid,
          path,
          isBinary: true,
          size: blob.length,
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        }
      );
    }

    const content = new TextDecoder("utf-8").decode(blob);

    return NextResponse.json(
      {
        content,
        oid: fileEntry.oid,
        path,
        isBinary: false,
        size: blob.length,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err) {
    console.error("Blob API error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function checkBinary(buffer: Uint8Array): boolean {
  const sampleSize = Math.min(8000, buffer.length);
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

