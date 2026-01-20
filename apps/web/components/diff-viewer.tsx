"use client";

import { useState } from "react";
import type { FileDiff } from "@gitbruv/hooks";
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
import { PatchDiff } from "@pierre/diffs/react";

function fileDiffToUnifiedDiff(file: FileDiff): string {
  const lines: string[] = [];

  const oldPath = file.oldPath || file.path;
  const newPath = file.path;

  lines.push(`--- a/${oldPath}`);
  lines.push(`+++ b/${newPath}`);

  for (const hunk of file.hunks) {
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);

    for (const line of hunk.lines) {
      const prefix = line.type === "addition" ? "+" : line.type === "deletion" ? "-" : " ";
      lines.push(prefix + line.content);
    }
  }

  return lines.join("\n");
}

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

function FileDiffView({ file, viewMode }: { file: FileDiff; viewMode: DiffViewMode }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const patchContent = fileDiffToUnifiedDiff(file);

  return (
    <div className="border border-border overflow-hidden">
      <FileHeader file={file} isExpanded={isExpanded} onToggle={() => setIsExpanded(!isExpanded)} />
      {isExpanded && (
        file.hunks.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            No changes to display (binary file or empty diff)
          </div>
        ) : (
          <PatchDiff
            patch={patchContent}
            options={{
              disableFileHeader: true,
              diffStyle: viewMode === "unified" ? "unified" : "split",
            }}
          />
        )
      )}
    </div>
  );
}

export function DiffViewer({ files, viewMode }: { files: FileDiff[]; viewMode: DiffViewMode }) {
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
