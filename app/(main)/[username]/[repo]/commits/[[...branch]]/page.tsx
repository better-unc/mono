import { notFound } from "next/navigation";
import Link from "next/link";
import { getRepository, getRepoCommits, getRepoBranches } from "@/actions/repositories";
import { BranchSelector } from "@/components/branch-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Lock, Globe, GitCommit, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default async function CommitsPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; repo: string; branch?: string[] }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { username, repo: repoName, branch: branchSegments } = await params;
  const { page: pageParam } = await searchParams;

  const repo = await getRepository(username, repoName);

  if (!repo) {
    notFound();
  }

  const branch = branchSegments?.[0] || repo.defaultBranch;
  const page = parseInt(pageParam || "1", 10);
  const perPage = 30;
  const skip = (page - 1) * perPage;

  const [{ commits, hasMore }, branches] = await Promise.all([
    getRepoCommits(username, repoName, branch, perPage, skip),
    getRepoBranches(username, repoName),
  ]);

  return (
    <div className="container px-4 py-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/${username}`} className="text-accent hover:underline">
            <span className="text-xl font-bold">{username}</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link href={`/${username}/${repoName}`} className="text-accent hover:underline">
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

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-3">
            <BranchSelector
              branches={branches}
              currentBranch={branch}
              username={username}
              repoName={repoName}
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GitCommit className="h-4 w-4" />
              <span>Commits</span>
            </div>
          </div>
        </div>

        {commits.length === 0 ? (
          <div className="p-12 text-center">
            <GitCommit className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No commits yet</h3>
            <p className="text-muted-foreground">
              This branch doesn&apos;t have any commits.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {commits.map((commit) => (
              <div
                key={commit.oid}
                className="flex items-start gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <Avatar className="h-8 w-8 mt-0.5">
                  <AvatarFallback className="text-xs bg-accent/20">
                    {commit.author.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{commit.message.split("\n")[0]}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{commit.author.name}</span>
                    <span>committed</span>
                    <span>
                      {formatDistanceToNow(new Date(commit.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded shrink-0">
                  {commit.oid.slice(0, 7)}
                </code>
              </div>
            ))}
          </div>
        )}

        {(page > 1 || hasMore) && (
          <div className="flex items-center justify-between px-4 py-3 bg-card border-t border-border">
            <Button variant="outline" size="sm" asChild disabled={page <= 1}>
              <Link
                href={`/${username}/${repoName}/commits/${branch}?page=${page - 1}`}
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Newer
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <Button variant="outline" size="sm" asChild disabled={!hasMore}>
              <Link
                href={`/${username}/${repoName}/commits/${branch}?page=${page + 1}`}
                className={!hasMore ? "pointer-events-none opacity-50" : ""}
              >
                Older
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

