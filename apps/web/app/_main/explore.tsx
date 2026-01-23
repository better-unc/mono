import RepositoryCard from "@/components/repository-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePublicRepositories, usePublicUsers } from "@gitbruv/hooks";
import {
  BookOpenIcon,
  ChevronLeft,
  ChevronRight,
  ClockIcon,
  CompassIcon,
  GitBranchIcon,
  Loading02Icon,
  SparklesIcon,
  StarAward01Icon,
  UserSearch01Icon,
} from "@hugeicons-pro/core-stroke-standard";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { parseAsInteger, parseAsStringLiteral, useQueryState } from "@/lib/hooks";
import { Suspense } from "react";

export const Route = createFileRoute("/_main/explore")({
  component: ExplorePage,
});

const REPO_SORT_OPTIONS = [
  { value: "stars", label: "Most stars", icon: () => <HugeiconsIcon icon={StarAward01Icon} strokeWidth={2} className="size-4" /> },
  { value: "updated", label: "Recently updated", icon: () => <HugeiconsIcon icon={ClockIcon} strokeWidth={2} className="size-4" /> },
  { value: "created", label: "Newest", icon: () => <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} className="size-4" /> },
] as const;

const USER_SORT_OPTIONS = [
  { value: "newest", label: "Newest", icon: () => <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} className="size-4" /> },
  { value: "oldest", label: "Oldest", icon: () => <HugeiconsIcon icon={ClockIcon} strokeWidth={2} className="size-4" /> },
] as const;

function RepoGrid({
  sortBy,
  page,
  perPage,
  setPage,
}: {
  sortBy: "stars" | "updated" | "created";
  page: number;
  perPage: number;
  setPage: (page: number | null) => void;
}) {
  const offset = (page - 1) * perPage;
  const { data, isLoading } = usePublicRepositories(sortBy, perPage, offset);

  if (isLoading) {
    return <GridSkeleton />;
  }

  const repos = data?.repos || [];
  const hasMore = data?.hasMore || false;

  if (repos.length === 0) {
    return (
      <div className="border border-dashed border-border p-12 text-center bg-card/30">
        <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} className="size-10 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-base font-semibold mb-2">No repositories yet</h3>
        <p className="text-sm text-muted-foreground">Be the first to create a public repository!</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {repos.map((repo) => (
          <RepositoryCard key={repo.id} repository={repo} showOwner={true} />
        ))}
      </div>

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between mt-8">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1 <= 1 ? null : page - 1)}>
            <HugeiconsIcon icon={ChevronLeft} strokeWidth={2} className="size-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(page + 1)}>
            Next
            <HugeiconsIcon icon={ChevronRight} strokeWidth={2} className="size-4 ml-1" />
          </Button>
        </div>
      )}
    </>
  );
}

function UserGrid({ sortBy, page, perPage, setPage }: { sortBy: "newest" | "oldest"; page: number; perPage: number; setPage: (page: number | null) => void }) {
  const offset = (page - 1) * perPage;
  const { data, isLoading } = usePublicUsers(sortBy, perPage, offset);

  if (isLoading) {
    return <UserGridSkeleton />;
  }

  const users = data?.users || [];
  const hasMore = data?.hasMore || false;

  if (users.length === 0) {
    return (
      <div className="border border-dashed border-border p-12 text-center bg-card/30">
        <HugeiconsIcon icon={UserSearch01Icon} strokeWidth={2} className="size-10 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-base font-semibold mb-2">No users yet</h3>
        <p className="text-sm text-muted-foreground">Be the first to join!</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {users.map((user) => (
          <Link
            key={user.id}
            to="/$username"
            params={{ username: user.username }}
            className="border border-border p-4 bg-card hover:border-primary/30 transition-colors block"
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 shrink-0 rounded-none border-none after:border-none">
                <AvatarImage src={user.avatarUrl || undefined} className="rounded-none border-none" />
                <AvatarFallback className="bg-muted text-muted-foreground font-semibold rounded-none">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.name}</p>
                <p className="text-sm text-muted-foreground">@{user.username}</p>
                {user.bio && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{user.bio}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <HugeiconsIcon icon={BookOpenIcon} strokeWidth={2} className="size-3.5" />
                    <span>{user.repoCount} repos</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between mt-8">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1 <= 1 ? null : page - 1)}>
            <HugeiconsIcon icon={ChevronLeft} strokeWidth={2} className="size-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(page + 1)}>
            Next
            <HugeiconsIcon icon={ChevronRight} strokeWidth={2} className="size-4 ml-1" />
          </Button>
        </div>
      )}
    </>
  );
}

function GridSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[...Array(6)].map((_, i) => (
        <RepositoryCardSkeleton key={i} />
      ))}
    </div>
  );
}

