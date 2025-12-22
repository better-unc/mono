import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { getRepository, getRepoFile, getRepoBranches } from "@/actions/repositories";
import { ChunkedCodeViewer } from "@/components/chunked-code-viewer";
import { CodeViewer } from "@/components/code-viewer";
import { BranchSelector } from "@/components/branch-selector";
import { Badge } from "@/components/ui/badge";
import { Lock, Globe, ChevronRight, Home, FileCode, Loader2 } from "lucide-react";

export const revalidate = 3600;

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

async function FileContent({ username, repoName, branch, filePath }: { username: string; repoName: string; branch: string; filePath: string }) {
  await connection();
  const file = await getRepoFile(username, repoName, branch, filePath);

  if (!file) {
    notFound();
  }

  const fileName = filePath.split("/").pop() || "";
  const language = getLanguage(fileName);
  const fileSize = new TextEncoder().encode(file.content).length;

  if (fileSize > SMALL_FILE_THRESHOLD) {
    return (
      <ChunkedCodeViewer
        username={username}
        repoName={repoName}
        branch={branch}
        filePath={filePath}
        language={language}
        initialContent={file.content}
        totalSize={fileSize}
      />
    );
  }

  return <CodeViewer content={file.content} language={language} showLineNumbers />;
}

function CodeSkeleton() {
  return (
    <div className="p-4 min-h-[400px] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default async function BlobPage({ params }: { params: Promise<{ username: string; repo: string; path: string[] }> }) {
  const { username, repo: repoName, path: pathSegments } = await params;
  const branch = pathSegments[0];
  const filePath = pathSegments.slice(1).join("/");

  const [repo, branches] = await Promise.all([getRepository(username, repoName), getRepoBranches(username, repoName)]);

  if (!repo) {
    notFound();
  }

  const pathParts = filePath.split("/").filter(Boolean);
  const fileName = pathParts[pathParts.length - 1];

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
          <BranchSelector branches={branches} currentBranch={branch} username={username} repoName={repoName} />
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

        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileCode className="h-4 w-4" />
            <span>{fileName}</span>
          </div>
        </div>

        <Suspense fallback={<CodeSkeleton />}>
          <FileContent username={username} repoName={repoName} branch={branch} filePath={filePath} />
        </Suspense>
      </div>
    </div>
  );
}
