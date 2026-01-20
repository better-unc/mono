import { HugeiconsIcon } from "@hugeicons/react";
import { GitBranchIcon, CheckmarkCircleIcon, ArrowDown01Icon } from "@hugeicons-pro/core-stroke-standard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";
import { useLocation, useNavigate } from "@tanstack/react-router";

type BranchSelectorProps = {
  branches: string[];
  currentBranch: string;
  defaultBranch: string;
  username: string;
  repoName: string;
};

type RouteContext = "root" | "tree" | "blob" | "commits";

function getRouteContext(pathname: string): RouteContext {
  if (pathname.includes("/tree/")) return "tree";
  if (pathname.includes("/blob/")) return "blob";
  if (pathname.includes("/commits/")) return "commits";
  return "root";
}

function getCurrentPath(pathname: string, context: RouteContext): string {
  if (context === "root" || context === "commits") return "";
  
  const match = pathname.match(/\/(tree|blob)\/[^/]+\/(.+)/);
  if (match) {
    return match[2];
  }
  return "";
}

export function BranchSelector({
  branches,
  currentBranch,
  defaultBranch,
  username,
  repoName,
}: BranchSelectorProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const context = getRouteContext(location.pathname);
  const currentPath = getCurrentPath(location.pathname, context);

  const handleBranchChange = (newBranch: string) => {
    if (newBranch === currentBranch) return;

    switch (context) {
      case "root":
        if (newBranch === defaultBranch) {
          navigate({
            to: "/$username/$repo",
            params: { username, repo: repoName },
          });
        } else {
          navigate({
            to: "/$username/$repo/tree/$",
            params: { username, repo: repoName, _splat: newBranch },
          });
        }
        break;
      case "tree":
        navigate({
          to: "/$username/$repo/tree/$",
          params: { 
            username, 
            repo: repoName, 
            _splat: currentPath ? `${newBranch}/${currentPath}` : newBranch,
          },
        });
        break;
      case "blob":
        navigate({
          to: "/$username/$repo/blob/$",
          params: { 
            username, 
            repo: repoName, 
            _splat: currentPath ? `${newBranch}/${currentPath}` : newBranch,
          },
        });
        break;
      case "commits":
        navigate({
          to: "/$username/$repo/commits/$branch",
          params: { username, repo: repoName, branch: newBranch },
        });
        break;
    }
  };

  if (branches.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 border border-border text-sm">
        <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} className="size-4 text-primary" />
        <span className="font-mono">{currentBranch}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "default" })}>
        <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} className="size-4 text-primary" />
        <span className="font-mono max-w-[120px] truncate">{currentBranch}</span>
        <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">Switch branch</div>
        <div className="max-h-[280px] overflow-y-auto py-1">
          {branches.map((branch) => (
            <DropdownMenuItem
              key={branch}
              onClick={() => handleBranchChange(branch)}
              className={cn("cursor-pointer px-3 py-2 text-sm font-mono", branch === currentBranch && "bg-primary/10")}
            >
              <HugeiconsIcon
                icon={CheckmarkCircleIcon}
                strokeWidth={2}
                className={cn("size-3.5 mr-2", branch === currentBranch ? "opacity-100 text-primary" : "opacity-0")}
              />
              <span className="truncate">{branch}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
