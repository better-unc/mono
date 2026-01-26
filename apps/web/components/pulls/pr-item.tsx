import { Link } from "@tanstack/react-router";
import { timeAgo } from "@gitbruv/lib";
import { HugeiconsIcon } from "@hugeicons/react";
import { Comment01Icon, GitBranchIcon, GitMergeIcon } from "@hugeicons-pro/core-stroke-standard";
import type { PullRequest } from "@gitbruv/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PRStateBadge } from "./pr-state-badge";
import { LabelBadge } from "@/components/issues/label-badge";

interface PRItemProps {
  pullRequest: PullRequest;
  username: string;
  repo: string;
}

export function PRItem({ pullRequest, username, repo }: PRItemProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors">
      <PRStateBadge state={pullRequest.state} merged={pullRequest.merged} className="mt-0.5 shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <Link
            to="/$username/$repo/pulls/$number"
            params={{ username, repo, number: String(pullRequest.number) }}
            className="font-semibold text-foreground hover:text-primary transition-colors"
          >
            {pullRequest.title}
          </Link>
          {pullRequest.labels.map((label) => (
            <LabelBadge key={label.id} label={label} />
          ))}
        </div>

        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>#{pullRequest.number}</span>
          <span>opened {timeAgo(pullRequest.createdAt)}</span>
          <span>by</span>
          <Link
            to="/$username"
            params={{ username: pullRequest.author.username }}
            className="hover:text-foreground transition-colors"
          >
            {pullRequest.author.username}
          </Link>
        </div>

        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground font-mono">
          <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} className="size-3" />
          <span>{pullRequest.headBranch}</span>
          <HugeiconsIcon icon={GitMergeIcon} strokeWidth={2} className="size-3 mx-1" />
          <span>{pullRequest.baseBranch}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {pullRequest.reviews.length > 0 && (
          <div className="flex items-center gap-1">
            {pullRequest.reviews.some((r) => r.state === "approved") && (
              <span className="text-xs text-green-600 dark:text-green-400">Approved</span>
            )}
            {pullRequest.reviews.some((r) => r.state === "changes_requested") && (
              <span className="text-xs text-red-600 dark:text-red-400">Changes requested</span>
            )}
          </div>
        )}

        {pullRequest.assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {pullRequest.assignees.slice(0, 3).map((assignee) => (
              <Avatar key={assignee.id} className="h-5 w-5 border-2 border-background">
                <AvatarImage src={assignee.avatarUrl || undefined} />
                <AvatarFallback className="text-[10px]">{assignee.name.charAt(0)}</AvatarFallback>
              </Avatar>
            ))}
            {pullRequest.assignees.length > 3 && (
              <span className="flex items-center justify-center h-5 w-5 bg-secondary text-[10px] font-medium border-2 border-background">
                +{pullRequest.assignees.length - 3}
              </span>
            )}
          </div>
        )}

        {pullRequest.commentCount > 0 && (
          <Link
            to="/$username/$repo/pulls/$number"
            params={{ username, repo, number: String(pullRequest.number) }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} className="size-3.5" />
            <span>{pullRequest.commentCount}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
