import { Link } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import { Lock, Globe, Star } from "lucide-react"

type Repository = {
  id: string
  name: string
  description: string | null
  visibility: "public" | "private"
  updatedAt: Date | string
  starCount?: number
  owner?: {
    username: string
    name: string | null
  }
}

export function RepoList({
  repos,
  username,
}: {
  repos: Repository[]
  username?: string
}) {
  return (
    <div className="space-y-3">
      {repos.map((repo) => {
        const ownerUsername = repo.owner?.username || username || ""
        const showOwner = repo.owner && repo.owner.username !== username

        return (
          <Link
            key={repo.id}
            to="/$username/$repo"
            params={{ username: ownerUsername, repo: repo.name }}
            className="block p-5 rounded-xl border border-border bg-card hover:border-accent/50 transition-all duration-200 group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="font-semibold text-accent group-hover:underline text-lg">
                    {showOwner && (
                      <span className="text-muted-foreground font-normal">
                        {repo.owner?.username}/
                      </span>
                    )}
                    {repo.name}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                      repo.visibility === "private"
                        ? "border-yellow-500/30 text-yellow-500 bg-yellow-500/10"
                        : "border-border text-muted-foreground bg-secondary"
                    }`}
                  >
                    {repo.visibility === "private" ? (
                      <>
                        <Lock className="h-3 w-3" />
                        Private
                      </>
                    ) : (
                      <>
                        <Globe className="h-3 w-3" />
                        Public
                      </>
                    )}
                  </span>
                </div>
                {repo.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                    {repo.description}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0 pt-1">
                {typeof repo.starCount === "number" && repo.starCount > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Star className="h-3.5 w-3.5" />
                    <span className="text-xs">{repo.starCount}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(repo.updatedAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
