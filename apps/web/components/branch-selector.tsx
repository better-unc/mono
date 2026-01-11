import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GitBranch, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function BranchSelector({
  branches,
  currentBranch,
  username,
  repoName,
  basePath = "",
}: {
  branches: string[];
  currentBranch: string;
  username: string;
  repoName: string;
  basePath?: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleSelect(branch: string) {
    setOpen(false);
    if (branch === currentBranch) return;

    const splat = basePath ? `${branch}/${basePath}` : branch;
    navigate({
      to: "/$username/$repo/tree/$",
      params: { username, repo: repoName, _splat: splat },
    });
  }

  if (branches.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 border border-border text-sm">
        <GitBranch className="h-4 w-4 text-primary" />
        <span className="font-mono">{currentBranch}</span>
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 border border-border hover:border-primary/50 transition-colors text-sm">
        <GitBranch className="h-4 w-4 text-primary" />
        <span className="font-mono max-w-[120px] truncate">{currentBranch}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
          Switch branch
        </div>
        <div className="max-h-[280px] overflow-y-auto py-1">
          {branches.map((branch) => (
            <DropdownMenuItem
              key={branch}
              onClick={() => handleSelect(branch)}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm font-mono",
                branch === currentBranch && "bg-primary/10"
              )}
            >
              <Check className={cn("h-3.5 w-3.5 mr-2", branch === currentBranch ? "opacity-100 text-primary" : "opacity-0")} />
              <span className="truncate">{branch}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
