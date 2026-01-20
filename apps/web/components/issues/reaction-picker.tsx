import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactionSummary } from "@gitbruv/hooks";

const REACTIONS = [
  { emoji: "+1", label: "👍" },
  { emoji: "-1", label: "👎" },
  { emoji: "laugh", label: "😄" },
  { emoji: "hooray", label: "🎉" },
  { emoji: "confused", label: "😕" },
  { emoji: "heart", label: "❤️" },
  { emoji: "rocket", label: "🚀" },
  { emoji: "eyes", label: "👀" },
];

function getEmojiLabel(emoji: string): string {
  return REACTIONS.find((r) => r.emoji === emoji)?.label || emoji;
}

interface ReactionPickerProps {
  reactions: ReactionSummary[];
  onToggle: (emoji: string) => void;
  disabled?: boolean;
}

export function ReactionPicker({ reactions, onToggle, disabled }: ReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => onToggle(reaction.emoji)}
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 text-xs border transition-colors",
            reaction.reacted
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-secondary/50 border-border hover:bg-secondary",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span>{getEmojiLabel(reaction.emoji)}</span>
          <span className="font-medium">{reaction.count}</span>
        </button>
      ))}

      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setShowPicker(!showPicker)}
          disabled={disabled}
        >
          <span className="text-sm">😀</span>
        </Button>

        {showPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
            <div className="absolute left-0 top-full mt-1 z-50 bg-popover border border-border shadow-lg p-2 flex gap-1">
              {REACTIONS.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => {
                    onToggle(r.emoji);
                    setShowPicker(false);
                  }}
                  className="p-1.5 hover:bg-secondary transition-colors text-base"
                  title={r.emoji}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ReactionDisplay({ reactions }: { reactions: ReactionSummary[] }) {
  if (reactions.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {reactions.map((reaction) => (
        <span
          key={reaction.emoji}
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"
        >
          <span>{getEmojiLabel(reaction.emoji)}</span>
          <span>{reaction.count}</span>
        </span>
      ))}
    </div>
  );
}
