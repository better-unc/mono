import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, RecordIcon } from "@hugeicons-pro/core-stroke-standard";
import { cn } from "@/lib/utils";

interface StateBadgeProps {
  state: "open" | "closed";
  className?: string;
}

export function StateBadge({ state, className }: StateBadgeProps) {
  const isOpen = state === "open";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium",
        isOpen ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-purple-500/10 text-purple-600 dark:text-purple-400",
        className
      )}
    >
      <HugeiconsIcon
        icon={isOpen ? RecordIcon : CheckmarkCircle02Icon}
        strokeWidth={2}
        className="size-3.5"
      />
      {isOpen ? "Open" : "Closed"}
    </span>
  );
}
