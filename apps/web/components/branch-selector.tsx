import { HugeiconsIcon } from "@hugeicons/react";
import { GitBranchIcon, CheckmarkCircleIcon, ArrowDown01Icon } from "@hugeicons-pro/core-stroke-standard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { buttonVariants } from "./ui/button";

export function BranchSelector({
  branches,
  currentBranch,
  defaultBranch,
}: {
  branches: string[];
  currentBranch: string;
  defaultBranch: string;
}) {
  const [, setBranch] = useQueryState("branch", parseAsStringLiteral([defaultBranch]).withDefault(defaultBranch));

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
              onClick={() => setBranch(branch)}
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
