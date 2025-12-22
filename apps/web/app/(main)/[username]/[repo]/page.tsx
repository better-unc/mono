import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getRepoPageData, getRepoReadme, getRepoCommitCountCached } from "@/actions/repositories";
import { FileTree } from "@/components/file-tree";
import { CodeViewer } from "@/components/code-viewer";
import { CloneUrl } from "@/components/clone-url";
import { StarButton } from "@/components/star-button";
import { BranchSelector } from "@/components/branch-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Globe, FileCode, Settings, GitCommit, GitBranch, Loader2 } from "lucide-react";
import Link from "next/link";
import { getPublicServerUrl } from "@/lib/utils";

export const revalidate = 60;

async function CommitCount({ username, repoName, branch }: { username: string; repoName: string; branch: string }) {
  await connection();
  const commitCount = await getRepoCommitCountCached(username, repoName);

  if (commitCount === 0) return null;

  return (
    <Link
      href={`/${username}/${repoName}/commits/${branch}`}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <GitCommit className="h-4 w-4" />
      <span className="font-medium">{commitCount}</span>
      <span className="hidden sm:inline">commits</span>
    </Link>
  );
}

async function ReadmeSection({ username, repoName, readmeOid }: { username: string; repoName: string; readmeOid: string }) {
  await connection();
  const content = await getRepoReadme(username, repoName, readmeOid);

  if (!content) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
        <FileCode className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">README.md</span>
      </div>
      <div className="p-6">
        <CodeViewer content={content} language="markdown" />
      </div>
    </div>
  );
}

function ReadmeSkeleton() {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
        <FileCode className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">README.md</span>
      </div>
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

function CommitCountSkeleton() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <GitCommit className="h-4 w-4" />
      <Loader2 className="h-3 w-3 animate-spin" />
    </div>
  );
}

export default async function RepoPage({ params }: { params: Promise<{ username: string; repo: string }> }) {
  const { username, repo: repoName } = await params;

  const data = await getRepoPageData(username, repoName);

  if (!data) {
    notFound();
  }

  const { repo, files, isEmpty, branches, readmeOid, isOwner } = data;

  return (
    <div className="container px-4 py-6">
      <div className="flex flex-col lg:flex-row items-start h-9 lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/${username}`} className="text-accent hover:underline">
            <span className="text-xl font-bold">{username}</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <div className="text-foreground">
            <span className="text-xl font-bold">{repo.name}</span>
          </div>
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
        <div className="flex items-center gap-2">
          <StarButton repoId={repo.id} initialStarred={repo.starred} initialCount={repo.starCount} />
          <CloneUrl username={username} repoName={repo.name} />
          {isOwner && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${username}/${repo.name}/settings`}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-4 py-3 bg-card border-b border-border">
              <BranchSelector branches={branches} currentBranch={repo.defaultBranch} username={username} repoName={repo.name} />
              <Suspense fallback={<CommitCountSkeleton />}>
                <CommitCount username={username} repoName={repoName} branch={repo.defaultBranch} />
              </Suspense>
            </div>

            {isEmpty ? (
              <EmptyRepoGuide username={username} repoName={repo.name} />
            ) : (
              <FileTree files={files} username={username} repoName={repo.name} branch={repo.defaultBranch} />
            )}
          </div>

          {readmeOid && (
            <Suspense fallback={<ReadmeSkeleton />}>
              <ReadmeSection username={username} repoName={repoName} readmeOid={readmeOid} />
            </Suspense>
          )}
        </div>

        <aside className="space-y-6">
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-3">About</h3>
            <p className="text-sm text-muted-foreground">{repo.description || "No description provided."}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EmptyRepoGuide({ username, repoName }: { username: string; repoName: string }) {
  const cloneUrl = `${getPublicServerUrl()}/api/git/${username}/${repoName}.git`;

  return (
    <div className="p-6 space-y-6">
      <div className="text-center py-8">
        <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">This repository is empty</h3>
        <p className="text-muted-foreground">Get started by cloning or pushing to this repository.</p>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Create a new repository on the command line</h4>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
            <code>{`echo "# ${repoName}" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin ${cloneUrl}
git push -u origin main`}</code>
          </pre>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Push an existing repository from the command line</h4>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
            <code>{`git remote add origin ${cloneUrl}
git branch -M main
git push -u origin main`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
