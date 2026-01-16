import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useRepositoryWithStars, useRepoFile, useRepoBranches, useWordWrapPreference } from "@gitbruv/hooks";
import { ChunkedCodeViewer } from "@/components/chunked-code-viewer";
import { CodeViewer } from "@/components/code-viewer";
import { BranchSelector } from "@/components/branch-selector";
import { Badge } from "@/components/ui/badge";
import { Lock, Globe, ChevronRight, Home, FileCode, Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/_main/$username/$repo/blob/$")({
  component: BlobPage,
});

const LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  md: "markdown",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  css: "css",
  html: "html",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
};

const SMALL_FILE_THRESHOLD = 50 * 1024;

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return LANGUAGE_MAP[ext] || "text";
}

function CodeSkeleton() {
  return (
    <div className="p-6 md:p-8 space-y-3">
      <div className="h-6 w-3/4 bg-secondary/50" />
      <div className="h-4 w-full bg-secondary/50" />
      <div className="h-4 w-5/6 bg-secondary/50" />
      <div className="h-4 w-4/5 bg-secondary/50" />
      <div className="h-4 w-full bg-secondary/50" />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="container px-4 py-6">
      <div className="border border-border overflow-hidden">
        <div className="h-12 bg-card border-b border-border" />
        <CodeSkeleton />
      </div>
    </div>
  );
}

function BlobPage() {
  const { username, repo: repoName, _splat } = Route.useParams();
  const pathSegments = _splat ? _splat.split("/") : [];

  const branch = pathSegments[0] || "main";
  const filePath = pathSegments.slice(1).join("/");

  const { data: session } = useSession();
  const { data: wordWrapData } = useWordWrapPreference({ enabled: !!session?.user });

  const { data: repo, isLoading: repoLoading, error: repoError } = useRepositoryWithStars(username, repoName);
  const { data: branchesData, isLoading: branchesLoading } = useRepoBranches(username, repoName);
  const { data: fileData, isLoading: fileLoading, error: fileError } = useRepoFile(username, repoName, branch, filePath);

  if (repoLoading || branchesLoading) {
    return <PageSkeleton />;
  }

  if (repoError || !repo) {
    throw notFound();
  }

  const branches = branchesData?.branches || [];
  const pathParts = filePath.split("/").filter(Boolean);
  const fileName = pathParts[pathParts.length - 1];
  const language = getLanguage(fileName);
  const wordWrap = wordWrapData?.wordWrap ?? false;

  return (
    <div className="container px-4 py-6">
      {/* <div className="flex flex-col lg:flex-row items-start h-9 lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/$username" params={{ username }} className="text-primary hover:underline">
            <span className="text-xl font-bold">{username}</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link to="/$username/$repo" params={{ username, repo: repoName }} className="text-primary hover:underline">
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
      </div> */}

      <div className="border border-border overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
          <BranchSelector branches={branches} currentBranch={branch} username={username} repoName={repoName} />
        </div>
        <nav className="flex items-center gap-1 px-4 py-2 bg-muted/30 border-b border-border text-sm">
          <Link to="/$username/$repo" params={{ username, repo: repoName }} className="text-primary hover:underline flex items-center gap-1">
            <Home className="h-4 w-4" />
            {repoName}
          </Link>
          {pathParts.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
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

        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileCode className="h-4 w-4" />
            <span>{fileName}</span>
          </div>
        </div>

        {fileLoading ? (
          <CodeSkeleton />
        ) : fileError || !fileData ? (
          <div className="p-8 text-center text-muted-foreground">Failed to load file</div>
        ) : (
          (() => {
            const fileSize = new TextEncoder().encode(fileData.content).length;
            if (fileSize > SMALL_FILE_THRESHOLD) {
              return (
                <ChunkedCodeViewer
                  username={username}
                  repoName={repoName}
                  branch={branch}
                  filePath={filePath}
                  language={language}
                  initialContent={fileData.content}
                  totalSize={fileSize}
                  wordWrap={wordWrap}
                />
              );
            }
            return <CodeViewer content={fileData.content} language={language} showLineNumbers wordWrap={wordWrap} />;
          })()
        )}
      </div>
    </div>
  );
}
