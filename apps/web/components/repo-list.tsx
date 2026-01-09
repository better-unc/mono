import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Lock, Globe, Star } from "lucide-react";
import { Button } from "./ui/button";
import { useStarRepository } from "@/lib/hooks/use-repositories";

type Repository = {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  updatedAt: Date | string;
  starCount?: number;
  owner?: {
    username: string;
    name: string | null;
  };
};

export function RepoList({ repos, username }: { repos: Repository[]; username?: string }) {
  return (
    <div className="divide-y divide-border border-t border-border">
      {repos.map((repo) => {
        return <RepoCard key={repo.id} repo={repo} />;
      })}
    </div>
  );
}

const RepoCard = ({ repo }: { repo: Repository }) => {
  const { isStarred, isLoading, starCount, toggleStar, isMutating } = useStarRepository(repo.id, repo.starCount);
  const ownerUsername = repo.owner?.username || "";
  const showOwner = repo.owner && repo.owner.username !== ownerUsername;

  return (
    <div className="py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/$username/$repo"
              params={{ username: ownerUsername, repo: repo.name }}
              className="font-bold text-primary hover:underline text-lg md:text-xl inline-flex items-center"
            >
              {showOwner && <span className="font-normal mr-1">{repo.owner?.username} /</span>}
              {repo.name}
            </Link>
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium border border-border text-muted-foreground bg-transparent uppercase tracking-tight">
              {repo.visibility === "private" ? "Private" : "Public"}
            </span>
          </div>
          {repo.description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">{repo.description}</p>}

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              <span>{starCount}</span>
            </div>
            <p>
              Updated{" "}
              {formatDistanceToNow(new Date(repo.updatedAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
        <div className="shrink-0 pt-1">
          <Button variant={isStarred ? "secondary" : "outline"} size="sm" className="gap-2" disabled={isMutating || isLoading} onClick={() => toggleStar()}>
            <Star className={`h-3.5 w-3.5 ${isStarred ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            {isStarred ? "Starred" : "Star"}
          </Button>
        </div>
      </div>
    </div>
  );
};
