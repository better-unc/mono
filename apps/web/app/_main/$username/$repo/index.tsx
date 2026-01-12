import { createFileRoute, Link } from "@tanstack/react-router";
import { useRepositoryInfo, useRepoTree, useRepoBranches, useRepoReadme, useRepoCommits, useRepoCommitCount } from "@/lib/hooks/use-repositories";
import { useUserAvatarByEmail } from "@/lib/hooks/use-users";
import { FileTree } from "@/components/file-tree";
import { CodeViewer } from "@/components/code-viewer";
import { CloneUrl } from "@/components/clone-url";
import { BranchSelector } from "@/components/branch-selector";
import { StarButton } from "@/components/star-button";
import { GitBranch, Loader2, History, BookOpen, Star, GitFork, Eye, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

export const Route = createFileRoute("/_main/$username/$repo/")({
  component: RepoPage,
});

function RepoPage() {
  const { username, repo: repoName } = Route.useParams();

  const { data: repoInfo, isLoading: isLoadingInfo } = useRepositoryInfo(username, repoName);
  const defaultBranch = repoInfo?.repo.defaultBranch || "main";

  const { data: treeData, isLoading: isLoadingTree } = useRepoTree(username, repoName, defaultBranch);
  const { data: branchesData, isLoading: isLoadingBranches } = useRepoBranches(username, repoName);
  const { data: commitData } = useRepoCommits(username, repoName, defaultBranch, 1);
  const { data: commitCountData, isLoading: isLoadingCommitCount } = useRepoCommitCount(username, repoName, defaultBranch);

  const repo = repoInfo?.repo;
  const files = treeData?.files || [];
  const isEmpty = treeData?.isEmpty ?? true;
  const branches = branchesData?.branches || [];
  const readmeOid = treeData?.readmeOid;
  const lastCommit = commitData?.commits?.[0];
  const commitCount = commitCountData?.count || 0;

  return (
    <div className="container max-w-6xl px-4 py-8">
      {isLoadingInfo || !repo ? <RepoHeaderSkeleton /> : <RepoHeader repo={repo} username={username} />}

      <div className="mt-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isLoadingBranches || isLoadingInfo ? (
              <div className="h-9 w-28 bg-secondary/50 animate-pulse rounded" />
            ) : (
              <BranchSelector branches={branches} currentBranch={defaultBranch} username={username} repoName={repo?.name || repoName} />
            )}
            {isLoadingInfo ? (
              <div className="h-5 w-24 bg-secondary/50 animate-pulse rounded" />
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

        {isLoadingTree ? (
          <FileTreeSkeleton />
        ) : isEmpty ? (
          <EmptyRepoState username={username} repoName={repo?.name || repoName} />
        ) : (
          <>
            <LastCommitBar lastCommit={lastCommit} />
            <div className="border border-border bg-card overflow-hidden">
              <FileTree files={files} username={username} repoName={repo?.name || repoName} branch={defaultBranch} />
            </div>
          </>
        )}

        {readmeOid && (
          <div className="border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">README.md</span>
            </div>
            <div className="p-6 md:p-8 markdown-body">
              <ReadmeContent username={username} repoName={repoName} readmeOid={readmeOid} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RepoHeaderSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-48 bg-secondary/50 rounded" />
            <div className="h-5 w-16 bg-secondary/50 rounded" />
          </div>
          <div className="h-5 w-96 bg-secondary/50 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-20 bg-secondary/50 rounded" />
          <div className="h-9 w-20 bg-secondary/50 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="h-5 w-16 bg-secondary/50 rounded" />
        <div className="h-5 w-16 bg-secondary/50 rounded" />
        <div className="h-5 w-20 bg-secondary/50 rounded" />
      </div>
    </div>
  );
}

function FileTreeSkeleton() {
  return (
    <div className="border border-border bg-card overflow-hidden animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-2.5 border-b border-border last:border-b-0">
          <div className="h-4 w-4 bg-secondary/50 rounded" />
          <div className="h-4 bg-secondary/50 rounded" style={{ width: `${Math.random() * 40 + 20}%` }} />
        </div>
      ))}
    </div>
  );
}

function RepoHeader({ repo, username }: { repo: any; username: string }) {
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

// function QuickClone({ username, repoName }: { username: string; repoName: string }) {
//   const [copied, setCopied] = useState(false);
//   const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/git/${username}/${repoName}.git`;

//   async function copy() {
//     await navigator.clipboard.writeText(url);
//     setCopied(true);
//     setTimeout(() => setCopied(false), 2000);
//   }

//   return (
//     <div className="flex items-center gap-2">
//       <code className="px-3 py-1.5 bg-secondary/50 border border-border text-xs font-mono text-muted-foreground truncate max-w-[300px]">
//         {url}
//       </code>
//       <Button variant="secondary" size="sm" onClick={copy} className="shrink-0 border border-border">
//         {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
//       </Button>
//     </div>
//   );
// }

function LastCommitBar({ lastCommit }: { lastCommit: any }) {
  const { data: avatarData } = useUserAvatarByEmail(lastCommit?.author.email);

  if (!lastCommit) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-secondary/30 border border-border">
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarImage src={avatarData?.avatarUrl || undefined} />
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.content) return null;

  return <CodeViewer content={data.content} language="markdown" />;
}
