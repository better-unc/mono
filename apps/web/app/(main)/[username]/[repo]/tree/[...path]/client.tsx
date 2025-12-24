"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { useRepositoryWithStars, useRepoTree, useRepoBranches } from "@/lib/hooks/use-repositories";
import { FileTree } from "@/components/file-tree";
import { BranchSelector } from "@/components/branch-selector";
import { Badge } from "@/components/ui/badge";
import { Lock, Globe, ChevronRight, Home, Loader2 } from "lucide-react";

function TreeSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5 animate-pulse">
          <div className="h-4 w-4 bg-muted rounded" />
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="h-4 bg-muted rounded w-1/3 ml-auto hidden sm:block" />
          <div className="h-4 bg-muted rounded w-20" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="container px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="h-12 bg-card border-b border-border" />
        <TreeSkeleton />
      </div>
    </div>
  );
}

export function TreePageClient({ username, repoName, pathSegments }: { username: string; repoName: string; pathSegments: string[] }) {
  const branch = pathSegments[0];
  const dirPath = pathSegments.slice(1).join("/");

  const { data: repo, isLoading: repoLoading, error: repoError } = useRepositoryWithStars(username, repoName);
  const { data: branchesData, isLoading: branchesLoading } = useRepoBranches(username, repoName);
  const { data: treeData, isLoading: treeLoading, error: treeError } = useRepoTree(username, repoName, branch, dirPath);

  if (repoLoading || branchesLoading) {
    return <PageSkeleton />;
  }

  if (repoError || !repo) {
    notFound();
  }

  const branches = branchesData?.branches || [];
  const pathParts = dirPath.split("/").filter(Boolean);

  return (
    <div className="container px-4 py-6">
      <div className="flex flex-col lg:flex-row items-start h-9 lg:items-center justify-between gap-4 mb-6">
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
        <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
          <BranchSelector branches={branches} currentBranch={branch} username={username} repoName={repoName} basePath={dirPath} />
        </div>

        <nav className="flex items-center gap-1 px-4 py-2 bg-muted/30 border-b border-border text-sm">
          <Link href={`/${username}/${repoName}`} className="text-accent hover:underline flex items-center gap-1">
            <Home className="h-4 w-4" />
            {repoName}
          </Link>
          {pathParts.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {i === pathParts.length - 1 ? (
                <span className="font-medium">{part}</span>
              ) : (
                <Link href={`/${username}/${repoName}/tree/${branch}/${pathParts.slice(0, i + 1).join("/")}`} className="text-accent hover:underline">
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

