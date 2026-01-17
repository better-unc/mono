import { GithubIcon, LinkedInIcon, XIcon } from "@/components/icons";
import RepositoryCard from "@/components/repository-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserProfile, useUserRepositories, useUserStarredRepos } from "@gitbruv/hooks";
import {
  ActivityIcon,
  BookOpenIcon,
  Building02Icon,
  Calendar01Icon,
  GitBranchIcon,
  GlobeIcon,
  LinkIcon,
  MapPinIcon,
  StarAward01Icon,
} from "@hugeicons-pro/core-stroke-standard";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { parseAsStringLiteral, useQueryState } from "nuqs";

export const Route = createFileRoute("/_main/$username/")({
  component: ProfilePage,
});

function RepositoriesTab({ username }: { username: string }) {
  const { data, isLoading } = useUserRepositories(username);

  if (isLoading) {
    return <TabSkeleton />;
  }

  const repos = data?.repos || [];
  const totalStars = repos.reduce((sum, repo) => sum + (repo.starCount || 0), 0);

  if (repos.length === 0) {
    return (
      <div className="py-20 text-center border border-dashed bg-muted/20">
        <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} className="size-10 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-base font-medium">No repositories yet</h3>
        <p className="text-sm text-muted-foreground">This user hasn't created any public repositories.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-border bg-card p-4">
          <div className="text-2xl font-bold">{repos.length}</div>
          <div className="text-sm text-muted-foreground mt-1">Repositories</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="text-2xl font-bold">{totalStars}</div>
          <div className="text-sm text-muted-foreground mt-1">Total stars</div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {repos.map((repo) => (
          <RepositoryCard key={repo.id} repository={repo} />
        ))}
      </div>
    </>
  );
}

function StarredTab({ username }: { username: string }) {
  const { data, isLoading } = useUserStarredRepos(username);

  if (isLoading) {
    return <TabSkeleton />;
  }

  const repos = data?.repos || [];

  if (repos.length === 0) {
    return (
      <div className="py-20 text-center border border-dashed bg-muted/20">
        <HugeiconsIcon icon={StarAward01Icon} strokeWidth={2} className="size-10 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-base font-medium">No starred repositories</h3>
        <p className="text-sm text-muted-foreground">This user hasn't starred any repositories yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <div className="border border-border bg-card p-4 inline-block">
          <div className="text-2xl font-bold">{repos.length}</div>
          <div className="text-sm text-muted-foreground mt-1">Starred repositories</div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {repos.map((repo) => (
          <RepositoryCard key={repo.id} repository={repo} showOwner />
        ))}
      </div>
    </>
  );
}

function TabSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-28 bg-card border border-border animate-pulse" />
      ))}
    </div>
  );
}

function ProfilePage() {
  const { username } = Route.useParams();
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(["repositories", "starred"]).withDefault("repositories"));
  const { data: user, isLoading, error } = useUserProfile(username);
  const { data: reposData } = useUserRepositories(username);
  const { data: starredData } = useUserStarredRepos(username);

  const repoCount = reposData?.repos?.length || 0;
  const starredCount = starredData?.repos?.length || 0;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-12 animate-pulse">
          <div className="lg:w-72 space-y-6">
            <div className="w-64 h-64 bg-muted" />
            <div className="h-8 w-48 bg-muted" />
            <div className="h-4 w-full bg-muted" />
          </div>
          <div className="flex-1 space-y-6">
            <div className="h-10 w-64 bg-muted" />
            <TabSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    throw notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row gap-12 items-start">
        <aside className="lg:w-72 shrink-0 space-y-6">
          <Avatar className="lg:w-64 lg:h-64 w-40 h-40 border-none after:border-none rounded-none">
            <AvatarImage src={user.avatarUrl || undefined} className="object-cover rounded-none border-none" />
            <AvatarFallback className="bg-muted text-muted-foreground font-semibold rounded-none">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{user.name}</h1>
              {user.pronouns && <span className="text-sm text-muted-foreground">({user.pronouns})</span>}
            </div>
            <p className="text-base text-muted-foreground">@{user.username}</p>
          </div>

          {user.bio && (
            <div className="pt-2">
              <p className="text-sm leading-relaxed text-muted-foreground">{user.bio}</p>
            </div>
          )}

          <div className="space-y-3 pt-2">
            {user.company && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HugeiconsIcon icon={Building02Icon} strokeWidth={2} className="size-4" />
                <span>{user.company}</span>
              </div>
            )}
            {user.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HugeiconsIcon icon={MapPinIcon} strokeWidth={2} className="size-4" />
                <span>{user.location}</span>
              </div>
            )}
            {user.website && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HugeiconsIcon icon={GlobeIcon} strokeWidth={2} className="size-4" />
                <a href={user.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline truncate">
                  {user.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
            {user.lastActiveAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HugeiconsIcon icon={ActivityIcon} strokeWidth={2} className="size-4" />
                <span>Active {formatDistanceToNow(new Date(user.lastActiveAt), { addSuffix: true })}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} className="size-4" />
              <span>Joined {format(new Date(user.createdAt), "MMMM yyyy")}</span>
            </div>
          </div>

          {user.socialLinks && (
            <div className="flex items-center gap-4 pt-2">
              {user.socialLinks.github && (
                <a
                  href={user.socialLinks.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <GithubIcon className="h-5 w-5" />
                </a>
              )}
              {user.socialLinks.twitter && (
                <a
                  href={user.socialLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <XIcon className="h-5 w-5" />
                </a>
              )}
              {user.socialLinks.linkedin && (
                <a
                  href={user.socialLinks.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LinkedInIcon className="h-5 w-5" />
                </a>
              )}
              {user.socialLinks.custom?.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="size-5" />
                </a>
              ))}
            </div>
          )}
        </aside>

        <div className="w-full">
          <Tabs value={tab} onValueChange={(value) => setTab(value === "repositories" ? null : (value as "starred"))}>
            <TabsList variant="default" className="w-full mb-6 h-12">
              <TabsTrigger value="repositories" className="gap-2">
                <HugeiconsIcon icon={BookOpenIcon} strokeWidth={2} className="size-4" />
                <span>Repositories</span>
                {repoCount > 0 && <span className="ml-1 text-xs text-muted-foreground">({repoCount})</span>}
              </TabsTrigger>
              <TabsTrigger value="starred" className="gap-2">
                <HugeiconsIcon icon={StarAward01Icon} strokeWidth={2} className="size-4" />
                <span>Starred</span>
                {starredCount > 0 && <span className="ml-1 text-xs text-muted-foreground">({starredCount})</span>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="repositories" className="mt-0">
              <RepositoriesTab username={username} />
            </TabsContent>

            <TabsContent value="starred" className="mt-0">
              <StarredTab username={username} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
