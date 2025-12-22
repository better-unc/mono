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
  const path = searchParams.get("path") || "";

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
      return NextResponse.json({ files: [], isEmpty: true });
    }

    const commitOid = commits[0].oid;
    let { tree } = await git.readTree({ fs, gitdir: "/", oid: commitOid });

    if (path) {
      const parts = path.split("/").filter(Boolean);
      for (const part of parts) {
        const entry = tree.find((e) => e.path === part && e.type === "tree");
        if (!entry) {
          return NextResponse.json({ error: "Path not found" }, { status: 404 });
        }
        const subTree = await git.readTree({ fs, gitdir: "/", oid: entry.oid });
        tree = subTree.tree;
      }
    }

    const files = tree
      .map((entry) => ({
        name: entry.path,
        type: entry.type as "blob" | "tree",
        oid: entry.oid,
        path: path ? `${path}/${entry.path}` : entry.path,
      }))
      .sort((a, b) => {
        if (a.type === "tree" && b.type !== "tree") return -1;
        if (a.type !== "tree" && b.type === "tree") return 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json(
      { files, isEmpty: false, commit: commitOid },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    console.error("Tree API error:", err);
    return NextResponse.json({ files: [], isEmpty: true });
  }
}

