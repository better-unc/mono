import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ClockIcon } from "@hugeicons-pro/core-stroke-standard";
import { cn, formatDate } from "@gitbruv/lib";
import { type RepositoryWithStars } from "@gitbruv/hooks";
import { buttonVariants } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { StarButton } from "./star-button";

export default function RepositoryCard({ repository, showOwner = false }: { repository: RepositoryWithStars; showOwner?: boolean }) {


  return (
    <div className="group/project relative border border-border bg-card p-4 hover:border-primary/30 transition-colors">
      <Link to="/$username/$repo" params={{ username: repository.owner.username, repo: repository.name }} className="absolute inset-0" />
      <span className="sr-only">View {repository.name}</span>
      <div className="flex items-start gap-3">
        <Link to="/$username" params={{ username: repository.owner.username }} onClick={(e) => e.stopPropagation()} className="z-10 shrink-0">
          <Avatar className="h-12 w-12 rounded-none border-none after:border-none">
            <AvatarImage
              src={repository.owner.avatarUrl || undefined}
              alt={repository.name || "Repository Logo"}
              className="transition-opacity hover:opacity-80 rounded-none border-none"
            />
            <AvatarFallback className="bg-muted text-muted-foreground font-semibold rounded-none">
              {repository.owner.name.charAt(0).toUpperCase() || repository.owner.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-medium">
              {showOwner ? (
                <>
                  <Link
                    to="/$username"
                    params={{ username: repository.owner.username }}
                    onClick={(e) => e.stopPropagation()}
                    className="z-10 text-muted-foreground hover:text-primary"
                  >
                    {repository.owner.username}
                  </Link>
                  <span className="text-muted-foreground mx-0.5">/</span>
                  <span className="text-foreground">{repository.name}</span>
                </>
              ) : (
                repository.name
              )}
            </h3>
            <div className="flex items-center gap-2">
              {repository.visibility === "private" && (
                <span className={cn(buttonVariants({ variant: "outline", size: "xs" }), "h-7")}>Private</span>
              )}
              <StarButton repository={repository} className=" z-10" />
            </div>
          </div>
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{repository.description || "No description"}</p>
          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <HugeiconsIcon icon={ClockIcon} strokeWidth={2} className="size-3" />
              <span>{formatDate(repository.createdAt, "MMM d, yyyy")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
