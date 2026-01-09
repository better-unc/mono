import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useRepoPageData, useRepoReadme, useRepoCommits, useRepoCommitCount } from "@/lib/hooks/use-repositories";
import { useUserAvatarByEmail } from "@/lib/hooks/use-users";
import { FileTree } from "@/components/file-tree";
import { CodeViewer } from "@/components/code-viewer";
import { CloneUrl } from "@/components/clone-url";
import { BranchSelector } from "@/components/branch-selector";
import { StarButton } from "@/components/star-button";
import {
  GitBranch,
  Loader2,
  Search,
  ChevronDown,
  History,
  BookOpen,
  Scale,
  Star,
  GitFork,
  Activity,
  Book,
  Eye,
  Settings2,
  Link as LinkIcon,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_main/$username/$repo/")({
  component: RepoPage,
});

function ActionButton({
  icon: Icon,
  label,
  count,
  hasChevron,
  className,
}: {
  icon?: any;
  label: string;
  count?: string | number;
  hasChevron?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-center">
      <Button
        variant="secondary"
        size="sm"
        className={cn(
          "h-7 px-3 rounded-md text-xs font-semibold bg-secondary hover:bg-muted border border-border shadow-sm flex items-center gap-2",
          className
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-foreground">{label}</span>
        {count !== undefined && <span className="px-1.5 py-0.5 rounded-full bg-muted-foreground/20 text-foreground font-medium text-[10px]">{count}</span>}
        {hasChevron && <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </Button>
    </div>
  );
}

function SplitActionButton({ icon: Icon, label, count }: { icon: any; label: string; count?: string | number }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="h-7 px-2.5 rounded-md border-r-0 text-xs font-semibold bg-secondary hover:bg-muted border border-border shadow-sm flex items-center gap-2"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-foreground">{label}</span>
      {count !== undefined && <span className="px-1.5 py-0.5 rounded-full bg-muted-foreground/20 text-foreground font-medium text-[10px]">{count}</span>}
    </Button>
  );
}

function RepoPage() {
  const { username, repo: repoName } = Route.useParams();
  const { data, isLoading } = useRepoPageData(username, repoName);
  const { data: commitData } = useRepoCommits(username, repoName, data?.repo.defaultBranch || "main", 1);
  const { data: commitCountData } = useRepoCommitCount(username, repoName, data?.repo.defaultBranch || "main");

  if (isLoading || !data) {
    return null;
  }

  const { repo, files, isEmpty, branches, readmeOid } = data;
  const lastCommit = commitData?.commits?.[0];
  const commitCount = commitCountData?.count || 0;
  const { data: avatarData } = useUserAvatarByEmail(lastCommit?.author.email);

  return (
    <div className="container px-4 py-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-foreground rounded flex items-center justify-center">
            <Book className="h-5 w-5 text-background" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{repo.name}</h1>
          <span className="px-2 py-0.5 rounded-full border border-border text-muted-foreground text-[12px] font-medium uppercase tracking-tight">
            {repo.visibility === "private" ? "Private" : "Public"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ActionButton label="Edit Pins" hasChevron />
          <SplitActionButton icon={Eye} label="Watch" count={5} />
          <SplitActionButton icon={GitFork} label="Fork" count={0} />
          <StarButton repoId={repo.id} initialStarred={repo.starred} initialCount={repo.starCount} />
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-9 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BranchSelector branches={branches} currentBranch={repo.defaultBranch} username={username} repoName={repo.name} />
              <Button variant="ghost" size="sm" className="h-8 gap-2 text-sm font-semibold hover:bg-muted px-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground font-bold">{branches.length}</span>
                <span className="text-foreground font-normal">Branches</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative group flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Go to file"
                  className="h-8 w-[240px] pl-9 text-sm bg-transparent border-border focus-visible:ring-1 focus-visible:ring-accent"
                />
              </div>
              <ActionButton label="Add file" hasChevron />
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-3 rounded-md text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground border-none flex items-center gap-2"
              >
                <span>{"</>"} Code</span>
                <ChevronDown className="h-3 w-3 text-primary-foreground/70" />
              </Button>
            </div>
          </div>

          <div className="border border-border rounded-md overflow-hidden bg-background shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 border-b border-border">
              <div className="flex items-center gap-3 overflow-hidden">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={avatarData?.avatarUrl || undefined} />
                  <AvatarFallback className="text-[10px] bg-muted-foreground/20">{lastCommit?.author.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-semibold text-foreground whitespace-nowrap">{lastCommit?.author.name}</span>
                <span className="text-sm text-foreground truncate">{lastCommit?.message}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0 ml-4">
                <span className="font-mono text-xs">{lastCommit?.oid.substring(0, 7)}</span>
                <span className="whitespace-nowrap">{lastCommit ? formatDistanceToNow(lastCommit.timestamp) + " ago" : ""}</span>
                <Link
                  to="/$username/$repo/commits/$branch"
                  params={{ username, repo: repoName, branch: repo.defaultBranch }}
                  className="flex items-center gap-1.5 font-bold text-foreground cursor-pointer hover:text-accent"
                >
                  <History className="h-4 w-4" />
                  <span>{commitCount} Commits</span>
                </Link>
              </div>
            </div>

            {isEmpty ? (
              <div className="p-12 text-center bg-background">
                <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2 text-foreground">This repository is empty</h3>
                <p className="text-muted-foreground mb-8 text-sm">Get started by cloning or pushing to this repository.</p>
                <div className="max-w-md mx-auto p-4 bg-secondary/30 border border-border rounded-md">
                  <CloneUrl username={username} repoName={repo.name} />
                </div>
              </div>
            ) : (
              <FileTree files={files} username={username} repoName={repo.name} branch={repo.defaultBranch} />
            )}
          </div>

          {readmeOid && (
            <div className="border border-border rounded-md overflow-hidden mt-6 bg-card shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border sticky top-0 z-10">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">README.md</span>
              </div>
              <div className="p-8 markdown-body bg-card">
                <ReadmeContent username={username} repoName={repoName} readmeOid={readmeOid} />
              </div>
            </div>
          )}
        </div>

        <aside className="lg:col-span-3 space-y-6 pt-2">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">About</h3>
            <p className="text-[14px] leading-relaxed text-foreground">{repo.description || "The fastest way to deploy and scale any application"}</p>

            <div className="flex items-center gap-2 text-[14px] text-accent hover:underline cursor-pointer font-medium">
              <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">example.com</span>
            </div>

            <div className="flex flex-wrap gap-x-1 gap-y-1.5 pt-1">
              {["go", "cloud", "oss", "hosting", "nuxt"].map((tag) => (
                <span key={tag} className="px-2.5 py-0.5 rounded-full bg-accent/10 text-accent text-[12px] font-semibold hover:bg-accent/20 cursor-pointer">
                  {tag}
                </span>
              ))}
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-[14px] text-foreground hover:text-accent cursor-pointer group">
                <Book className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="group-hover:underline">Readme</span>
              </div>
              <div className="flex items-center gap-2 text-[14px] text-foreground hover:text-accent cursor-pointer group">
                <Scale className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="group-hover:underline">Apache-2.0 license</span>
              </div>
              <div className="flex items-center gap-2 text-[14px] text-foreground hover:text-accent cursor-pointer group">
                <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="group-hover:underline">Activity</span>
              </div>
              <div className="flex items-center gap-2 text-[14px] text-foreground hover:text-accent cursor-pointer group">
                <Settings2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="group-hover:underline">Custom properties</span>
              </div>
              <div className="flex items-center gap-2 text-[14px] text-foreground hover:text-accent cursor-pointer group">
                <Star className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="group-hover:underline">
                  <span className="font-bold">{repo.starCount}</span> stars
                </span>
              </div>
              <div className="flex items-center gap-2 text-[14px] text-foreground hover:text-accent cursor-pointer group">
                <GitFork className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="group-hover:underline">
                  <span className="font-bold">0</span> forks
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-3 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground hover:text-accent cursor-pointer">Releases</h3>
            <p className="text-sm text-muted-foreground">No releases published</p>
            <button className="text-sm font-semibold text-accent hover:underline block text-left">Create a new release</button>
          </section>

          <section className="space-y-3 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground hover:text-accent cursor-pointer">Packages</h3>
            <p className="text-sm text-muted-foreground">No packages published</p>
            <button className="text-sm font-semibold text-accent hover:underline block text-left">Publish your first package</button>
          </section>

          <section className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between group cursor-pointer">
              <h3 className="text-sm font-semibold text-foreground hover:text-accent">Contributors</h3>
              <span className="px-1.5 py-0.5 rounded-full bg-muted-foreground/20 text-[10px] text-foreground font-bold">5</span>
            </div>
            <div className="flex -space-x-1.5 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <Avatar key={i} className="h-8 w-8 border-2 border-background ring-0">
                  <AvatarFallback className="bg-muted-foreground/20 text-[10px]">{i}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ReadmeContent({ username, repoName, readmeOid }: { username: string; repoName: string; readmeOid: string }) {
  const { data, isLoading } = useRepoReadme(username, repoName, readmeOid);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.content) return null;

  return <CodeViewer content={data.content} language="markdown" />;
}
