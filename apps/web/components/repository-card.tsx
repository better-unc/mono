import { Link } from "@tanstack/react-router";
import { Star, Clock } from "lucide-react";
import { format } from "date-fns";
import { type RepositoryWithStars } from "@/lib/api/client";
import { useStarRepository } from "@/lib/hooks/use-repositories";
import { Button } from "./ui/button";

export default function RepositoryCard({ repository }: { repository: RepositoryWithStars }) {
  const { isStarred, isLoading, starCount, toggleStar, isMutating } = useStarRepository(repository.id, repository.starCount);

  return (
    <div className="group/project relative flex h-full flex-col bg-[#171717] p-1">
      <Link to="/$username/$repo" params={{ username: repository.owner.username, repo: repository.name }} className="absolute inset-0" />
      <span className="sr-only">View {repository.name}</span>
      <div className="flex flex-1 grow flex-col gap-2 border border-[#404040] bg-[#262626] p-4">
        <div className="flex items-start gap-3">
          {repository.owner.avatarUrl ? (
            <Link to="/$username" params={{ username: repository.owner.username }} onClick={(e) => e.stopPropagation()} className="z-10 shrink-0 rounded-none">
              <img
                src={repository.owner.avatarUrl}
                alt={repository.name ?? "Repository Logo"}
                className="h-[78px] w-[78px] rounded-none transition-opacity hover:opacity-80"
                loading="lazy"
              />
            </Link>
          ) : (
            <div className="h-[78px] w-[78px] animate-pulse bg-neutral-900" />
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-semibold text-white md:text-base">{repository.name}</h3>
              <div className="flex items-start gap-2">
                {repository.visibility === "private" && (
                  <span className="rounded-none border border-[#404040] bg-[#262626] px-1.5 py-0.5 text-xs font-medium text-neutral-400 md:px-2">Private</span>
                )}
                <Button
                  variant={isStarred ? "secondary" : "outline"}
                  size="sm"
                  className="gap-1.5 z-10 rounded-none border-[#404040] bg-[#262626] text-neutral-300 hover:bg-[#2a2a2a] hover:text-white"
                  disabled={isMutating || isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStar();
                  }}
                >
                  <Star className={`h-3 w-3 ${isStarred ? "fill-yellow-600 text-yellow-600" : ""}`} />
                  {isStarred ? "Starred" : "Star"}
                </Button>
              </div>
            </div>
            <p className="line-clamp-2 text-xs leading-relaxed text-neutral-400 md:text-sm">{repository.description}</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 p-2 pb-1 text-xs md:gap-4 md:text-sm">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-yellow-600 md:h-3.5 md:w-3.5" />
            <span className="text-neutral-300">{starCount ?? 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-neutral-500 md:h-3.5 md:w-3.5" />
            <span className="text-neutral-300">{format(new Date(repository.createdAt), "MMM d, yyyy")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
