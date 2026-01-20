import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentFormProps {
  currentUserAvatar?: string | null;
  currentUserName?: string;
  onSubmit: (body: string) => Promise<void>;
  placeholder?: string;
  submitLabel?: string;
}

export function CommentForm({
  currentUserAvatar,
  currentUserName,
  onSubmit,
  placeholder = "Leave a comment...",
  submitLabel = "Comment",
}: CommentFormProps) {
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!body.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(body);
      setBody("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={currentUserAvatar || undefined} />
        <AvatarFallback className="text-xs">{currentUserName?.charAt(0) || "?"}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={isSubmitting || !body.trim()}>
            {isSubmitting ? "Submitting..." : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
