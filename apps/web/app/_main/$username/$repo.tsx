import { Suspense } from "react";
import { createFileRoute, Outlet, Link, useParams, useLocation } from "@tanstack/react-router";
import { useQueryState } from "nuqs";
import { useRepositoryInfo, useRepoBranches, useRepoCommitCount, useIssueCount } from "@gitbruv/hooks";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CodeIcon,
  RecordIcon,
  WorkHistoryIcon,
  SettingsIcon,
  StarIcon,
  GitForkIcon,
  EyeIcon,
  Loading02Icon,
} from "@hugeicons-pro/core-stroke-standard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BranchSelector } from "@/components/branch-selector";
import { CloneUrl } from "@/components/clone-url";
import { StarButton } from "@/components/star-button";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_main/$username/$repo")({
  component: RepoLayout,
});

function RepoLayout() {
  return (
    <Suspense fallback={<RepoLayoutSkeleton />}>
      <RepoLayoutContent />
    </Suspense>
  );
}

function RepoLayoutContent() {
  const { username, repo: repoName } = useParams({ from: "/_main/$username/$repo" });
  const location = useLocation();
  const [branchParam] = useQueryState("branch");

  const { data: repoInfo, isLoading: isLoadingInfo } = useRepositoryInfo(username, repoName);
  const { data: branchesData, isLoading: isLoadingBranches } = useRepoBranches(username, repoName);
  const { data: issueCountData, isLoading: isLoadingIssueCount } = useIssueCount(username, repoName);

  const repo = repoInfo?.repo;
  const isOwner = repoInfo?.isOwner ?? false;
  const defaultBranch = repo?.defaultBranch || "main";
  const currentBranch = branchParam || defaultBranch;
  const branches = branchesData?.branches || [];
  const openIssueCount = issueCountData?.open || 0;

  console.log(currentBranch);

  const { data: commitCountData, isLoading: isLoadingCommitCount } = useRepoCommitCount(username, repoName, currentBranch);
  const commitCount = commitCountData?.count || 0;

  const pathname = location.pathname;
  const isCode = pathname === `/${username}/${repoName}` || pathname.includes("/tree/") || pathname.includes("/blob/");
  const isIssues = pathname.includes("/issues") || pathname.includes("/labels");
  const isCommits = pathname.includes("/commits");
  const isSettings = pathname.includes("/settings");

  const currentTab = isSettings ? "settings" : isCommits ? "commits" : isIssues ? "issues" : "code";

  return (
    <div>
      <div className="container max-w-6xl px-4 py-4">
        {isLoadingInfo || !repo ? (
          <RepoHeaderSkeleton />
        ) : (
          <RepoHeader
            repo={repo}
            username={username}
            openIssueCount={openIssueCount}
            isLoadingIssueCount={isLoadingIssueCount}
          />
        )}

        <div className="mt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              {isLoadingBranches || isLoadingInfo ? (
                <div className="h-8.5 w-30 bg-secondary/50 animate-pulse" />
              ) : (
                <BranchSelector
                  branches={branches}
                  currentBranch={currentBranch}
                  defaultBranch={defaultBranch}
                />
              )}
              {isLoadingInfo || isLoadingCommitCount ? (
                <div className="h-5 w-28 bg-secondary/50 animate-pulse" />
              ) : (
                <Link
                  to="/$username/$repo/commits/$branch"
                  params={{ username, repo: repoName, branch: currentBranch }}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <HugeiconsIcon icon={WorkHistoryIcon} strokeWidth={2} className="size-4" />
                  <span className="font-mono flex items-center gap-2">
                    {isLoadingCommitCount ? (
                      <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 animate-spin" />
                    ) : (
                      commitCount
                    )}{" "}
                    commits
                  </span>
                </Link>
              )}
            </div>

            <CloneUrl username={username} repoName={repo?.name || repoName} />
          </div>

          <Tabs value={currentTab}>
            <TabsList className="w-full justify-start h-auto gap-2">
              <Link to="/$username/$repo" params={{ username, repo: repoName }}>
                <TabsTrigger value="code" className="gap-2 text-sm">
                  <HugeiconsIcon icon={CodeIcon} strokeWidth={2} className="size-4" />
                  <span>Code</span>
                </TabsTrigger>
              </Link>
              <Link to="/$username/$repo/issues" params={{ username, repo: repoName }}>
                <TabsTrigger value="issues" className="gap-2 text-sm">
                  <HugeiconsIcon icon={RecordIcon} strokeWidth={2} className="size-4" />
                  <span>Issues</span>
                  {openIssueCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-secondary text-secondary-foreground">
                      {openIssueCount}
                    </span>
                  )}
                </TabsTrigger>
              </Link>
              <Link
                to="/$username/$repo/commits/$branch"
                params={{ username, repo: repoName, branch: currentBranch }}
              >
                <TabsTrigger value="commits" className="gap-2 text-sm">
                  <HugeiconsIcon icon={WorkHistoryIcon} strokeWidth={2} className="size-4" />
                  <span>Commits</span>
                </TabsTrigger>
              </Link>
              {isOwner && (
                <Link to="/$username/$repo/settings" params={{ username, repo: repoName }}>
                  <TabsTrigger value="settings" className="gap-2 text-sm">
                    <HugeiconsIcon icon={SettingsIcon} strokeWidth={2} className="size-4" />
                    <span>Settings</span>
                  </TabsTrigger>
                </Link>
              )}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Outlet />
    </div>
  );
}

