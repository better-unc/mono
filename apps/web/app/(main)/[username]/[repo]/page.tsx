import { Suspense } from "react";
import { RepoPageClient, PageSkeleton } from "./client";

export const dynamic = "force-dynamic";

export default async function RepoPage({ params }: { params: Promise<{ username: string; repo: string }> }) {
  const { username, repo: repoName } = await params;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <RepoPageClient username={username} repoName={repoName} />
    </Suspense>
  );
}
