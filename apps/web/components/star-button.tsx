"use client";

import { useState } from "react";
import { Star } from "lucide-react";
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
        "gap-2 border border-border transition-all",
        starred && "bg-primary/10 border-primary/30 hover:bg-primary/20",
        className
      )}
    >
      <Star className={cn("h-4 w-4", starred ? "fill-primary text-primary" : "text-muted-foreground")} />
      <span>{starred ? "Starred" : "Star"}</span>
      <span className="font-mono text-xs px-1.5 py-0.5 bg-foreground/5">{count}</span>
    </Button>
  );
}
