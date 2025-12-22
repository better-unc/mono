import { getSession } from "@/lib/session";
import { getUserRepositoriesWithStars } from "@/actions/repositories";
import { RepoList } from "@/components/repo-list";
import { Button } from "@/components/ui/button";
import { GitBranch, Plus, Rocket, Code, Users, BookOpen } from "lucide-react";
import Link from "next/link";

export default async function HomePage() {
  const session = await getSession();

  if (!session?.user) {
    return <LandingPage />;
  }

  const username = (session.user as { username?: string }).username || "";
  const repos = await getUserRepositoriesWithStars(username);

  return (
    <div className="container py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-64 shrink-0">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/30 to-primary/30 flex items-center justify-center text-lg font-bold">
              {session.user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{session.user.name}</p>
              <p className="text-sm text-muted-foreground truncate">@{username}</p>
            </div>
          </div>

          <nav className="mt-4 space-y-1">
            <Link href={`/${username}`} className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm hover:bg-card transition-colors">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Your repositories
            </Link>
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Repositories</h2>
            <Button asChild size="sm" className="gap-2">
              <Link href="/new">
                <Plus className="h-4 w-4" />
                New
              </Link>
            </Button>
          </div>

          {repos.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-12 text-center bg-card/30">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <GitBranch className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No repositories yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Create your first repository to start building something awesome</p>
              <Button asChild size="lg">
                <Link href="/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create repository
                </Link>
              </Button>
            </div>
          ) : (
            <RepoList repos={repos} username={username} />
          )}
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="flex flex-col">
      <section className="relative py-24 lg:py-36 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/20 via-background to-background" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiMzMDM2M2QiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="container relative text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-sm text-accent mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            Built for developers, by developers
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6">
            Where the world
            <br />
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">builds software</span>
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Host and review code, manage projects, and build software alongside millions of developers. Your code, your way.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="text-base h-12 px-8">
              <Link href="/register">Get started for free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-base h-12 px-8">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-border">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need to ship</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Powerful features to help you build, test, and deploy your projects faster</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={Code}
              title="Collaborative coding"
              description="Build better software together with powerful code review and collaboration tools."
            />
            <FeatureCard icon={Rocket} title="Ship faster" description="Automate your workflow with CI/CD pipelines and deploy with confidence." />
            <FeatureCard icon={Users} title="Open source" description="Join the world's largest developer community and contribute to projects." />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="group p-6 rounded-xl border border-border bg-card hover:border-accent/50 transition-all duration-300">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <Icon className="h-6 w-6 text-accent" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}
