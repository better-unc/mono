import { Link, createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Message01Icon, PinIcon, CheckmarkCircle02Icon, Loading02Icon, Add01Icon } from "@hugeicons-pro/core-stroke-standard";
import { useDiscussions } from "@gitbruv/hooks";
import { formatRelativeTime } from "@gitbruv/lib";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_main/$username/$repo/discussions/")({
  component: DiscussionsListPage,
});

function DiscussionsListPage() {
  const { username, repo } = Route.useParams();
  const { data, isLoading } = useDiscussions(username, repo);

  const discussions = data?.discussions || [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Discussions</h1>
        <Button asChild>
          <Link to="/$username/$repo/discussions/new" params={{ username, repo }}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4 mr-2" />
            New discussion
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16">
          <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 mx-auto animate-spin text-muted-foreground" />
        </div>
      ) : discussions.length === 0 ? (
        <div className="text-center py-16 border border-border">
          <HugeiconsIcon icon={Message01Icon} strokeWidth={2} className="size-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-medium mb-2">No discussions yet</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Start a discussion to engage with the community.
          </p>
          <Button asChild>
            <Link to="/$username/$repo/discussions/new" params={{ username, repo }}>
              Start a discussion
            </Link>
          </Button>
        </div>
      ) : (
        <div className="border border-border divide-y divide-border">
          {discussions.map((discussion) => (
            <Link
              key={discussion.id}
              to="/$username/$repo/discussions/$number"
              params={{ username, repo, number: String(discussion.number) }}
              className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors"
            >
              <Avatar className="size-10 shrink-0">
                <AvatarImage src={discussion.author.avatarUrl || undefined} />
                <AvatarFallback>
                  {discussion.author.name?.charAt(0) || discussion.author.username?.charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {discussion.isPinned && (
                    <HugeiconsIcon icon={PinIcon} strokeWidth={2} className="size-4 text-yellow-500" />
                  )}
                  {discussion.isAnswered && (
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-green-500" />
                  )}
                  <span className="font-medium hover:text-primary">{discussion.title}</span>
                  {discussion.category && (
                    <span className="text-xs bg-muted px-2 py-0.5">
                      {discussion.category.emoji} {discussion.category.name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span>#{discussion.number}</span>
                  <span>by {discussion.author.username}</span>
                  <span>{formatRelativeTime(discussion.createdAt)}</span>
                  <span className="flex items-center gap-1">
                    <HugeiconsIcon icon={Message01Icon} strokeWidth={2} className="size-3.5" />
                    {discussion.commentCount}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
