"use client";

import { useState } from "react";
import type { FileDiff, DiffHunk, DiffHunkLine } from "@gitbruv/hooks";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  File01Icon,
  Add01Icon,
  Remove01Icon,
  ArrowExpandIcon,
  ArrowShrinkIcon,
} from "@hugeicons-pro/core-stroke-standard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type DiffViewMode = "unified" | "split";

export function DiffToolbar({
  stats,
  viewMode,
  onViewModeChange,
  fullWidth,
  onFullWidthChange,
}: {
  stats: { additions: number; deletions: number; filesChanged: number };
  viewMode: DiffViewMode;
  onViewModeChange: (mode: DiffViewMode) => void;
  fullWidth: boolean;
  onFullWidthChange: (fullWidth: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <DiffStats stats={stats} />
      <div className="flex items-center gap-2">
        <div className="flex border border-border">
          <Button
            variant={viewMode === "unified" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => onViewModeChange("unified")}
            className="border-0"
          >
            Unified
          </Button>
          <Button
            variant={viewMode === "split" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => onViewModeChange("split")}
            className="border-0 border-l border-border"
          >
            Split
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onFullWidthChange(!fullWidth)}
          title={fullWidth ? "Exit full width" : "Full width"}
        >
          <HugeiconsIcon
            icon={fullWidth ? ArrowShrinkIcon : ArrowExpandIcon}
            strokeWidth={2}
            className="size-4"
          />
        </Button>
      </div>
    </div>
  );
}

function FileHeader({
  file,
  isExpanded,
  onToggle,
}: {
  file: FileDiff;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusColors: Record<string, string> = {
    added: "text-green-600 dark:text-green-400",
    modified: "text-yellow-600 dark:text-yellow-400",
    deleted: "text-red-600 dark:text-red-400",
    renamed: "text-blue-600 dark:text-blue-400",
  };

  const statusLabels: Record<string, string> = {
    added: "Added",
    modified: "Modified",
    deleted: "Deleted",
    renamed: "Renamed",
  };

  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-4 py-2 bg-muted/50 hover:bg-muted/80 transition-colors text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        <HugeiconsIcon
          icon={isExpanded ? ArrowDown01Icon : ArrowUp01Icon}
          strokeWidth={2}
          className="size-4 shrink-0 text-muted-foreground"
        />
        <HugeiconsIcon icon={File01Icon} strokeWidth={2} className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-mono text-sm truncate">{file.path}</span>
        <span className={cn("text-xs font-medium shrink-0", statusColors[file.status])}>
          {statusLabels[file.status]}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        {file.additions > 0 && (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-mono">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3" />
            {file.additions}
          </span>
        )}
        {file.deletions > 0 && (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm font-mono">
            <HugeiconsIcon icon={Remove01Icon} strokeWidth={2} className="size-3" />
            {file.deletions}
          </span>
        )}
      </div>
    </button>
  );
}

