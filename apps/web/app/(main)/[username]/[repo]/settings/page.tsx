import { RepoSettingsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function RepoSettingsPage({ params }: { params: Promise<{ username: string; repo: string }> }) {
  const { username, repo: repoName } = await params;

  return <RepoSettingsClient username={username} repoName={repoName} />;
}
