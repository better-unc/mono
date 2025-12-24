import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import {
  useRepoPageData,
  useRepoCommitCount,
  useRepoReadme,
} from "@/lib/hooks/use-repositories"
import { FileTree } from "@/components/file-tree"
import { CodeViewer } from "@/components/code-viewer"
import { CloneUrl } from "@/components/clone-url"
import { StarButton } from "@/components/star-button"
import { BranchSelector } from "@/components/branch-selector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Lock,
  Globe,
  FileCode,
  Settings,
  GitCommit,
  GitBranch,
  Loader2,
} from "lucide-react"
import { getPublicServerUrl } from "@/lib/utils"

export const Route = createFileRoute("/_main/$username/$repo/")({
  component: RepoPage,
})

function CommitCount({
  username,
  repoName,
  branch,
}: {
  username: string
  repoName: string
  branch: string
}) {
  const { data, isLoading } = useRepoCommitCount(username, repoName, branch)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <GitCommit className="h-4 w-4" />
        <Loader2 className="h-3 w-3 animate-spin" />
      </div>
    )
  }

  if (!data || data.count === 0) return null

  return (
    <Link
      to="/$username/$repo/commits/$branch"
      params={{ username, repo: repoName, branch }}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <GitCommit className="h-4 w-4" />
      <span className="font-medium">{data.count}</span>
      <span className="hidden sm:inline">commits</span>
    </Link>
  )
}

function ReadmeSection({
  username,
  repoName,
  readmeOid,
}: {
  username: string
  repoName: string
  readmeOid: string
}) {
  const { data, isLoading } = useRepoReadme(username, repoName, readmeOid)

  if (isLoading) {
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
    )
  }

  if (!data?.content) return null

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
        <FileCode className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">README.md</span>
      </div>
      <div className="p-6">
        <CodeViewer content={data.content} language="markdown" />
      </div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="container px-4 py-6">
      <div className="flex flex-col lg:flex-row items-start h-9 lg:items-center justify-between gap-4 mb-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 bg-muted rounded animate-pulse" />
          <div className="h-8 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="h-12 bg-card border-b border-border" />
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
        <aside>
          <div className="border border-border rounded-lg p-4">
            <div className="h-5 w-16 bg-muted rounded animate-pulse mb-3" />
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
          </div>
        </aside>
      </div>
    </div>
  )
}

function EmptyRepoGuide({
  username,
  repoName,
}: {
  username: string
  repoName: string
}) {
  const cloneUrl = `${getPublicServerUrl()}/api/git/${username}/${repoName}.git`

  return (
    <div className="p-6 space-y-6">
      <div className="text-center py-8">
        <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">This repository is empty</h3>
        <p className="text-muted-foreground">
          Get started by cloning or pushing to this repository.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">
            Create a new repository on the command line
          </h4>
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
          <h4 className="text-sm font-medium mb-2">
            Push an existing repository from the command line
          </h4>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
            <code>{`git remote add origin ${cloneUrl}
git branch -M main
git push -u origin main`}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}

function RepoPage() {
  const { username, repo: repoName } = Route.useParams()
  const { data, isLoading, error } = useRepoPageData(username, repoName)

  if (isLoading) {
    return <PageSkeleton />
  }

  if (error || !data) {
    throw notFound()
  }

  const { repo, files, isEmpty, branches, readmeOid, isOwner } = data

  return (
    <div className="container px-4 py-6">
      <div className="flex flex-col lg:flex-row items-start h-9 lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/$username"
            params={{ username }}
            className="text-accent hover:underline"
          >
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
          <StarButton
            repoId={repo.id}
            initialStarred={repo.starred}
            initialCount={repo.starCount}
          />
          <CloneUrl username={username} repoName={repo.name} />
          {isOwner && (
            <Button variant="outline" size="sm" asChild>
              <Link
                to="/$username/$repo/settings"
                params={{ username, repo: repo.name }}
              >
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
              <BranchSelector
                branches={branches}
                currentBranch={repo.defaultBranch}
                username={username}
                repoName={repo.name}
              />
              <CommitCount
                username={username}
                repoName={repoName}
                branch={repo.defaultBranch}
              />
            </div>

            {isEmpty ? (
              <EmptyRepoGuide username={username} repoName={repo.name} />
            ) : (
              <FileTree
                files={files}
                username={username}
                repoName={repo.name}
                branch={repo.defaultBranch}
              />
            )}
          </div>

          {readmeOid && (
            <ReadmeSection
              username={username}
              repoName={repoName}
              readmeOid={readmeOid}
            />
          )}
        </div>

        <aside className="space-y-6">
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-3">About</h3>
            <p className="text-sm text-muted-foreground">
              {repo.description || "No description provided."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

