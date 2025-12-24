import { Suspense } from "react";
import { BlobPageClient, PageSkeleton } from "./client";

export const dynamic = "force-dynamic";

export default async function BlobPage({ params }: { params: Promise<{ username: string; repo: string; path: string[] }> }) {
  const { username, repo: repoName, path: pathSegments } = await params;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <BlobPageClient username={username} repoName={repoName} pathSegments={pathSegments} />
    </Suspense>
  );
}
