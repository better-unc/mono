import { Link } from "@tanstack/react-router";
import { Folder, FileCode, FileText, FileJson, File, FileImage, FileAudio, FileVideo } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@gitbruv/lib";
import type { FileLastCommit } from "@gitbruv/hooks";

type FileEntry = {
  name: string;
  type: "blob" | "tree";
  oid: string;
  path: string;
};

type FileTreeProps = {
  files: FileEntry[];
  username: string;
  repoName: string;
  branch: string;
  basePath?: string;
  commits?: FileLastCommit[];
  isLoadingCommits?: boolean;
};

const FILE_ICONS: Record<string, React.ElementType> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  py: FileCode,
  rb: FileCode,
  go: FileCode,
  rs: FileCode,
  java: FileCode,
  c: FileCode,
  cpp: FileCode,
  h: FileCode,
  hpp: FileCode,
  cs: FileCode,
  php: FileCode,
  sh: FileCode,
  md: FileText,
  txt: FileText,
  json: FileJson,
  yaml: FileJson,
  yml: FileJson,
  toml: FileJson,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  svg: FileImage,
  webp: FileImage,
  mp3: FileAudio,
  wav: FileAudio,
  mp4: FileVideo,
  mov: FileVideo,
};

function getFileIcon(name: string, type: "blob" | "tree") {
  if (type === "tree") return Folder;
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || File;
}

function truncateMessage(message: string, maxLength = 50): string {
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength).trim() + "...";
}

export function FileTree({ files, username, repoName, branch, basePath, commits, isLoadingCommits }: FileTreeProps) {
  const folders = files.filter((f) => f.type === "tree").sort((a, b) => a.name.localeCompare(b.name));
  const fileItems = files.filter((f) => f.type === "blob").sort((a, b) => a.name.localeCompare(b.name));
  const sortedFiles = [...folders, ...fileItems];

  const commitsByPath = commits?.reduce((acc, commit) => {
    acc[commit.path] = commit;
    return acc;
  }, {} as Record<string, FileLastCommit>) ?? {};

  return (
    <div className="divide-y divide-border">
      {sortedFiles.map((file) => {
        const Icon = getFileIcon(file.name, file.type);
        const route = file.type === "tree" ? ("/$username/$repo/tree/$" as const) : ("/$username/$repo/blob/$" as const);
        const splat = `${branch}/${file.path}`;
        const commit = commitsByPath[file.path];

        return (
          <Link
            key={file.oid + file.name}
            to={route}
            params={{ username, repo: repoName, _splat: splat }}
            className="flex items-center gap-3 px-5 py-2.5 hover:bg-secondary/50 transition-colors group"
          >
            <Icon className={cn("h-4 w-4 shrink-0 text-muted-foreground")} />
            <span className={cn("text-sm min-w-0 truncate", "w-[180px] sm:w-[200px] shrink-0")}>{file.name}</span>
            
            <div className="hidden md:flex flex-1 items-center gap-3 min-w-0">
              {isLoadingCommits ? (
                <div className="h-4 w-48 bg-secondary/50 animate-pulse rounded" />
              ) : commit ? (
                <span className="text-sm text-muted-foreground truncate">
                  {truncateMessage(commit.message)}
                </span>
              ) : null}
            </div>
            
            <div className="hidden sm:block shrink-0 text-right">
              {isLoadingCommits ? (
                <div className="h-4 w-16 bg-secondary/50 animate-pulse rounded ml-auto" />
              ) : commit ? (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {timeAgo(commit.timestamp)}
                </span>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
