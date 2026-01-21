import { CloneUrl } from "@/components/clone-url";
import { CodeViewer } from "@/components/code-viewer";
import { FileTree } from "@/components/file-tree";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRepoCommits, useRepoReadme, useRepoReadmeOid, useRepositoryInfo, useRepoTree, useTreeCommits } from "@gitbruv/hooks";
import { createFileRoute } from "@tanstack/react-router";
import { timeAgo } from "@gitbruv/lib";
import { HugeiconsIcon } from "@hugeicons/react";
import { BookOpenIcon, GitBranchIcon } from "@hugeicons-pro/core-stroke-standard";

export const Route = createFileRoute("/_main/$username/$repo/")({
  component: RepoPage,
});

function RepoPage() {
  const { username, repo: repoName } = Route.useParams();

  const { data: repoInfo } = useRepositoryInfo(username, repoName);
  const defaultBranch = repoInfo?.repo.defaultBranch || "main";
  const currentBranch = defaultBranch;

  const { data: treeData, isLoading: isLoadingTree } = useRepoTree(username, repoName, currentBranch);
  const { data: treeCommitsData, isLoading: isLoadingTreeCommits } = useTreeCommits(username, repoName, currentBranch);
  const { data: readmeOidData, isLoading: isLoadingReadmeOid } = useRepoReadmeOid(username, repoName, currentBranch);
  const { data: commitData, isLoading: isLoadingLastCommit } = useRepoCommits(username, repoName, currentBranch, 1);

  const repo = repoInfo?.repo;
  const files = treeData?.files || [];
  const isEmpty = treeData?.isEmpty ?? true;
  const treeCommits = treeCommitsData?.files;
  const readmeOid = readmeOidData?.readmeOid;
  const lastCommit = commitData?.commits?.[0];

  return (
    <div className="container max-w-6xl px-4 space-y-6">
      {isLoadingLastCommit ? <LastCommitBarSkeleton /> : <LastCommitBar lastCommit={lastCommit} />}

      {isLoadingTree ? (
        <FileTreeSkeleton />
      ) : isEmpty ? (
        <EmptyRepoState username={username} repoName={repo?.name || repoName} />
      ) : (
        <div className="border border-border bg-card overflow-hidden">
          <FileTree
            files={files}
            username={username}
            repoName={repo?.name || repoName}
            branch={currentBranch}
            commits={treeCommits}
            isLoadingCommits={isLoadingTreeCommits}
          />
        </div>
      )}

      {isLoadingReadmeOid ? (
        <div className="border border-border bg-card overflow-hidden animate-pulse">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
            <div className="h-4 w-4 bg-secondary/50" />
            <div className="h-4 w-24 bg-secondary/50" />
          </div>
          <div className="p-6 md:p-8 space-y-3">
            <div className="h-6 w-3/4 bg-secondary/50" />
            <div className="h-4 w-full bg-secondary/50" />
            <div className="h-4 w-5/6 bg-secondary/50" />
            <div className="h-4 w-4/5 bg-secondary/50" />
            <div className="h-4 w-full bg-secondary/50" />
          </div>
        </div>
      ) : readmeOid ? (
        <div className="border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
            <HugeiconsIcon icon={BookOpenIcon} strokeWidth={2} className="size-4 text-primary" />
            <span className="text-sm font-medium">README.md</span>
          </div>
          <ReadmeContent username={username} repoName={repoName} readmeOid={readmeOid} />
        </div>
      ) : null}
    </div>
  );
}

function LastCommitBarSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-secondary/30 border border-border animate-pulse">
      <div className="h-6 w-6 bg-secondary/50 shrink-0" />
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="h-4 w-24 bg-secondary/50 shrink-0" />
        <div className="h-4 w-64 bg-secondary/50 truncate" />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="h-3.5 w-14 bg-secondary/50 font-mono" />
        <div className="h-3.5 w-20 bg-secondary/50" />
      </div>
    </div>
  );
}
function FileTreeSkeleton() {
  const fileWidths = ["32%", "28%", "45%", "24%", "38%", "31%"];

  return (
    <div className="border border-border bg-card overflow-hidden animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-2.5 border-b border-border last:border-b-0">
          <div className={`h-4 w-4 bg-secondary/50`} />
          <div className="h-4 bg-secondary/50" style={{ width: fileWidths[i] || "35%" }} />
        </div>
      ))}
    </div>
  );
}

function LastCommitBar({ lastCommit }: { lastCommit: any }) {
  if (!lastCommit) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-secondary/30 border border-border">
      <Avatar className="h-6 w-6 shrink-0 rounded-none border-none after:border-none">
        <AvatarImage src={lastCommit.author.avatarUrl || undefined} className="rounded-none border-none" />
        <AvatarFallback className="bg-muted text-muted-foreground font-semibold rounded-none">{lastCommit.author.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-sm font-medium shrink-0">{lastCommit.author.name}</span>
        <span className="text-sm text-muted-foreground truncate">{lastCommit.message}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
        <code className="font-mono">{lastCommit.oid.substring(0, 7)}</code>
        <span>{timeAgo(lastCommit.timestamp)}</span>
      </div>
    </div>
  );
}

function EmptyRepoState({ username, repoName }: { username: string; repoName: string }) {
  return (
    <div className="border border-dashed border-border p-12 text-center space-y-6">
      <div className="w-16 h-16 mx-auto bg-primary/10 flex items-center justify-center">
        <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} className="size-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">This repository is empty</h2>
        <p className="text-muted-foreground max-w-md mx-auto">Get started by cloning this repository and pushing your first commit.</p>
      </div>
      <div className="max-w-lg mx-auto">
        <CloneUrl username={username} repoName={repoName} />
      </div>
    </div>
  );
}

function ReadmeContent({ username, repoName, readmeOid }: { username: string; repoName: string; readmeOid: string }) {
  const { data, isLoading } = useRepoReadme(username, repoName, readmeOid);

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-3 animate-pulse">
        <div className="h-6 w-3/4 bg-secondary/50" />
        <div className="h-4 w-full bg-secondary/50" />
        <div className="h-4 w-5/6 bg-secondary/50" />
        <div className="h-4 w-4/5 bg-secondary/50" />
        <div className="h-4 w-full bg-secondary/50" />
      </div>
    );
  }

  if (!data?.content) return null;

  return <CodeViewer content={data.content} language="markdown" />;
}
