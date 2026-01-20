import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useRepositoryWithStars, useCommitDiff } from "@gitbruv/hooks";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DiffViewer, DiffToolbar, type DiffViewMode } from "@/components/diff-viewer";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockKeyIcon, GlobeIcon, ArrowLeft02Icon, GitCommitIcon } from "@hugeicons-pro/core-stroke-standard";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_main/$username/$repo/commits/$branch/$oid")({
  component: CommitPage,
});

function DiffSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="border border-border overflow-hidden animate-pulse">
          <div className="h-10 bg-muted/50" />
          <div className="space-y-0">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="h-6 bg-muted/20" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="container px-4 py-6">
      <div className="mb-6 animate-pulse">
        <div className="h-6 w-48 bg-muted mb-4" />
        <div className="border border-border p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 bg-muted" />
            <div className="flex-1">
              <div className="h-6 w-3/4 bg-muted mb-2" />
              <div className="h-4 w-1/2 bg-muted" />
            </div>
          </div>
        </div>
      </div>
      <DiffSkeleton />
    </div>
  );
}

function CommitPage() {
  const { username, repo: repoName, branch, oid } = Route.useParams();
  const [viewMode, setViewMode] = useState<DiffViewMode>("unified");
  const [fullWidth, setFullWidth] = useState(false);

  const { data: repo, isLoading: repoLoading, error: repoError } = useRepositoryWithStars(username, repoName);
  const { data: diffData, isLoading: diffLoading, error: diffError } = useCommitDiff(username, repoName, oid);

  if (repoLoading) {
    return <PageSkeleton />;
  }

  if (repoError || !repo) {
    throw notFound();
  }

  const commit = diffData?.commit;
  const files = diffData?.files || [];
  const stats = diffData?.stats;

  return (
    <div className={cn("py-6 px-4", fullWidth ? "w-full" : "container")}>
      <div className="flex flex-col lg:flex-row items-start h-9 lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/$username" params={{ username }} className="text-accent hover:underline">
            <span className="text-xl font-bold">{username}</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link to="/$username/$repo" params={{ username, repo: repoName }} className="text-accent hover:underline">
            <span className="text-xl font-bold">{repoName}</span>
          </Link>
          <Badge variant="secondary" className="text-xs font-normal">
            {repo.visibility === "private" ? (
              <>
                <HugeiconsIcon icon={LockKeyIcon} strokeWidth={2} className="size-3 mr-1" />
                Private
              </>
            ) : (
              <>
                <HugeiconsIcon icon={GlobeIcon} strokeWidth={2} className="size-3 mr-1" />
                Public
              </>
            )}
          </Badge>
        </div>
      </div>

      <div className="mb-6">
        <Link
          to="/$username/$repo/commits/$branch"
          params={{ username, repo: repoName, branch }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
          Back to commits
        </Link>

        <div className="border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
            <HugeiconsIcon icon={GitCommitIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Commit</span>
            <code className="text-xs font-mono bg-muted px-2 py-0.5">{oid.slice(0, 7)}</code>
          </div>

          {diffLoading ? (
            <div className="p-6 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 bg-muted" />
                <div className="flex-1">
                  <div className="h-6 w-3/4 bg-muted mb-2" />
                  <div className="h-4 w-1/2 bg-muted" />
                </div>
              </div>
            </div>
          ) : diffError || !commit ? (
            <div className="p-6 text-center text-muted-foreground">Failed to load commit details</div>
          ) : (
            <div className="p-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10 rounded-none border-none after:border-none">
                  <AvatarImage src={commit.author.avatarUrl || undefined} className="rounded-none border-none" />
                  <AvatarFallback className="bg-muted text-muted-foreground font-semibold rounded-none">
                    {commit.author.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-medium whitespace-pre-wrap wrap-break-word">{commit.message}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    {commit.author.username ? (
                      <Link to="/$username" params={{ username: commit.author.username }} className="font-medium text-foreground hover:underline">
                        {commit.author.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{commit.author.name}</span>
                    )}
                    <span>committed</span>
                    <span>
                      {formatDistanceToNow(new Date(commit.timestamp), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">Commit: </span>
                    <code className="font-mono text-xs">{oid}</code>
                  </div>
                  {diffData?.parent && (
                    <div className="mt-1 text-sm">
                      <span className="text-muted-foreground">Parent: </span>
                      <Link
                        to="/$username/$repo/commits/$branch/$oid"
                        params={{ username, repo: repoName, branch, oid: diffData.parent }}
                        className="font-mono text-xs text-accent hover:underline"
                      >
                        {diffData.parent.slice(0, 7)}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {stats && (
        <DiffToolbar
          stats={stats}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          fullWidth={fullWidth}
          onFullWidthChange={setFullWidth}
        />
      )}

      {diffLoading ? <DiffSkeleton /> : <DiffViewer files={files} viewMode={viewMode} />}
    </div>
  );
}
