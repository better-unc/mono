import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading02Icon, Cancel01Icon } from "@hugeicons-pro/core-stroke-standard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type InlineCommentFormProps = {
  onSubmit: (body: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  placeholder?: string;
  submitLabel?: string;
  replyTo?: string;
};

export function InlineCommentForm({
  onSubmit,
  onCancel,
  isLoading = false,
  placeholder = "Leave a comment...",
  submitLabel = "Add comment",
  replyTo,
}: InlineCommentFormProps) {
  const [body, setBody] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || isLoading) return;
    await onSubmit(body);
    setBody("");
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-card border border-border rounded-md space-y-3">
      {replyTo && (
        <div className="text-xs text-muted-foreground">
          Replying to comment
        </div>
      )}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="resize-none text-sm"
        disabled={isLoading}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isLoading}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4 mr-1" />
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!body.trim() || isLoading}
        >
          {isLoading ? (
            <>
              <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-1 animate-spin" />
              Submitting...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}
