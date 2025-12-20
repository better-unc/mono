import { notFound } from "next/navigation";
import Link from "next/link";
import { getRepository, getRepoFileTree } from "@/actions/repositories";
import { FileTree } from "@/components/file-tree";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Lock, Globe, ChevronRight, Home } from "lucide-react";

export default async function TreePage({ params }: { params: Promise<{ username: string; repo: string; path: string[] }> }) {
  const { username, repo: repoName, path: pathSegments } = await params;
  const branch = pathSegments[0];
  const dirPath = pathSegments.slice(1).join("/");

  const repo = await getRepository(username, repoName);

  if (!repo) {
    notFound();
  }

  const fileTree = await getRepoFileTree(username, repoName, branch, dirPath);

  if (!fileTree) {
    notFound();
  }

  const pathParts = dirPath.split("/").filter(Boolean);

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
        <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{branch}</span>
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

        <FileTree files={fileTree.files} username={username} repoName={repoName} branch={branch} basePath={dirPath} />
      </div>
    </div>
  );
}
