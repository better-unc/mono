"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons-pro/core-stroke-standard";
import { StarIcon as StarIconFill } from "@hugeicons-pro/core-solid-standard";
import { type RepositoryWithStars, useStarRepository } from "@gitbruv/hooks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StarButton({
  repository,
  className,
}: {
  repository: RepositoryWithStars;
  className?: string;
}) {
  const { isStarred, isLoading, starCount, toggleStar, isMutating } = useStarRepository(repository.id, repository.starCount);

  function handleClick() {
    toggleStar();
  }

  if (isLoading) {
    return (
      <div className={cn("inline-flex items-center gap-2 h-8 px-3 pr-[4px] bg-secondary/50 animate-pulse", className)}>
        <div className="size-3 bg-muted-foreground/20" />
        <div className="w-8 h-3 bg-muted-foreground/20" />
        <div className="w-4 h-4 bg-foreground/5" />
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleClick}
      disabled={isMutating}
      className={cn("gap-2 pr-[4px]", isStarred && "bg-primary/20 hover:bg-primary/40", className)}
    >
      <HugeiconsIcon icon={isStarred ? StarIconFill : StarIcon} strokeWidth={2} className={cn("size-3", isStarred ? "text-primary" : "text-muted-foreground")} />
      <span>{isStarred ? "Starred" : "Star"}</span>
      <span className="font-mono text-[10px] px-1.5 py-0.5 bg-foreground/5">{starCount}</span>
    </Button>
  );
}
