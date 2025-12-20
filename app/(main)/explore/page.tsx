import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { getPublicRepositories, getPublicUsers } from "@/actions/repositories";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, GitBranch, ChevronLeft, ChevronRight, Compass, Clock, Flame, Sparkles, Users, BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const REPO_SORT_OPTIONS = [
  { value: "stars", label: "Most stars", icon: Flame },
  { value: "updated", label: "Recently updated", icon: Clock },
  { value: "created", label: "Newest", icon: Sparkles },
] as const;

const USER_SORT_OPTIONS = [
  { value: "newest", label: "Newest", icon: Sparkles },
  { value: "oldest", label: "Oldest", icon: Clock },
] as const;

async function RepoGrid({ sortBy, page, perPage }: { sortBy: "stars" | "updated" | "created"; page: number; perPage: number }) {
  await connection();
  const offset = (page - 1) * perPage;
  const { repos, hasMore } = await getPublicRepositories(sortBy, perPage, offset);

  if (repos.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl p-12 text-center bg-card/30">
        <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No repositories yet</h3>
        <p className="text-muted-foreground">Be the first to create a public repository!</p>
      </div>
    );
  }

  return (
    <>
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

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between mt-8">
          <Button variant="outline" size="sm" asChild disabled={page <= 1}>
            <Link href={`/explore?tab=repositories&sort=${sortBy}&page=${page - 1}`} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button variant="outline" size="sm" asChild disabled={!hasMore}>
            <Link href={`/explore?tab=repositories&sort=${sortBy}&page=${page + 1}`} className={!hasMore ? "pointer-events-none opacity-50" : ""}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}

async function UserGrid({ sortBy, page, perPage }: { sortBy: "newest" | "oldest"; page: number; perPage: number }) {
  await connection();
  const offset = (page - 1) * perPage;
  const { users, hasMore } = await getPublicUsers(sortBy, perPage, offset);

  if (users.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl p-12 text-center bg-card/30">
        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No users yet</h3>
        <p className="text-muted-foreground">Be the first to join!</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {users.map((user) => (
          <Link
            key={user.id}
            href={`/${user.username}`}
            className="border border-border rounded-xl p-5 bg-card hover:border-accent/50 transition-colors block"
          >
            <div className="flex items-start gap-4">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage src={user.avatarUrl || user.image || undefined} />
                <AvatarFallback className="bg-accent/20 text-lg">{user.name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{user.name}</p>
                <p className="text-sm text-muted-foreground">@{user.username}</p>
                {user.bio && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{user.bio}</p>}
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    <span>{user.repoCount} {user.repoCount === 1 ? "repository" : "repositories"}</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between mt-8">
          <Button variant="outline" size="sm" asChild disabled={page <= 1}>
            <Link href={`/explore?tab=users&usort=${sortBy}&upage=${page - 1}`} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button variant="outline" size="sm" asChild disabled={!hasMore}>
            <Link href={`/explore?tab=users&usort=${sortBy}&upage=${page + 1}`} className={!hasMore ? "pointer-events-none opacity-50" : ""}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}

function GridSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border border-border rounded-xl p-5 bg-card animate-pulse">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="h-5 bg-muted rounded w-1/3 mb-2" />
              <div className="h-4 bg-muted rounded w-2/3 mb-3" />
              <div className="flex gap-4">
                <div className="h-4 bg-muted rounded w-16" />
                <div className="h-4 bg-muted rounded w-24" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function UserGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="border border-border rounded-xl p-5 bg-card animate-pulse">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="h-5 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-4 bg-muted rounded w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string; page?: string; usort?: string; upage?: string }>;
}) {
  const { tab, sort: sortParam, page: pageParam, usort: usortParam, upage: upageParam } = await searchParams;
  const activeTab = tab === "users" ? "users" : "repositories";
  const sortBy = (["stars", "updated", "created"].includes(sortParam || "") ? sortParam : "stars") as "stars" | "updated" | "created";
  const page = parseInt(pageParam || "1", 10);
  const userSortBy = (["newest", "oldest"].includes(usortParam || "") ? usortParam : "newest") as "newest" | "oldest";
  const userPage = parseInt(upageParam || "1", 10);
  const perPage = 20;

  return (
    <div className="container py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Compass className="h-8 w-8 text-accent" />
          <h1 className="text-3xl font-bold">Explore</h1>
        </div>
        <p className="text-muted-foreground">Discover repositories and users from the community</p>
      </div>

      <Tabs defaultValue={activeTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="repositories" asChild>
            <Link href="/explore?tab=repositories">
              <BookOpen className="h-4 w-4" />
              Repositories
            </Link>
          </TabsTrigger>
          <TabsTrigger value="users" asChild>
            <Link href="/explore?tab=users">
              <Users className="h-4 w-4" />
              Users
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="repositories">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {REPO_SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Button key={value} variant={sortBy === value ? "default" : "outline"} size="sm" asChild className="gap-2">
                <Link href={`/explore?tab=repositories&sort=${value}`}>
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </Button>
            ))}
          </div>

          <Suspense fallback={<GridSkeleton />}>
            <RepoGrid sortBy={sortBy} page={page} perPage={perPage} />
          </Suspense>
        </TabsContent>

        <TabsContent value="users">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {USER_SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Button key={value} variant={userSortBy === value ? "default" : "outline"} size="sm" asChild className="gap-2">
                <Link href={`/explore?tab=users&usort=${value}`}>
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </Button>
            ))}
          </div>

          <Suspense fallback={<UserGridSkeleton />}>
            <UserGrid sortBy={userSortBy} page={userPage} perPage={perPage} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
