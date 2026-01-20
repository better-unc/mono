"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons-pro/core-stroke-standard";
import { Button } from "@/components/ui/button";
import { useToggleStar } from "@gitbruv/hooks";
import { cn } from "@/lib/utils";

export function StarButton({
  repoId,
  initialStarred,
  initialCount,
  className,
}: {
  repoId: string;
  initialStarred: boolean;
  initialCount: number;
  className?: string;
}) {
  const [starred, setStarred] = useState(initialStarred);
  const [count, setCount] = useState(initialCount);
  const { mutate, isPending } = useToggleStar(repoId);

  async function handleClick() {
    mutate(undefined, {
      onSuccess: (result) => {
        if (result) {
          setStarred(result.starred);
          setCount((c) => (result.starred ? c + 1 : c - 1));
        }
      },
    });
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      className={cn("gap-2 border border-border transition-all", starred && "bg-primary/10 border-primary/30 hover:bg-primary/20 pr-0.75", className)}
    >
      <HugeiconsIcon icon={StarIcon} strokeWidth={2} className={cn("size-4", starred ? "text-primary" : "text-muted-foreground")} />
      <span>{starred ? "Starred" : "Star"}</span>
      <span className="font-mono text-xs px-1.5 py-0.5 bg-foreground/5">{count}</span>
    </Button>
  );
}
