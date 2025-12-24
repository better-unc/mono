import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { GitBranch, Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function BranchSelector({
  branches,
  currentBranch,
  username,
  repoName,
  basePath = "",
}: {
  branches: string[]
  currentBranch: string
  username: string
  repoName: string
  basePath?: string
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  function handleSelect(branch: string) {
    setOpen(false)
    if (branch === currentBranch) return

    const splat = basePath ? `${branch}/${basePath}` : branch
    navigate({
      to: "/$username/$repo/tree/$",
      params: { username, repo: repoName, _splat: splat },
    })
  }

  if (branches.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <GitBranch className="h-4 w-4" />
        {currentBranch}
      </Button>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <GitBranch className="h-4 w-4" />
          <span className="max-w-[120px] truncate">{currentBranch}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Switch branches
        </div>
        {branches.map((branch) => (
          <DropdownMenuItem
            key={branch}
            onClick={() => handleSelect(branch)}
            className={cn(
              "cursor-pointer gap-2",
              branch === currentBranch && "bg-accent/10"
            )}
          >
            <Check
              className={cn(
                "h-4 w-4",
                branch === currentBranch ? "opacity-100" : "opacity-0"
              )}
            />
            <span className="truncate">{branch}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
