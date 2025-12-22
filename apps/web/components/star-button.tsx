"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleStar } from "@/actions/repositories";
import { cn } from "@/lib/utils";

export function StarButton({
  repoId,
  initialStarred,
  initialCount,
}: {
  repoId: string;
  initialStarred: boolean;
  initialCount: number;
}) {
  const [starred, setStarred] = useState(initialStarred);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const result = await toggleStar(repoId);
        setStarred(result.starred);
        setCount((c) => (result.starred ? c + 1 : c - 1));
      } catch {}
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "gap-2 transition-colors",
        starred && "bg-accent/10 border-accent/30 text-accent hover:bg-accent/20"
      )}
    >
      <Star className={cn("h-4 w-4", starred && "fill-current")} />
      <span>{starred ? "Starred" : "Star"}</span>
      <span className="px-2 py-0.5 rounded bg-secondary text-xs font-medium">{count}</span>
    </Button>
  );
}

