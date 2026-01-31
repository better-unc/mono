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
} from '@hugeicons-pro/core-stroke-standard';
import { parseAsInteger, parseAsStringLiteral, useQueryState } from '@/lib/hooks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePublicRepositories, usePublicUsers } from '@gitbruv/hooks';
import { createFileRoute, Link } from '@tanstack/react-router';
import RepositoryCard from '@/components/repository-card';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import { Suspense } from 'react';

export const Route = createFileRoute('/_main/explore')({
  component: ExplorePage,
});

const REPO_SORT_OPTIONS = [
  {
    value: 'stars',
    label: 'Most stars',
    icon: () => <HugeiconsIcon icon={StarAward01Icon} strokeWidth={2} className="size-4" />,
  },
  {
    value: 'updated',
    label: 'Recently updated',
    icon: () => <HugeiconsIcon icon={ClockIcon} strokeWidth={2} className="size-4" />,
  },
  {
    value: 'created',
    label: 'Newest',
    icon: () => <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} className="size-4" />,
  },
] as const;

const USER_SORT_OPTIONS = [
  {
    value: 'newest',
    label: 'Newest',
    icon: () => <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} className="size-4" />,
  },
  {
    value: 'oldest',
    label: 'Oldest',
    icon: () => <HugeiconsIcon icon={ClockIcon} strokeWidth={2} className="size-4" />,
  },
] as const;

function RepoGrid({
  sortBy,
  page,
  perPage,
  setPage,
}: {
  sortBy: 'stars' | 'updated' | 'created';
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
      <div className="border-border bg-card/30 border border-dashed p-12 text-center">
        <HugeiconsIcon
          icon={GitBranchIcon}
          strokeWidth={2}
          className="text-muted-foreground mx-auto mb-4 size-10"
        />
        <h3 className="mb-2 text-base font-semibold">No repositories yet</h3>
        <p className="text-muted-foreground text-sm">Be the first to create a public repository!</p>
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
        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1 <= 1 ? null : page - 1)}
          >
            <HugeiconsIcon icon={ChevronLeft} strokeWidth={2} className="mr-1 size-4" />
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">Page {page}</span>
          <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(page + 1)}>
            Next
            <HugeiconsIcon icon={ChevronRight} strokeWidth={2} className="ml-1 size-4" />
          </Button>
        </div>
      )}
    </>
  );
}

function UserGrid({
  sortBy,
  page,
  perPage,
  setPage,
}: {
  sortBy: 'newest' | 'oldest';
  page: number;
  perPage: number;
  setPage: (page: number | null) => void;
}) {
  const offset = (page - 1) * perPage;
  const { data, isLoading } = usePublicUsers(sortBy, perPage, offset);

  if (isLoading) {
    return <UserGridSkeleton />;
  }

  const users = data?.users || [];
  const hasMore = data?.hasMore || false;

  if (users.length === 0) {
    return (
      <div className="border-border bg-card/30 border border-dashed p-12 text-center">
        <HugeiconsIcon
          icon={UserSearch01Icon}
          strokeWidth={2}
          className="text-muted-foreground mx-auto mb-4 size-10"
        />
        <h3 className="mb-2 text-base font-semibold">No users yet</h3>
        <p className="text-muted-foreground text-sm">Be the first to join!</p>
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
            className="border-border bg-card hover:border-primary/30 block border p-4 transition-colors"
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 shrink-0 rounded-none border-none after:border-none">
                <AvatarImage
                  src={user.avatarUrl || undefined}
                  className="rounded-none border-none"
                />
                <AvatarFallback className="bg-muted text-muted-foreground rounded-none font-semibold">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{user.name}</p>
                <p className="text-muted-foreground text-sm">@{user.username}</p>
                {user.bio && (
                  <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{user.bio}</p>
                )}
                <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
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
        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1 <= 1 ? null : page - 1)}
          >
            <HugeiconsIcon icon={ChevronLeft} strokeWidth={2} className="mr-1 size-4" />
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">Page {page}</span>
          <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(page + 1)}>
            Next
            <HugeiconsIcon icon={ChevronRight} strokeWidth={2} className="ml-1 size-4" />
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
    <div className="border-border bg-card animate-pulse border p-4">
      <div className="flex items-start gap-3">
        <div className="bg-secondary/50 h-12 w-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="bg-secondary/50 h-4 w-56" />
            <div className="bg-secondary/50 border-border h-6 w-16 border" />
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="bg-secondary/50 h-3 w-full" />
            <div className="bg-secondary/50 h-3 w-4/5" />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="bg-secondary/50 h-3 w-3" />
              <div className="bg-secondary/50 h-3 w-6" />
            </div>
            <div className="flex items-center gap-1">
              <div className="bg-secondary/50 h-3 w-3" />
              <div className="bg-secondary/50 h-3 w-20" />
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
        <div key={i} className="border-border bg-card animate-pulse border p-4">
          <div className="flex items-start gap-3">
            <div className="bg-secondary/50 h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="bg-secondary/50 mb-1 h-4 w-32" />
              <div className="bg-secondary/50 mb-3 h-3 w-24" />
              <div className="mb-2 space-y-1.5">
                <div className="bg-secondary/50 h-3 w-full" />
                <div className="bg-secondary/50 h-3 w-3/4" />
              </div>
              <div className="mt-2 flex items-center gap-1">
                <div className="bg-secondary/50 h-3.5 w-3.5" />
                <div className="bg-secondary/50 h-3 w-12" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExploreContent() {
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(['repositories', 'users']).withDefault('repositories'),
  );
  const [sortBy, setSortBy] = useQueryState(
    'sort',
    parseAsStringLiteral(['stars', 'updated', 'created']).withDefault('stars'),
  );
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [userSortBy, setUserSortBy] = useQueryState(
    'usort',
    parseAsStringLiteral(['newest', 'oldest']).withDefault('newest'),
  );
  const [userPage, setUserPage] = useQueryState('upage', parseAsInteger.withDefault(1));
  const perPage = 20;

  return (
    <div className="container py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <HugeiconsIcon icon={CompassIcon} strokeWidth={2} className="text-primary size-7" />
          <h1 className="text-2xl font-bold">Explore</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Discover repositories and users from the community
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value: 'repositories' | 'users') => setTab(value)}
        className="space-y-6"
      >
        <TabsList className="mb-6 h-auto w-full justify-start gap-2">
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
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {REPO_SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={sortBy === value ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => {
                  setSortBy(value === 'stars' ? null : value);
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
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {USER_SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={userSortBy === value ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => {
                  setUserSortBy(value === 'newest' ? null : value);
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
            <HugeiconsIcon
              icon={Loading02Icon}
              strokeWidth={2}
              className="text-muted-foreground size-8 animate-spin"
            />
          </div>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
