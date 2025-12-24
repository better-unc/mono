"use client";

import { notFound, useSearchParams } from "next/navigation";
import { useUserProfile, useUserStarredRepos } from "@/lib/hooks/use-users";
import { useUserRepositories } from "@/lib/hooks/use-repositories";
import { RepoList } from "@/components/repo-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, GitBranch, MapPin, Link as LinkIcon, Star, BookOpen, Loader2 } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { GithubIcon, XIcon, LinkedInIcon } from "@/components/icons";

function RepositoriesTab({ username }: { username: string }) {
  const { data, isLoading } = useUserRepositories(username);

  if (isLoading) {
    return <TabSkeleton />;
  }

  const repos = data?.repos || [];

  if (repos.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">No repositories yet</h3>
        <p className="text-muted-foreground">This user hasn&apos;t created any public repositories.</p>
      </div>
    );
  }

  return <RepoList repos={repos} username={username} />;
}

function StarredTab({ username }: { username: string }) {
  const { data, isLoading } = useUserStarredRepos(username);

  if (isLoading) {
    return <TabSkeleton />;
  }

  const repos = data?.repos || [];

  if (repos.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">No starred repositories</h3>
        <p className="text-muted-foreground">This user hasn&apos;t starred any repositories yet.</p>
      </div>
    );
  }

  return <RepoList repos={repos} username={username} />;
}

function TabSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="border border-border rounded-lg p-4 animate-pulse">
          <div className="h-5 bg-muted rounded w-1/3 mb-2" />
          <div className="h-4 bg-muted rounded w-2/3 mb-3" />
          <div className="flex gap-4">
            <div className="h-4 bg-muted rounded w-16" />
            <div className="h-4 bg-muted rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="container px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-72 shrink-0">
          <div className="space-y-4">
            <div className="w-64 h-64 mx-auto lg:mx-0 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted rounded animate-pulse" />
              <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </aside>
        <div className="flex-1 min-w-0">
          <div className="h-10 w-64 bg-muted rounded animate-pulse mb-6" />
          <TabSkeleton />
        </div>
      </div>
    </div>
  );
}

export function ProfilePageClient({ username }: { username: string }) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const { data: user, isLoading, error } = useUserProfile(username);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error || !user) {
    notFound();
  }

  const activeTab = tab === "starred" ? "starred" : "repositories";

  return (
    <div className="container px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-72 shrink-0">
          <div className="sticky top-20 space-y-4">
            <Avatar className="w-64 h-64 mx-auto lg:mx-0 border border-border">
              <AvatarImage src={user.avatarUrl || user.image || undefined} />
              <AvatarFallback className="text-6xl bg-accent/20">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>

            <div>
              <h1 className="text-2xl font-bold">{user.name}</h1>
              <p className="text-lg text-muted-foreground">@{user.username}</p>
              {user.pronouns && <p className="text-sm text-muted-foreground">{user.pronouns}</p>}
            </div>

            {user.bio && <p className="text-sm">{user.bio}</p>}

            <div className="space-y-2 text-sm">
              {user.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{user.location}</span>
                </div>
              )}
              {user.website && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LinkIcon className="h-4 w-4" />
                  <Link href={user.website} target="_blank" className="text-primary hover:underline truncate">
                    {user.website.replace(/^https?:\/\//, "")}
                  </Link>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>Joined {format(new Date(user.createdAt), "MMMM yyyy")}</span>
              </div>
            </div>

            {user.socialLinks && (
              <div className="flex items-center gap-3">
                {user.socialLinks.github && (
                  <Link href={user.socialLinks.github} target="_blank" className="text-muted-foreground hover:text-foreground transition-colors">
                    <GithubIcon className="h-5 w-5" />
                  </Link>
                )}
                {user.socialLinks.twitter && (
                  <Link href={user.socialLinks.twitter} target="_blank" className="text-muted-foreground hover:text-foreground transition-colors">
                    <XIcon className="h-5 w-5" />
                  </Link>
                )}
                {user.socialLinks.linkedin && (
                  <Link href={user.socialLinks.linkedin} target="_blank" className="text-muted-foreground hover:text-foreground transition-colors">
                    <LinkedInIcon className="h-5 w-5" />
                  </Link>
                )}
                {user.socialLinks.custom?.map((link, i) => (
                  <Link key={i} href={link} target="_blank" className="text-muted-foreground hover:text-foreground transition-colors">
                    <LinkIcon className="h-5 w-5" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <Tabs defaultValue={activeTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="repositories" asChild>
                <Link href={`/${username}`}>
                  <BookOpen className="h-4 w-4" />
                  Repositories
                </Link>
              </TabsTrigger>
              <TabsTrigger value="starred" asChild>
                <Link href={`/${username}?tab=starred`}>
                  <Star className="h-4 w-4" />
                  Starred
                </Link>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="repositories">
              <RepositoriesTab username={username} />
            </TabsContent>

            <TabsContent value="starred">
              <StarredTab username={username} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

