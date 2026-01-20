import { Suspense } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, Loading02Icon } from "@hugeicons-pro/core-stroke-standard";
import { useIssues, useIssueCount, useLabels } from "@gitbruv/hooks";
import { IssueList } from "@/components/issues";

export const Route = createFileRoute("/_main/$username/$repo/issues/")({
  component: IssuesPage,
});

function IssuesContent() {
  const { username, repo } = Route.useParams();
  const [state, setState] = useQueryState("state", parseAsStringLiteral(["open", "closed"]).withDefault("open"));
  const [labelFilter, setLabelFilter] = useQueryState("label");

  const { data: countData, isLoading: isLoadingCount } = useIssueCount(username, repo);
  const { data: labelsData, isLoading: isLoadingLabels } = useLabels(username, repo);
  const { data: issuesData, isLoading: isLoadingIssues } = useIssues(username, repo, {
    state,
    label: labelFilter || undefined,
    limit: 30,
  });

  const isLoading =  isLoadingCount || isLoadingIssues;
  const issues = issuesData?.issues || [];
  const labels = labelsData?.labels || [];
  const openCount = countData?.open || 0;
  const closedCount = countData?.closed || 0;

  return (
    <div className="container max-w-5xl px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Issues</h1>
          <p className="text-sm text-muted-foreground">
            <Link to="/$username/$repo" params={{ username, repo }} className="hover:underline">
              {username}/{repo}
            </Link>
          </p>
        </div>
      </div>

      {isLoading && !issues.length ? (
        <IssueListSkeleton />
      ) : (
        <IssueList
          issues={issues}
          username={username}
          repo={repo}
          openCount={openCount}
          closedCount={closedCount}
          currentState={state}
          onStateChange={(value) => setState(value === "open" ? null : value)}
          labels={labels}
          currentLabel={labelFilter || undefined}
          onLabelChange={(label) => setLabelFilter(label || null)}
          hasMore={issuesData?.hasMore}
          isLoading={isLoadingIssues}
        />
      )}
    </div>
  );
}

function IssuesPage() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-5xl px-4 py-6">
          <div className="flex items-center justify-center py-12">
            <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      }
    >
      <IssuesContent />
    </Suspense>
  );
}

function IssueListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-secondary/50" />
          <div className="h-8 w-24 bg-secondary/50" />
        </div>
        <div className="h-8 w-28 bg-secondary/50" />
      </div>
      <div className="border border-border bg-card overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
            <div className="h-6 w-16 bg-secondary/50" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 bg-secondary/50" />
              <div className="h-3 w-1/2 bg-secondary/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
