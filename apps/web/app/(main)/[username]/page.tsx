import { Suspense } from "react";
import { ProfilePageClient, PageSkeleton } from "./client";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfilePageClient username={username} />
    </Suspense>
  );
}
