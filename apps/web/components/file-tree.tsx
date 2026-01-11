import { Link } from "@tanstack/react-router"
import { Folder, FileCode, FileText, FileJson, File, FileImage, FileAudio, FileVideo, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type FileEntry = {
  name: string
  type: "blob" | "tree"
  oid: string
  path: string
}

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
}

function getFileIcon(name: string, type: "blob" | "tree") {
  if (type === "tree") return Folder
  const ext = name.split(".").pop()?.toLowerCase() || ""
  return FILE_ICONS[ext] || File
}

export function FileTree({
  files,
  username,
  repoName,
  branch,
  basePath = "",
}: {
  files: FileEntry[]
  username: string
  repoName: string
  branch: string
  basePath?: string
}) {
  const folders = files.filter(f => f.type === "tree").sort((a, b) => a.name.localeCompare(b.name))
  const fileItems = files.filter(f => f.type === "blob").sort((a, b) => a.name.localeCompare(b.name))
  const sortedFiles = [...folders, ...fileItems]

  return (
    <div className="divide-y divide-border">
      {sortedFiles.map((file) => {
        const Icon = getFileIcon(file.name, file.type)
        const route =
          file.type === "tree"
            ? ("/$username/$repo/tree/$" as const)
            : ("/$username/$repo/blob/$" as const)
        const splat = `${branch}/${file.path}`

        return (
          <Link
            key={file.oid + file.name}
            to={route}
            params={{ username, repo: repoName, _splat: splat }}
            className="flex items-center gap-3 px-5 py-2.5 hover:bg-secondary/50 transition-colors group"
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                file.type === "tree" ? "text-primary" : "text-muted-foreground"
              )}
            />
            <span className={cn(
              "text-sm flex-1",
              file.type === "tree" ? "font-medium" : ""
            )}>
              {file.name}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        )
      })}
    </div>
  )
}