function RepositoryCardSkeleton() {
  return (
    <div className="border border-border bg-card p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 bg-secondary/50 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="h-4 w-56 bg-secondary/50" />
            <div className="h-6 w-16 bg-secondary/50 border border-border" />
          </div>
          <div className="space-y-1.5 mt-2">
            <div className="h-3 w-full bg-secondary/50" />
            <div className="h-3 w-4/5 bg-secondary/50" />
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 bg-secondary/50" />
              <div className="h-3 w-6 bg-secondary/50" />
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 bg-secondary/50" />
              <div className="h-3 w-20 bg-secondary/50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="border border-border p-4 bg-card animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 bg-secondary/50 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-4 w-32 bg-secondary/50 mb-1" />
              <div className="h-3 w-24 bg-secondary/50 mb-3" />
              <div className="space-y-1.5 mb-2">
                <div className="h-3 w-full bg-secondary/50" />
                <div className="h-3 w-3/4 bg-secondary/50" />
              </div>
              <div className="flex items-center gap-1 mt-2">
                <div className="h-3.5 w-3.5 bg-secondary/50" />
                <div className="h-3 w-12 bg-secondary/50" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExploreContent() {
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(["repositories", "users"]).withDefault("repositories"));
  const [sortBy, setSortBy] = useQueryState("sort", parseAsStringLiteral(["stars", "updated", "created"]).withDefault("stars"));
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [userSortBy, setUserSortBy] = useQueryState("usort", parseAsStringLiteral(["newest", "oldest"]).withDefault("newest"));
  const [userPage, setUserPage] = useQueryState("upage", parseAsInteger.withDefault(1));
  const perPage = 20;

  return (
    <div className="container py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <HugeiconsIcon icon={CompassIcon} strokeWidth={2} className="size-7 text-primary" />
          <h1 className="text-2xl font-bold">Explore</h1>
        </div>
        <p className="text-muted-foreground text-sm">Discover repositories and users from the community</p>
      </div>

      <Tabs value={tab} onValueChange={(value: "repositories" | "users") => setTab(value)} className="space-y-6">
        <TabsList className="w-full justify-start h-auto mb-6 gap-2">
          <TabsTrigger value="repositories" className="gap-2 text-sm">
            <HugeiconsIcon icon={BookOpenIcon} strokeWidth={2} className="size-4" />
            <span>Repositories</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 text-sm">
            <HugeiconsIcon icon={UserSearch01Icon} strokeWidth={2} className="size-4" />
            <span>Users</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="repositories">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {REPO_SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={sortBy === value ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => {
                  setSortBy(value === "stars" ? null : value);
                  setPage(null);
                }}
              >
                <Icon />
                {label}
              </Button>
            ))}
          </div>

          <RepoGrid sortBy={sortBy} page={page} perPage={perPage} setPage={setPage} />
        </TabsContent>

        <TabsContent value="users">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {USER_SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={userSortBy === value ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => {
                  setUserSortBy(value === "newest" ? null : value);
                  setUserPage(null);
                }}
              >
                <Icon />
                {label}
              </Button>
            ))}
          </div>

          <UserGrid sortBy={userSortBy} page={userPage} perPage={perPage} setPage={setUserPage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="container py-8">
          <div className="flex items-center justify-center py-12">
            <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
