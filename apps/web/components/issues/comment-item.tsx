import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { timeAgo } from "@gitbruv/lib";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon, Edit02Icon, Delete02Icon } from "@hugeicons-pro/core-stroke-standard";
import type { IssueComment } from "@gitbruv/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CodeViewer } from "@/components/code-viewer";
import { ReactionPicker } from "./reaction-picker";

interface CommentItemProps {
  comment: IssueComment;
  currentUserId?: string;
  onToggleReaction: (emoji: string) => void;
  onUpdate: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function CommentItem({ comment, currentUserId, onToggleReaction, onUpdate, onDelete }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [showMenu, setShowMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthor = currentUserId === comment.author.id;
  const isEdited = comment.createdAt !== comment.updatedAt;

  const handleUpdate = async () => {
    if (!editBody.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onUpdate(editBody);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onDelete();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2 bg-secondary/30 border-b border-border">
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarImage src={comment.author.avatarUrl || undefined} />
            <AvatarFallback className="text-[10px]">{comment.author.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <Link
            to="/$username"
            params={{ username: comment.author.username }}
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            {comment.author.username}
          </Link>
          <span className="text-xs text-muted-foreground">
            commented {timeAgo(comment.createdAt)}
          </span>
          {isEdited && <span className="text-xs text-muted-foreground">(edited)</span>}
        </div>

        {isAuthor && (
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowMenu(!showMenu)}
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
            </Button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border shadow-lg py-1 min-w-[120px]">
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary transition-colors"
                  >
                    <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      handleDelete();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-secondary transition-colors"
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleUpdate} disabled={isSubmitting || !editBody.trim()}>
                {isSubmitting ? "Updating..." : "Update comment"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setEditBody(comment.body);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <CodeViewer content={comment.body} language="markdown" className="p-0 md:p-0" />
        )}
      </div>

      <div className="px-4 pb-3">
        <ReactionPicker
          reactions={comment.reactions}
          onToggle={onToggleReaction}
          disabled={!currentUserId}
        />
      </div>
    </div>
  );
}
