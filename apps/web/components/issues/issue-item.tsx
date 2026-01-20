import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Comment01Icon } from "@hugeicons-pro/core-stroke-standard";
import type { Issue } from "@gitbruv/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StateBadge } from "./state-badge";
import { LabelBadge } from "./label-badge";

interface IssueItemProps {
  issue: Issue;
  username: string;
  repo: string;
}

export function IssueItem({ issue, username, repo }: IssueItemProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors">
      <StateBadge state={issue.state} className="mt-0.5 shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <Link
            to="/$username/$repo/issues/$number"
            params={{ username, repo, number: String(issue.number) }}
            className="font-semibold text-foreground hover:text-primary transition-colors"
          >
            {issue.title}
          </Link>
          {issue.labels.map((label) => (
            <LabelBadge key={label.id} label={label} />
          ))}
        </div>

        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>#{issue.number}</span>
          <span>opened {formatDistanceToNow(new Date(issue.createdAt))} ago</span>
          <span>by</span>
          <Link
            to="/$username"
            params={{ username: issue.author.username }}
            className="hover:text-foreground transition-colors"
          >
            {issue.author.username}
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {issue.assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {issue.assignees.slice(0, 3).map((assignee) => (
              <Avatar key={assignee.id} className="h-5 w-5 border-2 border-background">
                <AvatarImage src={assignee.avatarUrl || undefined} />
                <AvatarFallback className="text-[10px]">{assignee.name.charAt(0)}</AvatarFallback>
              </Avatar>
            ))}
            {issue.assignees.length > 3 && (
              <span className="flex items-center justify-center h-5 w-5 bg-secondary text-[10px] font-medium border-2 border-background">
                +{issue.assignees.length - 3}
              </span>
            )}
          </div>
        )}

        {issue.commentCount > 0 && (
          <Link
            to="/$username/$repo/issues/$number"
            params={{ username, repo, number: String(issue.number) }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} className="size-3.5" />
            <span>{issue.commentCount}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
