"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useIssueCount, useIssues, useLabels } from "@gitbruv/hooks";
import { Add01Icon, CheckmarkCircle02Icon, Loading02Icon, RecordIcon, TagsIcon } from "@hugeicons-pro/core-stroke-standard";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { parseAsStringLiteral, useQueryState } from "@/lib/hooks";
import { Suspense, useState } from "react";
import { IssueItem } from "@/components/issues/issue-item";

export const Route = createFileRoute("/_main/$username/$repo/issues/")({
  component: IssuesPage,
});

function IssuesContent() {
  const { username, repo } = Route.useParams();
  const [state, setState] = useQueryState("state", parseAsStringLiteral(["open", "closed"]).withDefault("open"));
  const [labelFilter, setLabelFilter] = useQueryState("label");

  const [showLabelFilter, setShowLabelFilter] = useState(false);

  const { data: countData, isLoading: isLoadingCount } = useIssueCount(username, repo);
  const { data: labelsData } = useLabels(username, repo);
  const { data: issuesData, isLoading: isLoadingIssues } = useIssues(username, repo, {
    state,
    label: labelFilter || undefined,
    limit: 30,
  });

  const isLoading = isLoadingCount || isLoadingIssues;
  const issues = issuesData?.issues || [];
  const labels = labelsData?.labels || [];
  const openCount = countData?.open || 0;
  const closedCount = countData?.closed || 0;

  return (
    <div className="container max-w-6xl px-4">
      {isLoading && !issues.length ? (
        <IssueListSkeleton />
      ) : (
        <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Tabs value={state} onValueChange={(value) => setState(value as "open" | "closed")}>
            <TabsList className="w-full justify-start h-auto mb-6 gap-2">
            <TabsTrigger value="open" className="gap-2 text-sm">
            <HugeiconsIcon icon={RecordIcon} strokeWidth={2} className="size-4" />
            <span>{openCount} Open</span>
            </TabsTrigger>
            <TabsTrigger value="closed" className="gap-2 text-sm">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />
            <span>{closedCount} Closed</span>
            </TabsTrigger>
          </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            {labels && labels.length > 0 && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLabelFilter(!showLabelFilter)}
                  className={cn(labelFilter && "border-primary")}
                >
                  <HugeiconsIcon icon={TagsIcon} strokeWidth={2} className="size-4 mr-1.5" />
                  {labelFilter || "Label"}
                </Button>
                {showLabelFilter && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowLabelFilter(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border shadow-lg p-1 min-w-[150px]">
                      {labelFilter && (
                        <button
                          onClick={() => {
                            setLabelFilter(null);
                            setShowLabelFilter(false);
                          }}
                          className="w-full px-3 py-1.5 text-sm text-left hover:bg-secondary transition-colors text-muted-foreground"
                        >
                          Clear filter
                        </button>
                      )}
                      {labels.map((label) => (
                        <button
                          key={label.id}
                          onClick={() => {
                            setLabelFilter(label.name);
                            setShowLabelFilter(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-secondary transition-colors",
                            labelFilter === label.name && "bg-secondary"
                          )}
                        >
                          <span
                            className="w-3 h-3 shrink-0"
                            style={{ backgroundColor: `#${label.color}` }}
                          />
                          {label.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <Link to="/$username/$repo/issues/new" params={{ username, repo }}>
              <Button size="sm">
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4 mr-1.5" />
                New issue
              </Button>
            </Link>
          </div>
        </div>

        <div className="border border-border bg-card overflow-hidden">
          {issues.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No issues found</p>
            </div>
          ) : (
            issues.map((issue) => (
              <IssueItem key={issue.id} issue={issue} username={username} repo={repo} />
            ))
          )}
        </div>

        {/* {issuesData?.hasMore && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
              {isLoading ? "Loading..." : "Load more"}
            </Button>
          </div>
        )} */}
      </div>
      )}
    </div>
  );
}

function IssuesPage() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-6xl px-4">
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
