import { NextRequest, NextResponse } from "next/server";
import { r2List, r2Get } from "@/lib/r2";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRepoPrefix } from "@/lib/r2-fs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const repo = searchParams.get("repo");

  if (!username || !repo) {
    return NextResponse.json({ error: "Missing username or repo" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const repoPrefix = getRepoPrefix(user.id, `${repo}.git`);

  const allKeys = await r2List("");
  const repoKeys = allKeys.filter((k) => k.startsWith(repoPrefix));

  const head = await r2Get(`${repoPrefix}/HEAD`);
  const config = await r2Get(`${repoPrefix}/config`);

  const refsHeadsMain = await r2Get(`${repoPrefix}/refs/heads/main`);

  return NextResponse.json({
    repoPrefix,
    totalKeysInBucket: allKeys.length,
    repoKeys: repoKeys,
    head: head?.toString(),
    config: config?.toString(),
    "refs/heads/main": refsHeadsMain?.toString(),
  });
}
