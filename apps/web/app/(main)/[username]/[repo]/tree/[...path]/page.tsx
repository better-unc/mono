import { Suspense } from "react";
import { TreePageClient, PageSkeleton } from "./client";

export const dynamic = "force-dynamic";

export default async function TreePage({ params }: { params: Promise<{ username: string; repo: string; path: string[] }> }) {
  const { username, repo: repoName, path: pathSegments } = await params;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <TreePageClient username={username} repoName={repoName} pathSegments={pathSegments} />
    </Suspense>
  );
}