function UnifiedDiffHunkView({ hunk }: { hunk: DiffHunk }) {
  return (
    <div className="border-t border-border">
      <div className="px-4 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs font-mono">
        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
      </div>
      <div className="font-mono text-sm">
        {hunk.lines.map((line, idx) => {
          const bgColor =
            line.type === "addition"
              ? "bg-green-50 dark:bg-green-950/30"
              : line.type === "deletion"
                ? "bg-red-50 dark:bg-red-950/30"
                : "";

          const textColor =
            line.type === "addition"
              ? "text-green-800 dark:text-green-200"
              : line.type === "deletion"
                ? "text-red-800 dark:text-red-200"
                : "text-foreground";

          const lineNumColor =
            line.type === "addition"
              ? "text-green-600 dark:text-green-400"
              : line.type === "deletion"
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground";

          const prefix = line.type === "addition" ? "+" : line.type === "deletion" ? "-" : " ";

          return (
            <div key={idx} className={cn("flex", bgColor)}>
              <div
                className={cn(
                  "w-12 shrink-0 text-right pr-2 select-none border-r border-border",
                  lineNumColor
                )}
              >
                {line.oldLineNumber || ""}
              </div>
              <div
                className={cn(
                  "w-12 shrink-0 text-right pr-2 select-none border-r border-border",
                  lineNumColor
                )}
              >
                {line.newLineNumber || ""}
              </div>
              <div className={cn("px-2 flex-1 whitespace-pre overflow-x-auto", textColor)}>
                <span className="select-none mr-1">{prefix}</span>
                {line.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type SplitLine = {
  left: DiffHunkLine | null;
  right: DiffHunkLine | null;
};

function buildSplitLines(hunk: DiffHunk): SplitLine[] {
  const lines: SplitLine[] = [];
  let i = 0;
  const hunkLines = hunk.lines;

  while (i < hunkLines.length) {
    const line = hunkLines[i];

    if (line.type === "context") {
      lines.push({ left: line, right: line });
      i++;
    } else if (line.type === "deletion") {
      const deletions: DiffHunkLine[] = [];
      while (i < hunkLines.length && hunkLines[i].type === "deletion") {
        deletions.push(hunkLines[i]);
        i++;
      }

      const additions: DiffHunkLine[] = [];
      while (i < hunkLines.length && hunkLines[i].type === "addition") {
        additions.push(hunkLines[i]);
        i++;
      }

      const maxLen = Math.max(deletions.length, additions.length);
      for (let j = 0; j < maxLen; j++) {
        lines.push({
          left: deletions[j] || null,
          right: additions[j] || null,
        });
      }
    } else if (line.type === "addition") {
      lines.push({ left: null, right: line });
      i++;
    } else {
      i++;
    }
  }

  return lines;
}

function SplitDiffHunkView({ hunk }: { hunk: DiffHunk }) {
  const splitLines = buildSplitLines(hunk);

  return (
    <div className="border-t border-border">
      <div className="px-4 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs font-mono">
        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
      </div>
      <div className="font-mono text-sm flex">
        <div className="flex-1 min-w-0 border-r border-border">
          {splitLines.map((pair, idx) => {
            const line = pair.left;
            const isEmpty = !line;
            const isDeletion = line?.type === "deletion";

            const bgColor = isDeletion
              ? "bg-red-50 dark:bg-red-950/30"
              : isEmpty
                ? "bg-muted/20"
                : "";

            const textColor = isDeletion
              ? "text-red-800 dark:text-red-200"
              : "text-foreground";

            const lineNumColor = isDeletion
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground";

            return (
              <div key={idx} className={cn("flex", bgColor)}>
                <div
                  className={cn(
                    "w-12 shrink-0 text-right pr-2 select-none border-r border-border",
                    lineNumColor
                  )}
                >
                  {line?.oldLineNumber || ""}
                </div>
                <div className={cn("px-2 flex-1 whitespace-pre overflow-x-auto min-h-6", textColor)}>
                  {line?.content || ""}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex-1 min-w-0">
          {splitLines.map((pair, idx) => {
            const line = pair.right;
            const isEmpty = !line;
            const isAddition = line?.type === "addition";

            const bgColor = isAddition
              ? "bg-green-50 dark:bg-green-950/30"
              : isEmpty
                ? "bg-muted/20"
                : "";

            const textColor = isAddition
              ? "text-green-800 dark:text-green-200"
              : "text-foreground";

            const lineNumColor = isAddition
              ? "text-green-600 dark:text-green-400"
              : "text-muted-foreground";

            return (
              <div key={idx} className={cn("flex", bgColor)}>
                <div
                  className={cn(
                    "w-12 shrink-0 text-right pr-2 select-none border-r border-border",
                    lineNumColor
                  )}
                >
                  {line?.newLineNumber || ""}
                </div>
                <div className={cn("px-2 flex-1 whitespace-pre overflow-x-auto min-h-6", textColor)}>
                  {line?.content || ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FileDiffView({ file, viewMode }: { file: FileDiff; viewMode: DiffViewMode }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const HunkComponent = viewMode === "split" ? SplitDiffHunkView : UnifiedDiffHunkView;

  return (
    <div className="border border-border overflow-hidden">
      <FileHeader file={file} isExpanded={isExpanded} onToggle={() => setIsExpanded(!isExpanded)} />
      {isExpanded && (
        <div className="overflow-x-auto">
          {file.hunks.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No changes to display (binary file or empty diff)
            </div>
          ) : (
            file.hunks.map((hunk, idx) => <HunkComponent key={idx} hunk={hunk} />)
          )}
        </div>
      )}
    </div>
  );
}

export function DiffViewer({
  files,
  viewMode = "unified",
}: {
  files: FileDiff[];
  viewMode?: DiffViewMode;
}) {
  if (files.length === 0) {
    return (
      <div className="border border-border p-8 text-center text-muted-foreground">
        No files changed in this commit
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {files.map((file, idx) => (
        <FileDiffView key={file.path + idx} file={file} viewMode={viewMode} />
      ))}
    </div>
  );
}

export function DiffStats({
  stats,
}: {
  stats: { additions: number; deletions: number; filesChanged: number };
}) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-muted-foreground">
        {stats.filesChanged} file{stats.filesChanged !== 1 ? "s" : ""} changed
      </span>
      {stats.additions > 0 && (
        <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-mono">
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3" />
          {stats.additions} addition{stats.additions !== 1 ? "s" : ""}
        </span>
      )}
      {stats.deletions > 0 && (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-mono">
          <HugeiconsIcon icon={Remove01Icon} strokeWidth={2} className="size-3" />
          {stats.deletions} deletion{stats.deletions !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
