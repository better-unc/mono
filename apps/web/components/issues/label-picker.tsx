import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { TagsIcon, Add01Icon, Tick02Icon } from "@hugeicons-pro/core-stroke-standard";
import type { Label } from "@gitbruv/hooks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LabelBadge } from "./label-badge";

interface LabelPickerProps {
  labels: Label[];
  selectedIds: string[];
  onToggle: (labelId: string) => void;
  isLoading?: boolean;
}

export function LabelPicker({ labels, selectedIds, onToggle, isLoading }: LabelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabels = labels.filter((l) => selectedIds.includes(l.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Labels</span>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => setIsOpen(!isOpen)}
            disabled={isLoading}
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
          </Button>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border shadow-lg p-1 min-w-[200px] max-h-[300px] overflow-y-auto">
                {labels.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No labels</p>
                ) : (
                  labels.map((label) => {
                    const isSelected = selectedIds.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        onClick={() => onToggle(label.id)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary transition-colors"
                      >
                        <span
                          className="w-3 h-3 shrink-0"
                          style={{ backgroundColor: `#${label.color}` }}
                        />
                        <span className="flex-1 text-left truncate">{label.name}</span>
                        {isSelected && (
                          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4 text-primary" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {selectedLabels.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedLabels.map((label) => (
            <LabelBadge
              key={label.id}
              label={label}
              removable
              onRemove={() => onToggle(label.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">None yet</p>
      )}
    </div>
  );
}
