import { BranchSelector } from "@/components/branch-selector";
import { CloneUrl } from "@/components/clone-url";
import { CodeViewer } from "@/components/code-viewer";
import { FileTree } from "@/components/file-tree";
import { StarButton } from "@/components/star-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useRepoBranches, useRepoCommitCount, useRepoCommits, useRepoReadme, useRepoReadmeOid, useRepositoryInfo, useRepoTree } from "@gitbruv/hooks";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { BookOpen, Eye, GitBranch, GitFork, History, Loader2, Star } from "lucide-react";

export const Route = createFileRoute("/_main/$username/$repo/")({
  component: RepoPage,
});

function RepoPage() {
  const { username, repo: repoName } = Route.useParams();

  const { data: repoInfo, isLoading: isLoadingInfo } = useRepositoryInfo(username, repoName);
  const defaultBranch = repoInfo?.repo.defaultBranch || "main";

  const { data: treeData, isLoading: isLoadingTree } = useRepoTree(username, repoName, defaultBranch);
  const { data: branchesData, isLoading: isLoadingBranches } = useRepoBranches(username, repoName);
  const { data: readmeOidData, isLoading: isLoadingReadmeOid } = useRepoReadmeOid(username, repoName, defaultBranch);
  const { data: commitData, isLoading: isLoadingLastCommit } = useRepoCommits(username, repoName, defaultBranch, 1);
  const { data: commitCountData, isLoading: isLoadingCommitCount } = useRepoCommitCount(username, repoName, defaultBranch);

  const repo = repoInfo?.repo;
  const files = treeData?.files || [];
  const isEmpty = treeData?.isEmpty ?? true;
  const branches = branchesData?.branches || [];
  const readmeOid = readmeOidData?.readmeOid;
  const lastCommit = commitData?.commits?.[0];
  const commitCount = commitCountData?.count || 0;

  return (
    <div className="container max-w-6xl px-4 py-4">
      {isLoadingInfo || !repo ? <RepoHeaderSkeleton /> : <RepoHeader repo={repo} />}

      <div className="mt-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isLoadingBranches || isLoadingInfo ? (
              <div className="h-8.5 w-30 bg-secondary/50 animate-pulse" />
            ) : (
              <BranchSelector branches={branches} currentBranch={defaultBranch} username={username} repoName={repo?.name || repoName} />
            )}
            {isLoadingInfo || isLoadingCommitCount ? (
              <div className="h-5 w-28 bg-secondary/50 animate-pulse" />
            ) : (
              <Link
                to="/$username/$repo/commits/$branch"
                params={{ username, repo: repoName, branch: defaultBranch }}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="h-4 w-4" />
                <span className="font-mono flex items-center gap-2">
                  {isLoadingCommitCount ? <Loader2 className="h-4 w-4 animate-spin" /> : commitCount} commits
                </span>
              </Link>
            )}
          </div>

          <CloneUrl username={username} repoName={repo?.name || repoName} />
        </div>

        {isLoadingLastCommit ? <LastCommitBarSkeleton /> : <LastCommitBar lastCommit={lastCommit} />}

        {isLoadingTree ? (
          <FileTreeSkeleton />
        ) : isEmpty ? (
          <EmptyRepoState username={username} repoName={repo?.name || repoName} />
        ) : (
          <div className="border border-border bg-card overflow-hidden">
            <FileTree files={files} username={username} repoName={repo?.name || repoName} branch={defaultBranch} />
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
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">README.md</span>
            </div>
            <ReadmeContent username={username} repoName={repoName} readmeOid={readmeOid} />
          </div>
        ) : null}
      </div>
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
function RepoHeaderSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-40 bg-secondary/50" />
            <div className="h-5 w-14 bg-secondary/50" />
          </div>
          <div className="h-5 w-64 bg-secondary/50 max-w-2xl" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-9 w-24 bg-secondary/50 border border-border" />
          <div className="h-9 w-20 bg-secondary/50 border border-border" />
        </div>
      </div>
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 bg-secondary/50" />
          <div className="h-4 w-4 bg-secondary/50" />
          <div className="h-4 w-10 bg-secondary/50" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 bg-secondary/50" />
          <div className="h-4 w-4 bg-secondary/50" />
          <div className="h-4 w-12 bg-secondary/50" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 bg-secondary/50" />
          <div className="h-4 w-4 bg-secondary/50" />
          <div className="h-4 w-16 bg-secondary/50" />
        </div>
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

function RepoHeader({ repo }: { repo: any }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{repo.name}</h1>
            <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border border-border text-muted-foreground">{repo.visibility}</span>
          </div>
          {repo.description && <p className="text-muted-foreground max-w-2xl">{repo.description}</p>}
        </div>

        <div className="flex items-center gap-2">
          <StarButton repoId={repo.id} initialStarred={repo.starred} initialCount={repo.starCount} />
          <Button variant="secondary" size="sm" className="gap-1.5 border border-border">
            <GitFork className="h-3.5 w-3.5" />
            <span>Fork</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Star className="h-4 w-4" />
          <span className="font-medium text-foreground">{repo.starCount}</span>
          <span>stars</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <GitFork className="h-4 w-4" />
          <span className="font-medium text-foreground">0</span>
          <span>forks</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span className="font-medium text-foreground">0</span>
          <span>watching</span>
        </div>
      </div>
    </div>
  );
}

function LastCommitBar({ lastCommit }: { lastCommit: any }) {
  if (!lastCommit) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-secondary/30 border border-border">
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarImage src={lastCommit.author.avatarUrl || undefined} />
        <AvatarFallback className="text-[10px] bg-muted">{lastCommit.author.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-sm font-medium shrink-0">{lastCommit.author.name}</span>
        <span className="text-sm text-muted-foreground truncate">{lastCommit.message}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
        <code className="font-mono">{lastCommit.oid.substring(0, 7)}</code>
        <span>{formatDistanceToNow(lastCommit.timestamp)} ago</span>
      </div>
    </div>
  );
}

function EmptyRepoState({ username, repoName }: { username: string; repoName: string }) {
  return (
    <div className="border border-dashed border-border p-12 text-center space-y-6">
      <div className="w-16 h-16 mx-auto bg-primary/10 flex items-center justify-center">
        <GitBranch className="h-8 w-8 text-primary" />
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
