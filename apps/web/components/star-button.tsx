"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons-pro/core-stroke-standard";
import { StarIcon as StarIconFill } from "@hugeicons-pro/core-solid-standard";
import { useToggleStar } from "@gitbruv/hooks";
import { Button } from "@/components/ui/button";
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

  function handleClick() {
    mutate(undefined, {
      onSuccess: (result) => {
        setStarred(result.starred);
        setCount((c) => (result.starred ? c + 1 : c - 1));
      },
    });
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      className={cn("gap-2 pr-[4px]", starred && "bg-primary/20 hover:bg-primary/40", className)}
    >
      <HugeiconsIcon icon={starred ? StarIconFill : StarIcon} strokeWidth={2} className={cn("size-3.5", starred ? "text-primary" : "text-muted-foreground")} />
      <span>{starred ? "Starred" : "Star"}</span>
      <span className="font-mono text-[10px] px-1.5 py-0.5 bg-foreground/5">{count}</span>
    </Button>
  );
}
