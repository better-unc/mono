import { notFound } from "next/navigation";
import { getRepositoryWithStars, getRepoFileTree, getRepoFile, getRepoBranches, getRepoCommitCount } from "@/actions/repositories";
import { getSession } from "@/lib/session";
import { FileTree } from "@/components/file-tree";
import { CodeViewer } from "@/components/code-viewer";
import { CloneUrl } from "@/components/clone-url";
import { StarButton } from "@/components/star-button";
import { BranchSelector } from "@/components/branch-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Globe, FileCode, Settings, GitCommit, GitBranch } from "lucide-react";
import Link from "next/link";
import { getPublicServerUrl } from "@/lib/utils";

export default async function RepoPage({ params }: { params: Promise<{ username: string; repo: string }> }) {
  const { username, repo: repoName } = await params;

  const repo = await getRepositoryWithStars(username, repoName);

  if (!repo) {
    notFound();
  }

  const session = await getSession();
  const isOwner = session?.user?.id === repo.ownerId;

  const [fileTree, branches, commitCount] = await Promise.all([
    getRepoFileTree(username, repoName, repo.defaultBranch),
    getRepoBranches(username, repoName),
    getRepoCommitCount(username, repoName, repo.defaultBranch),
  ]);
  const readmeFile = fileTree?.files.find((f) => f.name.toLowerCase() === "readme.md" && f.type === "blob");

  let readmeContent = null;
  if (readmeFile) {
    const file = await getRepoFile(username, repoName, repo.defaultBranch, readmeFile.name);
    readmeContent = file?.content;
  }

  return (
    <div className="container px-4 py-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
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

      {repo.description && <p className="text-muted-foreground mb-6">{repo.description}</p>}

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-4 py-3 bg-card border-b border-border">
              <BranchSelector
                branches={branches}
                currentBranch={repo.defaultBranch}
                username={username}
                repoName={repo.name}
              />
              {commitCount > 0 && (
                <Link
                  href={`/${username}/${repo.name}/commits/${repo.defaultBranch}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <GitCommit className="h-4 w-4" />
                  <span className="font-medium">{commitCount}</span>
                  <span className="hidden sm:inline">commits</span>
                </Link>
              )}
            </div>

            {fileTree?.isEmpty ? (
              <EmptyRepoGuide username={username} repoName={repo.name} />
            ) : (
              <FileTree files={fileTree?.files || []} username={username} repoName={repo.name} branch={repo.defaultBranch} />
            )}
          </div>

          {readmeContent && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
                <FileCode className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">README.md</span>
              </div>
              <div className="p-6">
                <CodeViewer content={readmeContent} language="markdown" />
              </div>
            </div>
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
