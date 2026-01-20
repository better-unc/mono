import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, RecordIcon, CheckmarkCircle02Icon, TagsIcon } from "@hugeicons-pro/core-stroke-standard";
import type { Issue, Label } from "@gitbruv/hooks";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IssueItem } from "./issue-item";
import { cn } from "@/lib/utils";

interface IssueListProps {
  issues: Issue[];
  username: string;
  repo: string;
  openCount: number;
  closedCount: number;
  currentState: "open" | "closed";
  onStateChange: (state: "open" | "closed") => void;
  labels?: Label[];
  currentLabel?: string;
  onLabelChange?: (label: string | undefined) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoading?: boolean;
}

export function IssueList({
  issues,
  username,
  repo,
  openCount,
  closedCount,
  currentState,
  onStateChange,
  labels,
  currentLabel,
  onLabelChange,
  hasMore,
  onLoadMore,
  isLoading,
}: IssueListProps) {
  const [showLabelFilter, setShowLabelFilter] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Tabs value={currentState} onValueChange={(value) => onStateChange(value as "open" | "closed")}>
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
                className={cn(currentLabel && "border-primary")}
              >
                <HugeiconsIcon icon={TagsIcon} strokeWidth={2} className="size-4 mr-1.5" />
                {currentLabel || "Label"}
              </Button>
              {showLabelFilter && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLabelFilter(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border shadow-lg p-1 min-w-[150px]">
                    {currentLabel && (
                      <button
                        onClick={() => {
                          onLabelChange?.(undefined);
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
                          onLabelChange?.(label.name);
                          setShowLabelFilter(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-secondary transition-colors",
                          currentLabel === label.name && "bg-secondary"
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

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
