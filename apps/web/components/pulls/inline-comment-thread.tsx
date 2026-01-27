import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Message01Icon, MoreVerticalIcon } from "@hugeicons-pro/core-stroke-standard";
import { formatRelativeTime } from "@gitbruv/lib";
import type { PRComment } from "@gitbruv/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { InlineCommentForm } from "./inline-comment-form";

export type InlineCommentThreadProps = {
  comments: PRComment[];
  onReply: (body: string, replyToId: string) => Promise<void>;
  onEdit?: (commentId: string, body: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  currentUserId?: string;
  isReplying?: boolean;
};

function CommentItem({
  comment,
  onEdit,
  onDelete,
  currentUserId,
}: {
  comment: PRComment;
  onEdit?: (body: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  currentUserId?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const isAuthor = currentUserId === comment.author.id;

  async function handleSaveEdit() {
    if (!editBody.trim() || !onEdit) return;
    await onEdit(editBody);
    setIsEditing(false);
  }

  return (
    <div className="flex gap-3 p-3">
      <Avatar className="size-6 shrink-0">
        <AvatarImage src={comment.author.avatarUrl || undefined} alt={comment.author.name} />
        <AvatarFallback className="text-xs">
          {comment.author.name?.charAt(0) || comment.author.username?.charAt(0) || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <Link
            to="/$username"
            params={{ username: comment.author.username }}
            className="font-medium hover:underline"
          >
            {comment.author.username}
          </Link>
          <span className="text-muted-foreground text-xs">
            {formatRelativeTime(comment.createdAt)}
          </span>
          {comment.createdAt !== comment.updatedAt && (
            <span className="text-muted-foreground text-xs">(edited)</span>
          )}
        </div>
        {isEditing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="w-full p-2 text-sm border border-border rounded bg-background resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="xs" onClick={handleSaveEdit}>
                Save
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">
            {comment.body}
          </div>
        )}
      </div>
      {isAuthor && !isEditing && (
        <div className="flex items-start">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsEditing(true)}
            title="Edit"
          >
            <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function InlineCommentThread({
  comments,
  onReply,
  onEdit,
  onDelete,
  currentUserId,
  isReplying: externalIsReplying = false,
}: InlineCommentThreadProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);

  const rootComments = comments.filter((c) => !c.replyToId);
  const replies = comments.filter((c) => c.replyToId);

  function getReplies(commentId: string): PRComment[] {
    return replies.filter((r) => r.replyToId === commentId);
  }

  async function handleReply(body: string) {
    if (comments.length === 0) return;
    setReplyLoading(true);
    try {
      await onReply(body, comments[0].id);
      setIsReplying(false);
    } finally {
      setReplyLoading(false);
    }
  }

  return (
    <div className="border border-border rounded-md bg-card/50 overflow-hidden">
      {rootComments.map((comment) => (
        <div key={comment.id}>
          <CommentItem
            comment={comment}
            onEdit={onEdit ? (body) => onEdit(comment.id, body) : undefined}
            onDelete={onDelete ? () => onDelete(comment.id) : undefined}
            currentUserId={currentUserId}
          />
          {getReplies(comment.id).map((reply) => (
            <div key={reply.id} className="ml-6 border-l-2 border-border">
              <CommentItem
                comment={reply}
                onEdit={onEdit ? (body) => onEdit(reply.id, body) : undefined}
                onDelete={onDelete ? () => onDelete(reply.id) : undefined}
                currentUserId={currentUserId}
              />
            </div>
          ))}
        </div>
      ))}

      {isReplying || externalIsReplying ? (
        <div className="border-t border-border">
          <InlineCommentForm
            onSubmit={handleReply}
            onCancel={() => setIsReplying(false)}
            isLoading={replyLoading}
            placeholder="Reply..."
            submitLabel="Reply"
          />
        </div>
      ) : (
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsReplying(true)}
            className="text-muted-foreground"
          >
            <HugeiconsIcon icon={Message01Icon} strokeWidth={2} className="size-4 mr-1" />
            Reply
          </Button>
        </div>
      )}
    </div>
  );
}
