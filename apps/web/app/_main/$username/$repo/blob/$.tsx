import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useRepositoryWithStars, useRepoFile, useWordWrapPreference } from "@gitbruv/hooks";
import { ChunkedCodeViewer } from "@/components/chunked-code-viewer";
import { CodeViewer } from "@/components/code-viewer";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, HomeIcon, CodeIcon } from "@hugeicons-pro/core-stroke-standard";
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
  const { data: fileData, isLoading: fileLoading, error: fileError } = useRepoFile(username, repoName, branch, filePath);

  if (repoLoading) {
    return <PageSkeleton />;
  }

  if (repoError || !repo) {
    throw notFound();
  }

  const pathParts = filePath.split("/").filter(Boolean);
  const fileName = pathParts[pathParts.length - 1];
  const language = getLanguage(fileName);
  const wordWrap = wordWrapData?.wordWrap ?? false;

  return (
    <div className="container max-w-6xl px-4">
      <div className="border border-border overflow-hidden">
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

        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HugeiconsIcon icon={CodeIcon} strokeWidth={2} className="size-4" />
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
