import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, repositories } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import git from "isomorphic-git";
import { createR2Fs, getRepoPrefix } from "@/lib/r2-fs";
import { getSession } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string; repo: string }> }
) {
  const { username, repo: repoName } = await params;

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
    const branches = await git.listBranches({ fs, gitdir: "/" });

    return NextResponse.json(
      { branches, defaultBranch: repo.defaultBranch },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch {
    return NextResponse.json({ branches: [], defaultBranch: repo.defaultBranch });
  }
}

