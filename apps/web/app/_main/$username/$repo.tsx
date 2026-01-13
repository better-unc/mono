import { createFileRoute, Outlet, Link, useParams, useLocation } from "@tanstack/react-router";
import { useRepoPageData } from "@gitbruv/hooks";
import { Code, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_main/$username/$repo")({
  component: RepoLayout,
});

function RepoLayout() {
  const { username, repo: repoName } = useParams({ from: "/_main/$username/$repo" });
  const { data, isLoading } = useRepoPageData(username, repoName);
  const location = useLocation();

  if (isLoading || !data) return <Outlet />;

  const { isOwner } = data;
  const isSettings = location.pathname.includes("/settings");
  const isCode = !isSettings;

  return (
    <div className="min-h-screen">
      <Outlet />
      {isOwner && (
        <div className="fixed bottom-6 right-6">
          <Link
            to="/$username/$repo/settings"
            params={{ username, repo: repoName }}
            className={cn(
              "flex items-center justify-center w-10 h-10 bg-card border border-border hover:border-primary/50 hover:bg-primary/10 transition-all",
              isSettings && "bg-primary/10 border-primary/50"
            )}
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
