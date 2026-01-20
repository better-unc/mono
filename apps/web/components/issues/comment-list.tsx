import type { IssueComment } from "@gitbruv/hooks";
import { CommentItem } from "./comment-item";

interface CommentListProps {
  comments: IssueComment[];
  currentUserId?: string;
  onToggleReaction: (commentId: string, emoji: string) => void;
  onUpdateComment: (commentId: string, body: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
}

export function CommentList({
  comments,
  currentUserId,
  onToggleReaction,
  onUpdateComment,
  onDeleteComment,
}: CommentListProps) {
  if (comments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          onToggleReaction={(emoji) => onToggleReaction(comment.id, emoji)}
          onUpdate={(body) => onUpdateComment(comment.id, body)}
          onDelete={() => onDeleteComment(comment.id)}
        />
      ))}
    </div>
  );
}
