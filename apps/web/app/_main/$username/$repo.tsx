import { Suspense, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, Link, Outlet, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import {
  CodeIcon,
  GitForkIcon,
  Loading02Icon,
  RecordIcon,
  SettingsIcon,
  WorkHistoryIcon,
} from "@hugeicons-pro/core-stroke-standard";
import { useForkRepository, useIssueCount, useRepoBranches, useRepoCommitCount, useRepositoryInfo } from "@gitbruv/hooks";
import { BranchSelector } from "@/components/branch-selector";
import { CloneUrl } from "@/components/clone-url";
import { StarButton } from "@/components/star-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";


function getBranchFromPath(pathname: string, defaultBranch: string): string {
  const treeMatch = pathname.match(/\/tree\/([^/]+)/);
  if (treeMatch) return treeMatch[1];

  const blobMatch = pathname.match(/\/blob\/([^/]+)/);
  if (blobMatch) return blobMatch[1];

  const commitsMatch = pathname.match(/\/commits\/([^/]+)/);
  if (commitsMatch) return commitsMatch[1];

  return defaultBranch;
}

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
  const navigate = useNavigate();

  const { data: repoInfo, isLoading: isLoadingInfo } = useRepositoryInfo(username, repoName);
  const { data: branchesData, isLoading: isLoadingBranches } = useRepoBranches(username, repoName);
  const { data: issueCountData } = useIssueCount(username, repoName);
  const forkMutation = useForkRepository(username, repoName);

  const repo = repoInfo?.repo;
  const isOwner = repoInfo?.isOwner ?? false;
  const defaultBranch = repo?.defaultBranch || "main";
  const currentBranch = getBranchFromPath(location.pathname, defaultBranch);
  const branches = branchesData?.branches || [];
  const openIssueCount = issueCountData?.open || 0;

  const { data: commitCountData } = useRepoCommitCount(username, repoName, currentBranch);
  const commitCount = commitCountData?.count || 0;

  const pathname = location.pathname;
  const isIssues = pathname.includes("/issues") || pathname.includes("/labels");
  const isCommits = pathname.includes("/commits");
  const isSettings = pathname.includes("/settings");

  const currentTab = isSettings ? "settings" : isCommits ? "commits" : isIssues ? "issues" : "code";
  const forkCount = repo?.forkCount ?? 0;
  const [isForkDialogOpen, setIsForkDialogOpen] = useState(false);
  const [forkName, setForkName] = useState("");

  useEffect(() => {
    if (repo?.name) {
      setForkName(repo.name);
    }
  }, [repo?.name]);

  function handleForkSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = forkName.trim().toLowerCase().replace(/ /g, "-");
    if (!trimmed) {
      toast.error("Repository name is required");
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      toast.error("Invalid repository name");
      return;
    }
    forkMutation.mutate({ name: trimmed }, {
      onSuccess: (result) => {
        const forkRepo = result.repo;
        toast.success("Repository forked");
        setIsForkDialogOpen(false);
        navigate({
          to: "/$username/$repo",
          params: {
            username: forkRepo.owner.username,
            repo: forkRepo.name,
          },
        });
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to fork repository");
      },
    });
  }

  return (
    <div>
      <div className="container max-w-6xl px-4 py-4 space-y-4">
        {isLoadingInfo || !repo ? (
          <RepoHeaderSkeleton />
        ) : (
          <>
            <RepoHeader
              repo={repo}
              forkCount={forkCount}
              onFork={() => setIsForkDialogOpen(true)}
              isForking={forkMutation.isPending}
            />
            {repo.description && (
              <p className="text-sm text-muted-foreground">{repo.description}</p>
            )}
            {repo.forkedFrom && (
              <p className="text-xs text-muted-foreground">
                Forked from{" "}
                <Link
                  to="/$username/$repo"
                  params={{ username: repo.forkedFrom.owner.username, repo: repo.forkedFrom.name }}
                  className="text-primary hover:underline"
                >
                  {repo.forkedFrom.owner.username}/{repo.forkedFrom.name}
                </Link>
              </p>
            )}
          </>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
          <Tabs value={currentTab}>
            <TabsList className="h-auto gap-1 bg-transparent p-0">
              <Link to="/$username/$repo" params={{ username, repo: repoName }}>
                <TabsTrigger value="code" className="gap-1.5 text-sm px-3 py-1.5 data-[state=active]:bg-secondary">
                  <HugeiconsIcon icon={CodeIcon} strokeWidth={2} className="size-4" />
                  <span>Code</span>
                </TabsTrigger>
              </Link>
              <Link to="/$username/$repo/issues" params={{ username, repo: repoName }}>
                <TabsTrigger value="issues" className="gap-1.5 text-sm px-3 py-1.5 data-[state=active]:bg-secondary">
                  <HugeiconsIcon icon={RecordIcon} strokeWidth={2} className="size-4" />
                  <span>Issues</span>
                  {openIssueCount > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-muted ">
                      {openIssueCount}
                    </span>
                  )}
                </TabsTrigger>
              </Link>
              <Link
                to="/$username/$repo/commits/$branch"
                params={{ username, repo: repoName, branch: currentBranch }}
              >
                <TabsTrigger value="commits" className="gap-1.5 text-sm px-3 py-1.5 data-[state=active]:bg-secondary">
                  <HugeiconsIcon icon={WorkHistoryIcon} strokeWidth={2} className="size-4" />
                  <span>Commits</span>
                  {commitCount > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-muted ">
                      {commitCount}
                    </span>
                  )}
                </TabsTrigger>
              </Link>
              {isOwner && (
                <Link to="/$username/$repo/settings" params={{ username, repo: repoName }}>
                  <TabsTrigger value="settings" className="gap-1.5 text-sm px-3 py-1.5 data-[state=active]:bg-secondary">
                    <HugeiconsIcon icon={SettingsIcon} strokeWidth={2} className="size-4" />
                    <span>Settings</span>
                  </TabsTrigger>
                </Link>
              )}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            {isLoadingBranches || isLoadingInfo ? (
              <div className="h-8 w-24 bg-secondary/50 animate-pulse " />
            ) : (
              <BranchSelector
                branches={branches}
                currentBranch={currentBranch}
                defaultBranch={defaultBranch}
                username={username}
                repoName={repo?.name || repoName}
              />
            )}
            <CloneUrl username={username} repoName={repo?.name || repoName} />
          </div>
        </div>
      </div>

      <Outlet />

      <Dialog open={isForkDialogOpen} onOpenChange={setIsForkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fork repository</DialogTitle>
            <DialogDescription>Choose a name for your fork.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleForkSubmit}>
            <div className="space-y-2">
              <Label htmlFor="fork-name">Repository name</Label>
              <Input
                id="fork-name"
                value={forkName}
                onChange={(e) => setForkName(e.target.value)}
                placeholder="my-fork"
                pattern="^[a-zA-Z0-9_.-]+$"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsForkDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={forkMutation.isPending || !forkName.trim()}>
                {forkMutation.isPending ? "Forking..." : "Fork"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RepoHeader({
  repo,
  forkCount,
  onFork,
  isForking,
}: {
  repo: any;
  forkCount: number;
  onFork: () => void;
  isForking: boolean;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-xl font-semibold tracking-tight truncate">{repo.name}</h1>
        <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border border-border/50 text-muted-foreground shrink-0">
          {repo.visibility}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StarButton repository={repo} />
        <Button variant="secondary" size="sm" className="gap-1.5 pr-[4px]" onClick={onFork} disabled={isForking}>
          <HugeiconsIcon icon={GitForkIcon} strokeWidth={2} className="size-3.5" />
          <span>Fork</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 bg-foreground/5">{forkCount}</span>
        </Button>
      </div>
    </div>
  );
}

function RepoHeaderSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-32 bg-secondary/50 " />
          <div className="h-5 w-14 bg-secondary/50 " />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 bg-secondary/50 " />
          <div className="h-8 w-16 bg-secondary/50 " />
        </div>
      </div>
      <div className="h-4 w-48 bg-secondary/50 " />
    </div>
  );
}

function RepoLayoutSkeleton() {
  return (
    <div className="container max-w-6xl px-4 py-4 space-y-4">
      <RepoHeaderSkeleton />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/40 animate-pulse">
        <div className="flex items-center gap-1">
          <div className="h-8 w-16 bg-secondary/50 " />
          <div className="h-8 w-16 bg-secondary/50 " />
          <div className="h-8 w-20 bg-secondary/50 " />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-secondary/50 " />
          <div className="h-8 w-32 bg-secondary/50 " />
        </div>
      </div>
      <div className="flex items-center justify-center py-12">
        <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
