import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Comment01Icon,
  AlertCircleIcon,
  GitPullRequestIcon,
  CheckmarkCircle02Icon,
  UserIcon,
} from "@hugeicons-pro/core-stroke-standard";
import { formatRelativeTime } from "@gitbruv/lib";
import type { Notification } from "@gitbruv/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, any> = {
  issue_comment: Comment01Icon,
  issue_assigned: AlertCircleIcon,
  issue_closed: CheckmarkCircle02Icon,
  pr_comment: Comment01Icon,
  pr_review: GitPullRequestIcon,
  pr_merged: GitPullRequestIcon,
  pr_assigned: GitPullRequestIcon,
  mention: UserIcon,
  discussion_reply: Comment01Icon,
};

function getNotificationUrl(notification: Notification): string {
  if (!notification.repoOwner || !notification.repoName || !notification.resourceNumber) {
    return "/";
  }

  const basePath = `/${notification.repoOwner}/${notification.repoName}`;

  switch (notification.resourceType) {
    case "issue":
      return `${basePath}/issues/${notification.resourceNumber}`;
    case "pull_request":
      return `${basePath}/pulls/${notification.resourceNumber}`;
    case "discussion":
      return `${basePath}/discussions/${notification.resourceNumber}`;
    default:
      return basePath;
  }
}

export function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead?: () => void;
}) {
  const Icon = typeIcons[notification.type] || Comment01Icon;
  const url = getNotificationUrl(notification);

  function handleClick() {
    if (!notification.read && onMarkRead) {
      onMarkRead();
    }
  }

  return (
    <Link
      to={url}
      onClick={handleClick}
      className={cn(
        "flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors",
        !notification.read && "bg-primary/5"
      )}
    >
      <div className="mt-0.5">
        {notification.actor ? (
          <Avatar className="size-8">
            <AvatarImage src={notification.actor.avatarUrl || undefined} />
            <AvatarFallback>
              {notification.actor.name?.charAt(0) || notification.actor.username?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="size-8 rounded-full bg-muted flex items-center justify-center">
            <HugeiconsIcon icon={Icon} strokeWidth={2} className="size-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm", !notification.read && "font-medium")}>
            {notification.title}
          </p>
          {!notification.read && (
            <div className="size-2 rounded-full bg-primary shrink-0 mt-1.5" />
          )}
        </div>

        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {notification.repoOwner && notification.repoName && (
            <span>
              {notification.repoOwner}/{notification.repoName}
            </span>
          )}
          <span>{formatRelativeTime(notification.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
