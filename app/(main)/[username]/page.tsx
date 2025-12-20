import { notFound } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRepositoriesWithStars } from "@/actions/repositories";
import { RepoList } from "@/components/repo-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, GitBranch, MapPin, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { GithubIcon, XIcon, LinkedInIcon } from "@/components/icons";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) {
    notFound();
  }

  const repos = await getUserRepositoriesWithStars(username);

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
          <div className="flex items-center gap-2 mb-6">
            <GitBranch className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Repositories</h2>
            <span className="text-sm text-muted-foreground">({repos.length})</span>
          </div>

          {repos.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-12 text-center">
              <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No repositories yet</h3>
              <p className="text-muted-foreground">{user.name} hasn&apos;t created any public repositories.</p>
            </div>
          ) : (
            <RepoList repos={repos} username={username} />
          )}
        </div>
      </div>
    </div>
  );
}
