import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useRepositoryWithStars, useRepoCommits } from "@gitbruv/hooks";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HugeiconsIcon } from "@hugeicons/react";
import { WorkHistoryIcon, ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons-pro/core-stroke-standard";
import { timeAgo, getCommitTitle } from "@gitbruv/lib";

type CommitsSearch = {
  page?: string;
};

export const Route = createFileRoute("/_main/$username/$repo/commits/$branch/")({
  component: CommitsPage,
  validateSearch: (search: Record<string, unknown>): CommitsSearch => ({
    page: (search.page as string) || undefined,
  }),
});

function CommitsSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-4 py-3 animate-pulse">
          <div className="h-8 w-8 bg-muted" />
          <div className="flex-1">
            <div className="h-5 bg-muted w-2/3 mb-2" />
            <div className="h-4 bg-muted w-1/3" />
          </div>
          <div className="h-6 bg-muted w-16" />
        </div>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="container max-w-6xl px-4">
      <div className="border border-border overflow-hidden">
        <div className="h-12 bg-card border-b border-border" />
        <CommitsSkeleton />
      </div>
    </div>
  );
}

function CommitRow({
  commit,
  username,
  repoName,
  branch,
}: {
  commit: { oid: string; message: string; author: { name: string; avatarUrl?: string }; timestamp: number };
  username: string;
  repoName: string;
  branch: string;
}) {
  return (
    <Link
      to="/$username/$repo/commits/$branch/$oid"
      params={{ username, repo: repoName, branch, oid: commit.oid }}
      className="flex items-start gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
    >
      <Avatar className="h-8 w-8 mt-0.5 rounded-none border-none after:border-none">
        <AvatarImage src={commit.author.avatarUrl || undefined} className="rounded-none border-none" />
        <AvatarFallback className="bg-muted text-muted-foreground font-semibold rounded-none">{commit.author.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{getCommitTitle(commit.message)}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
          <span className="font-medium text-foreground">{commit.author.name}</span>
          <span>committed</span>
          <span>{timeAgo(commit.timestamp)}</span>
        </div>
      </div>
      <code className="text-xs font-mono bg-muted px-2 py-1 shrink-0">{commit.oid.slice(0, 7)}</code>
    </Link>
  );
}

function CommitsPage() {
  const { username, repo: repoName, branch } = Route.useParams();
  const { page: pageParam } = Route.useSearch();

  const { data: repo, isLoading: repoLoading, error: repoError } = useRepositoryWithStars(username, repoName);

  const currentBranch = branch || repo?.defaultBranch || "main";
  const page = parseInt(pageParam || "1", 10);
  const perPage = 30;
  const skip = (page - 1) * perPage;

  const { data: commitsData, isLoading: commitsLoading } = useRepoCommits(username, repoName, currentBranch, perPage, skip);

  if (repoLoading) {
    return <PageSkeleton />;
  }

  if (repoError || !repo) {
    throw notFound();
  }

  const commits = commitsData?.commits || [];
  const hasMore = commitsData?.hasMore || false;

  return (
    <div className="container max-w-6xl px-4">
      <div className="border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
          <HugeiconsIcon icon={WorkHistoryIcon} strokeWidth={2} className="size-4" />
          <span className="text-sm text-muted-foreground">Commits on <span className="font-mono text-foreground">{currentBranch}</span></span>
        </div>

        {commitsLoading ? (
          <CommitsSkeleton />
        ) : commits.length === 0 ? (
          <div className="p-12 text-center">
            <HugeiconsIcon icon={WorkHistoryIcon} strokeWidth={2} className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No commits yet</h3>
            <p className="text-muted-foreground">This branch doesn't have any commits.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {commits.map((commit) => (
                <CommitRow key={commit.oid} commit={commit} username={username} repoName={repoName} branch={currentBranch} />
              ))}
            </div>

            {(page > 1 || hasMore) && (
              <div className="flex items-center justify-between px-4 py-3 bg-card border-t border-border">
                <Link
                  to="/$username/$repo/commits/$branch"
                  params={{ username, repo: repoName, branch: currentBranch }}
                  search={{ page: String(page - 1) }}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                >
                  <Button variant="outline" size="sm" disabled={page <= 1}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4 mr-1" />
                    Newer
                  </Button>
                </Link>
                <span className="text-sm text-muted-foreground">Page {page}</span>
                <Link
                  to="/$username/$repo/commits/$branch"
                  params={{ username, repo: repoName, branch: currentBranch }}
                  search={{ page: String(page + 1) }}
                  className={!hasMore ? "pointer-events-none opacity-50" : ""}
                >
                  <Button variant="outline" size="sm" disabled={!hasMore}>
                    Older
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
