import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useRepositoryWithStars, useRepoCommits, useRepoBranches } from "@gitbruv/hooks";
import { BranchSelector } from "@/components/branch-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lock, Globe, GitCommit, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type CommitsSearch = {
  page?: string;
};

export const Route = createFileRoute("/_main/$username/$repo/commits/$branch")({
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
    <div className="container px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-8 w-32 bg-muted animate-pulse" />
        <div className="h-8 w-32 bg-muted animate-pulse" />
      </div>
      <div className="border border-border overflow-hidden">
        <div className="h-12 bg-card border-b border-border" />
        <CommitsSkeleton />
      </div>
    </div>
  );
}

function CommitRow({ commit }: { commit: { oid: string; message: string; author: { name: string; avatarUrl?: string }; timestamp: number } }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
      <Avatar className="h-8 w-8 mt-0.5">
        <AvatarImage src={commit.author.avatarUrl || undefined} />
        <AvatarFallback className="text-xs bg-accent/20">{commit.author.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{commit.message.split("\n")[0]}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
          <span className="font-medium text-foreground">{commit.author.name}</span>
          <span>committed</span>
          <span>
            {formatDistanceToNow(new Date(commit.timestamp), {
              addSuffix: true,
            })}
          </span>
        </div>
      </div>
      <code className="text-xs font-mono bg-muted px-2 py-1  shrink-0">{commit.oid.slice(0, 7)}</code>
    </div>
  );
}

function CommitsPage() {
  const { username, repo: repoName, branch } = Route.useParams();
  const { page: pageParam } = Route.useSearch();

  const { data: repo, isLoading: repoLoading, error: repoError } = useRepositoryWithStars(username, repoName);
  const { data: branchesData, isLoading: branchesLoading } = useRepoBranches(username, repoName);

  const currentBranch = branch || repo?.defaultBranch || "main";
  const page = parseInt(pageParam || "1", 10);
  const perPage = 30;
  const skip = (page - 1) * perPage;

  const { data: commitsData, isLoading: commitsLoading } = useRepoCommits(username, repoName, currentBranch, perPage, skip);

  if (repoLoading || branchesLoading) {
    return <PageSkeleton />;
  }

  if (repoError || !repo) {
    throw notFound();
  }

  const branches = branchesData?.branches || [];
  const commits = commitsData?.commits || [];
  const hasMore = commitsData?.hasMore || false;

  return (
    <div className="container px-4 py-6">
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
                <Lock className="h-3 w-3 mr-1" />
                Private
              </>
            ) : (
              <>
                <Globe className="h-3 w-3 mr-1" />
                Public
              </>
            )}
          </Badge>
        </div>
      </div>

      <div className="border border-border overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-3">
            <BranchSelector branches={branches} currentBranch={currentBranch} username={username} repoName={repoName} />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GitCommit className="h-4 w-4" />
              <span>Commits</span>
            </div>
          </div>
        </div>

        {commitsLoading ? (
          <CommitsSkeleton />
        ) : commits.length === 0 ? (
          <div className="p-12 text-center">
            <GitCommit className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No commits yet</h3>
            <p className="text-muted-foreground">This branch doesn't have any commits.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {commits.map((commit) => (
                <CommitRow key={commit.oid} commit={commit} />
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
                    <ChevronLeft className="h-4 w-4 mr-1" />
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
                    <ChevronRight className="h-4 w-4 ml-1" />
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
