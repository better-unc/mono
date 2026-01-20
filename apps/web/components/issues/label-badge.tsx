import type { Label } from "@gitbruv/hooks";
import { cn } from "@/lib/utils";

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

interface LabelBadgeProps {
  label: Label;
  onClick?: () => void;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

export function LabelBadge({ label, onClick, removable, onRemove, className }: LabelBadgeProps) {
  const bgColor = `#${label.color}`;
  const textColor = getContrastColor(label.color);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium",
        onClick && "cursor-pointer hover:opacity-80",
        className
      )}
      style={{ backgroundColor: bgColor, color: textColor }}
      onClick={onClick}
    >
      {label.name}
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-70"
        >
          ×
        </button>
      )}
    </span>
  );
}
