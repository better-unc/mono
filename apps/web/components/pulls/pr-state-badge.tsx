import { HugeiconsIcon } from "@hugeicons/react";
import { GitMergeIcon, GitPullRequestIcon, GitPullRequestClosedIcon, GitPullRequestDraftIcon } from "@hugeicons-pro/core-stroke-standard";
import { cn } from "@/lib/utils";

interface PRStateBadgeProps {
  state: "open" | "closed" | "merged";
  merged?: boolean;
  isDraft?: boolean;
  className?: string;
}

export function PRStateBadge({ state, merged, isDraft, className }: PRStateBadgeProps) {
  const isMerged = merged || state === "merged";
  const isClosed = state === "closed" && !isMerged;
  const isOpen = state === "open";

  if (isMerged) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400",
          className
        )}
      >
        <HugeiconsIcon icon={GitMergeIcon} strokeWidth={2} className="size-3.5" />
        Merged
      </span>
    );
  }

  if (isClosed) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400",
          className
        )}
      >
        <HugeiconsIcon icon={GitPullRequestClosedIcon} strokeWidth={2} className="size-3.5" />
        Closed
      </span>
    );
  }

  if (isDraft) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400",
          className
        )}
      >
        <HugeiconsIcon icon={GitPullRequestDraftIcon} strokeWidth={2} className="size-3.5" />
        Draft
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400",
        className
      )}
    >
      <HugeiconsIcon icon={GitPullRequestIcon} strokeWidth={2} className="size-3.5" />
      Open
    </span>
  );
}
