import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useRepositoryWithStars, useRepoTree, useRepoBranches } from "@gitbruv/hooks";
import { FileTree } from "@/components/file-tree";
import { BranchSelector } from "@/components/branch-selector";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockKeyIcon, GlobeIcon, ArrowRight01Icon, HomeIcon } from "@hugeicons-pro/core-stroke-standard";

export const Route = createFileRoute("/_main/$username/$repo/tree/$")({
  component: TreePage,
});

function TreeSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5 animate-pulse">
          <div className="h-4 w-4 bg-muted" />
          <div className="h-4 bg-muted w-1/4" />
          <div className="h-4 bg-muted w-1/3 ml-auto hidden sm:block" />
          <div className="h-4 bg-muted w-20" />
        </div>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="container px-4 py-6">
      <div className="border border-border overflow-hidden">
        <div className="h-12 bg-card border-b border-border" />
        <TreeSkeleton />
      </div>
    </div>
  );
}

function TreePage() {
  const { username, repo: repoName, _splat } = Route.useParams();
  const pathSegments = _splat ? _splat.split("/") : [];

  const branch = pathSegments[0] || "main";
  const dirPath = pathSegments.slice(1).join("/");

  const { data: repo, isLoading: repoLoading, error: repoError } = useRepositoryWithStars(username, repoName);
  const { data: branchesData, isLoading: branchesLoading } = useRepoBranches(username, repoName);
  const { data: treeData, isLoading: treeLoading, error: treeError } = useRepoTree(username, repoName, branch, dirPath);

  if (repoLoading || branchesLoading) {
    return <PageSkeleton />;
  }

  if (repoError || !repo) {
    throw notFound();
  }

  const branches = branchesData?.branches || [];
  const pathParts = dirPath.split("/").filter(Boolean);

  return (
    <div className="container px-4 py-6">
      <div className="border border-border overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
          <BranchSelector branches={branches} currentBranch={branch} username={username} repoName={repoName} basePath={dirPath} />
        </div>

        <nav className="flex items-center gap-1 px-4 py-2 bg-muted/30 border-b border-border text-sm">
          <Link to="/$username/$repo" params={{ username, repo: repoName }} className="text-primary hover:underline flex items-center gap-1">
            <HugeiconsIcon icon={HomeIcon} strokeWidth={2} className="size-4" />
            {repoName}
          </Link>
          {pathParts.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4 text-muted-foreground" />
              {i === pathParts.length - 1 ? (
                <span className="font-medium">{part}</span>
              ) : (
                <Link
                  to="/$username/$repo/tree/$"
                  params={{
                    username,
                    repo: repoName,
                    _splat: `${branch}/${pathParts.slice(0, i + 1).join("/")}`,
                  }}
                  className="text-accent hover:underline"
                >
                  {part}
                </Link>
              )}
            </span>
          ))}
        </nav>

        {treeLoading ? (
          <TreeSkeleton />
        ) : treeError || !treeData ? (
          <div className="p-8 text-center text-muted-foreground">Failed to load directory</div>
        ) : (
          <FileTree files={treeData.files} username={username} repoName={repoName} branch={branch} basePath={dirPath} />
        )}
      </div>
    </div>
  );
}
