import { notFound } from "next/navigation";
import Link from "next/link";
import { getRepository, getRepoFile } from "@/actions/repositories";
import { CodeViewer } from "@/components/code-viewer";
import { Badge } from "@/components/ui/badge";
import { Lock, Globe, ChevronRight, Home, FileCode } from "lucide-react";

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

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return LANGUAGE_MAP[ext] || "text";
}

export default async function BlobPage({ params }: { params: Promise<{ username: string; repo: string; path: string[] }> }) {
  const { username, repo: repoName, path: pathSegments } = await params;
  const branch = pathSegments[0];
  const filePath = pathSegments.slice(1).join("/");

  const repo = await getRepository(username, repoName);

  if (!repo) {
    notFound();
  }

  const file = await getRepoFile(username, repoName, branch, filePath);

  if (!file) {
    notFound();
  }

  const pathParts = filePath.split("/").filter(Boolean);
  const fileName = pathParts[pathParts.length - 1];
  const language = getLanguage(fileName);
  const lineCount = file.content.split("\n").length;

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
        <nav className="flex items-center gap-1 px-4 py-2 bg-card border-b border-border text-sm">
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
            <span>{lineCount} lines</span>
          </div>
        </div>

        <CodeViewer content={file.content} language={language} showLineNumbers />
      </div>
    </div>
  );
}
