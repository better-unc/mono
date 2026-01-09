"use client";

import { useState } from "react";
import { Star, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToggleStar } from "@/lib/hooks/use-repositories";
import { cn } from "@/lib/utils";
import { mutate } from "swr";

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
  const { trigger, isMutating } = useToggleStar(repoId);

  async function handleClick() {
    try {
      const result = await trigger();
      if (result) {
        setStarred(result.starred);
        setCount((c) => (result.starred ? c + 1 : c - 1));
        mutate((key) => typeof key === "string" && key.includes("/repositories"));
      }
    } catch {}
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleClick}
      disabled={isMutating}
      className={cn(
        "h-7 px-2.5 rounded-md border-r-0 text-xs font-semibold bg-secondary hover:bg-muted border border-border shadow-sm flex items-center gap-2",
        starred && "text-accent",
        className
      )}
    >
      <Star className={cn("h-3.5 w-3.5 text-muted-foreground", starred && "fill-accent text-accent")} />
      <span className="text-foreground">{starred ? "Starred" : "Star"}</span>
      <span className="px-1.5 py-0.5 rounded-full bg-muted-foreground/20 text-foreground font-medium text-[10px]">{count}</span>
    </Button>
  );
}
