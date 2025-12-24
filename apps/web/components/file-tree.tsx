import { Link } from "@tanstack/react-router"
import { Folder, FileCode, FileText, FileJson, File } from "lucide-react"

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
  md: FileText,
  txt: FileText,
  json: FileJson,
  yaml: FileJson,
  yml: FileJson,
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
  return (
    <div className="divide-y divide-border">
      {files.map((file) => {
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
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors group"
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${file.type === "tree" ? "text-accent" : "text-muted-foreground"}`}
            />
            <span className="text-sm group-hover:text-accent truncate min-w-0">
              {file.name}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
