import { Suspense } from "react";
import { CommitsPageClient, PageSkeleton } from "./client";

export const dynamic = "force-dynamic";

export default async function CommitsPage({ params }: { params: Promise<{ username: string; repo: string; branch?: string[] }> }) {
  const { username, repo: repoName, branch: branchSegments } = await params;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <CommitsPageClient username={username} repoName={repoName} branchSegments={branchSegments} />
    </Suspense>
  );
}
