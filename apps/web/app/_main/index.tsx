import { GitBranchIcon, Loading02Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-standard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentUserSummary, useUserRepositories } from '@gitbruv/hooks';
import { NewRepositoryModal } from '@/components/new-repository-modal';
import { Link, createFileRoute } from '@tanstack/react-router';
import RepositoryCard from '@/components/repository-card';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { useState } from 'react';

export const Route = createFileRoute('/_main/')({
  component: HomePage,
});

function HomePage() {
  const { data: session, isPending: sessionLoading } = useSession();

  if (sessionLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <HugeiconsIcon
          icon={Loading02Icon}
          strokeWidth={2}
          className="text-muted-foreground size-8 animate-spin"
        />
      </div>
    );
  }

  if (!session?.user) {
    return <LandingPage />;
  }

  return <LoggedInHomePage session={session} />;
}

function LoggedInHomePage({
  session,
}: {
  session: { user: { username?: string; [key: string]: any }; [key: string]: any };
}) {
  const username = session.user.username || '';
  const { data: user, isLoading: userLoading } = useCurrentUserSummary(!!session.user);
  const { data, isLoading: reposLoading } = useUserRepositories(username);
  const [newRepoModalOpen, setNewRepoModalOpen] = useState(false);

  const repos = data?.repos || [];

  return (
    <div className="container px-4 py-8 sm:px-0">
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="shrink-0 lg:w-64">
          {userLoading ? (
            <div className="bg-card border-border flex animate-pulse items-center gap-3 border p-4">
              <div className="bg-secondary/50 h-8 w-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="bg-secondary/50 mb-1.5 h-4 w-24" />
                <div className="bg-secondary/50 h-3 w-20" />
              </div>
            </div>
          ) : (
            <div className="bg-card border-border flex items-center gap-3 border p-4">
              <Avatar className="size-12 rounded-none border-none after:border-none">
                <AvatarImage
                  src={user?.avatarUrl || undefined}
                  className="rounded-none border-none"
                />
                <AvatarFallback className="bg-muted text-muted-foreground rounded-none font-semibold">
                  {user?.name.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{user?.name}</p>
                <p className="text-muted-foreground truncate text-sm">@{username}</p>
              </div>
            </div>
          )}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your repositories</h2>
            <Button size="sm" className="gap-2" onClick={() => setNewRepoModalOpen(true)}>
              <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-4" />
              New
            </Button>
          </div>

          {userLoading || reposLoading ? (
            <div className="flex flex-col gap-4">
              {[...Array(6)].map((_, i) => (
                <RepositoryCardSkeleton key={i} />
              ))}
            </div>
          ) : repos.length === 0 ? (
            <div className="border-border bg-card/30 flex flex-col items-center justify-center border border-dashed p-12 text-center">
              <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} className="text-primary size-8" />
              <h3 className="mb-2 text-lg font-semibold">No repositories yet</h3>
              <p className="text-muted-foreground mx-auto mb-6 max-w-sm">
                Create your first repository to start building something awesome
              </p>
              <Button
                size="lg"
                className="flex items-center gap-2"
                onClick={() => setNewRepoModalOpen(true)}
              >
                <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="mr-2 size-4" />
                Create repository
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {repos.map((repo) => (
                <RepositoryCard key={repo.id} repository={repo} />
              ))}
            </div>
          )}
        </div>
      </div>
      <NewRepositoryModal open={newRepoModalOpen} onOpenChange={setNewRepoModalOpen} />
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
            <div className="bg-secondary/50 h-4 w-48" />
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

function LandingPage() {
  return (
    <div className="flex flex-col">
      <section className="bg-background relative overflow-hidden py-24 lg:py-36">
        <div className="relative container px-4 text-center sm:px-0">
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="h-12 px-8 text-base"
              render={<Link to="/register">Get started for free</Link>}
            />
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base"
              render={<Link to="/login">Sign in</Link>}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
