import RepositoryCard from "@/components/repository-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { useUserRepositories, useUserProfile } from "@gitbruv/hooks";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GitBranch, Loader2, Plus } from "lucide-react";

export const Route = createFileRoute("/_main/")({
  component: HomePage,
});

function HomePage() {
  const { data: session, isPending: sessionLoading } = useSession();

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.user) {
    return <LandingPage />;
  }

  return <LoggedInHomePage session={session} />;
}

function LoggedInHomePage({ session }: { session: { user: { username?: string; [key: string]: any }; [key: string]: any } }) {
  // @ts-ignore
  const username = session?.user?.username || "";
  const { data: user, isLoading: userLoading } = useUserProfile(username);
  const { data, isLoading: reposLoading } = useUserRepositories(username);

  const repos = data?.repos || [];

  return (
    <div className="container py-8 px-4 sm:px-0">
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-64 shrink-0">
          {userLoading ? (
            <div className="flex items-center gap-3 p-4 bg-card border border-border animate-pulse">
              <div className="h-8 w-8 bg-secondary/50 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="h-4 w-24 bg-secondary/50 mb-1.5" />
                <div className="h-3 w-20 bg-secondary/50" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-card border border-border">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl || undefined} />
                <AvatarFallback className="bg-linear-to-br from-accent/40 to-primary/40 text-foreground text-xs font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold truncate">{user?.name}</p>
                <p className="text-sm text-muted-foreground truncate">@{username}</p>
              </div>
            </div>
          )}
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Your repositories</h2>
            <Link to="/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New
              </Button>
            </Link>
          </div>

          {userLoading || reposLoading ? (
            <div className="flex flex-col gap-4">
              {[...Array(6)].map((_, i) => (
                <RepositoryCardSkeleton key={i} />
              ))}
            </div>
          ) : repos.length === 0 ? (
            <div className="border border-dashed border-border p-12 text-center bg-card/30 flex flex-col items-center justify-center">
              <GitBranch className="h-8 w-8 text-primary" />
              <h3 className="text-lg font-semibold mb-2">No repositories yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Create your first repository to start building something awesome</p>
              <Link to="/new">
                <Button size="lg" className="gap-2 flex items-center">
                  <Plus className="h-4 w-4 mr-2" />
                  Create repository
                </Button>
              </Link>
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
            <div className="h-4 w-48 bg-secondary/50" />
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

function LandingPage() {
  return (
    <div className="flex flex-col">
      <section className="relative py-24 lg:py-36 overflow-hidden bg-background">
        <div className="container relative text-center px-4 sm:px-0">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-base h-12 px-8" render={<Link to="/register">Get started for free</Link>} />
            <Button size="lg" variant="outline" className="text-base h-12 px-8" render={<Link to="/login">Sign in</Link>} />
          </div>
        </div>
      </section>
    </div>
  );
}