function RepoHeader({
  repo,
  username,
  openIssueCount,
  isLoadingIssueCount,
}: {
  repo: any;
  username: string;
  openIssueCount: number;
  isLoadingIssueCount: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{repo.name}</h1>
            <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border border-border text-muted-foreground">
              {repo.visibility}
            </span>
          </div>
          {repo.description && <p className="text-muted-foreground max-w-2xl">{repo.description}</p>}
        </div>

        <div className="flex items-center gap-2">
          <StarButton repoId={repo.id} initialStarred={repo.starred} initialCount={repo.starCount} />
          <Button variant="secondary" size="sm" className="gap-1.5 border border-border">
            <HugeiconsIcon icon={GitForkIcon} strokeWidth={2} className="size-3.5" />
            <span>Fork</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <HugeiconsIcon icon={StarIcon} strokeWidth={2} className="size-4" />
          <span className="font-medium text-foreground">{repo.starCount}</span>
          <span>stars</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <HugeiconsIcon icon={GitForkIcon} strokeWidth={2} className="size-4" />
          <span className="font-medium text-foreground">0</span>
          <span>forks</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <HugeiconsIcon icon={EyeIcon} strokeWidth={2} className="size-4" />
          <span className="font-medium text-foreground">0</span>
          <span>watching</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <HugeiconsIcon icon={RecordIcon} strokeWidth={2} className="size-4" />
          <span className="font-medium text-foreground">
            {isLoadingIssueCount ? (
              <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 animate-spin inline" />
            ) : (
              openIssueCount
            )}
          </span>
          <span>issues</span>
        </div>
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

function RepoLayoutSkeleton() {
  return (
    <div className="container max-w-6xl px-4 py-4">
      <RepoHeaderSkeleton />
      <div className="mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8.5 w-30 bg-secondary/50 animate-pulse" />
            <div className="h-5 w-28 bg-secondary/50 animate-pulse" />
          </div>
          <div className="h-8 w-64 bg-secondary/50 animate-pulse" />
        </div>
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-20 bg-secondary/50 animate-pulse" />
          <div className="h-8 w-20 bg-secondary/50 animate-pulse" />
          <div className="h-8 w-24 bg-secondary/50 animate-pulse" />
        </div>
      </div>
      <div className="flex items-center justify-center py-12">
        <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
