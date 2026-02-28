import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Loading02Icon,
  CheckmarkCircle02Icon,
  PinIcon,
  LockIcon,
  ArrowLeft02Icon,
} from "@hugeicons-pro/core-stroke-standard";
import {
  useDiscussion,
  useDiscussionComments,
  useCreateDiscussionComment,
  useMarkDiscussionAnswer,
} from "@gitbruv/hooks";
import { formatRelativeTime } from "@gitbruv/lib";
import { useSession } from "@/lib/auth-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_main/$username/$repo/discussions/$number")({
  component: DiscussionDetailPage,
});

function DiscussionDetailPage() {
  const { username, repo, number } = Route.useParams();
  const discussionNumber = parseInt(number, 10);
  const { data: session } = useSession();
  const [commentBody, setCommentBody] = useState("");

  const { data: discussion, isLoading: discussionLoading } = useDiscussion(username, repo, discussionNumber);
  const { data: commentsData } = useDiscussionComments(discussion?.id || "");
  const createComment = useCreateDiscussionComment(discussion?.id || "", username, repo, discussionNumber);
  const markAnswer = useMarkDiscussionAnswer(discussion?.id || "", username, repo, discussionNumber);

  const comments = commentsData?.comments || [];
  const isAuthor = session?.user?.id === discussion?.author.id;

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();

    if (!commentBody.trim()) return;

    try {
      await createComment.mutateAsync({ body: commentBody });
      setCommentBody("");
      toast.success("Comment added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add comment");
    }
  }

  async function handleMarkAnswer(commentId: string) {
    try {
      await markAnswer.mutateAsync(commentId);
      toast.success("Answer updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update answer");
    }
  }

  if (discussionLoading) {
    return (
      <div className="text-center py-16">
        <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 mx-auto animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!discussion) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Discussion not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/$username/$repo/discussions"
        params={{ username, repo }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
        Back to discussions
      </Link>

      <div className="border border-border mb-6">
        <div className="p-6">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {discussion.isPinned && (
              <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5">
                <HugeiconsIcon icon={PinIcon} strokeWidth={2} className="size-3" />
                Pinned
              </span>
            )}
            {discussion.isAnswered && (
              <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-600 px-2 py-0.5">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3" />
                Answered
              </span>
            )}
            {discussion.isLocked && (
              <span className="inline-flex items-center gap-1 text-xs bg-red-500/10 text-red-600 px-2 py-0.5">
                <HugeiconsIcon icon={LockIcon} strokeWidth={2} className="size-3" />
                Locked
              </span>
            )}
            {discussion.category && (
              <span className="text-xs bg-muted px-2 py-0.5">
                {discussion.category.emoji} {discussion.category.name}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-semibold mb-4">{discussion.title}</h1>

          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-6">
            <Avatar className="size-6">
              <AvatarImage src={discussion.author.avatarUrl || undefined} />
              <AvatarFallback className="text-xs">
                {discussion.author.name?.charAt(0) || discussion.author.username?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <Link to="/$username" params={{ username: discussion.author.username }} className="hover:underline">
              {discussion.author.username}
            </Link>
            <span>started this discussion {formatRelativeTime(discussion.createdAt)}</span>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap">{discussion.body}</p>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4">{comments.length} comment{comments.length !== 1 ? "s" : ""}</h2>

      <div className="space-y-4 mb-6">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={cn(
              "border border-border p-4",
              comment.isAnswer && "border-green-500 bg-green-500/5"
            )}
          >
            {comment.isAnswer && (
              <div className="flex items-center gap-1 text-xs text-green-600 mb-2">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3" />
                Accepted answer
              </div>
            )}

            <div className="flex items-start gap-3">
              <Avatar className="size-8">
                <AvatarImage src={comment.author.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {comment.author.name?.charAt(0) || comment.author.username?.charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Link to="/$username" params={{ username: comment.author.username }} className="font-medium hover:underline">
                      {comment.author.username}
                    </Link>
                    <span className="text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
                  </div>

                  {isAuthor && !comment.isAnswer && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleMarkAnswer(comment.id)}
                      disabled={markAnswer.isPending}
                    >
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3 mr-1" />
                      Mark as answer
                    </Button>
                  )}
                </div>

                <div className="mt-2 text-sm whitespace-pre-wrap">{comment.body}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!discussion.isLocked && session?.user && (
        <form onSubmit={handleSubmitComment} className="border border-border p-4">
          <Textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add a comment..."
            rows={4}
            className="mb-3"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={!commentBody.trim() || createComment.isPending}>
              {createComment.isPending ? (
                <>
                  <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                "Comment"
              )}
            </Button>
          </div>
        </form>
      )}

      {discussion.isLocked && (
        <div className="text-center py-8 text-muted-foreground text-sm border border-border">
          <HugeiconsIcon icon={LockIcon} strokeWidth={2} className="size-6 mx-auto mb-2" />
          This discussion is locked. You cannot add new comments.
        </div>
      )}
    </div>
  );
}
