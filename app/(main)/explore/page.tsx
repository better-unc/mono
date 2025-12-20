import Link from "next/link";
import { getPublicRepositories } from "@/actions/repositories";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, GitBranch, ChevronLeft, ChevronRight, Compass, Clock, Flame, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const SORT_OPTIONS = [
  { value: "stars", label: "Most stars", icon: Flame },
  { value: "updated", label: "Recently updated", icon: Clock },
  { value: "created", label: "Newest", icon: Sparkles },
] as const;

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ sort?: string; page?: string }> }) {
  const { sort: sortParam, page: pageParam } = await searchParams;
  const sortBy = (["stars", "updated", "created"].includes(sortParam || "") ? sortParam : "stars") as "stars" | "updated" | "created";
  const page = parseInt(pageParam || "1", 10);
  const perPage = 20;
  const offset = (page - 1) * perPage;

  const { repos, hasMore } = await getPublicRepositories(sortBy, perPage, offset);

  return (
    <div className="container py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Compass className="h-8 w-8 text-accent" />
          <h1 className="text-3xl font-bold">Explore</h1>
        </div>
        <p className="text-muted-foreground">Discover public repositories from the community</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
          <Button key={value} variant={sortBy === value ? "default" : "outline"} size="sm" asChild className="gap-2">
            <Link href={`/explore?sort=${value}`}>
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          </Button>
        ))}
      </div>

      {repos.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center bg-card/30">
          <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No repositories yet</h3>
          <p className="text-muted-foreground">Be the first to create a public repository!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {repos.map((repo) => (
            <div key={repo.id} className="border border-border rounded-xl p-5 bg-card hover:border-accent/50 transition-colors">
              <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={repo.owner.image || undefined} />
                  <AvatarFallback className="bg-accent/20">{repo.owner.name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <Link href={`/${repo.owner.username}`} className="font-semibold text-accent hover:underline">
                      {repo.owner.username}
                    </Link>
                    <span className="text-muted-foreground">/</span>
                    <Link href={`/${repo.owner.username}/${repo.name}`} className="font-semibold text-accent hover:underline">
                      {repo.name}
                    </Link>
                  </div>
                  {repo.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{repo.description}</p>}
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4" />
                      <span>{repo.starCount}</span>
                    </div>
                    <span>Updated {formatDistanceToNow(new Date(repo.updatedAt), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between mt-8">
          <Button variant="outline" size="sm" asChild disabled={page <= 1}>
            <Link href={`/explore?sort=${sortBy}&page=${page - 1}`} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button variant="outline" size="sm" asChild disabled={!hasMore}>
            <Link href={`/explore?sort=${sortBy}&page=${page + 1}`} className={!hasMore ? "pointer-events-none opacity-50" : ""}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
