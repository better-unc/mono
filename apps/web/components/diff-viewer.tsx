"use client";

import { useTheme } from "tanstack-theme-kit";
import { useCallback, useRef, useState } from "react";
import { PatchDiff } from "@pierre/diffs/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowExpandIcon,
  ArrowShrinkIcon,
  ArrowUp01Icon,
  File01Icon,
  FileAddIcon,
  FileEditIcon,
  FileRemoveIcon,
  FileSyncIcon,
  Remove01Icon,
} from "@hugeicons-pro/core-stroke-standard";

import type { FileDiff } from "@gitbruv/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function fileDiffToUnifiedDiff(file: FileDiff): string {
  const lines: string[] = [];

  const isNewFile = file.status === "added";
  const isDeletedFile = file.status === "deleted";
  const oldPath = file.oldPath || file.path;
  const newPath = file.path;

  lines.push(isNewFile ? "--- /dev/null" : `--- a/${oldPath}`);
  lines.push(isDeletedFile ? "+++ /dev/null" : `+++ b/${newPath}`);

  for (const hunk of file.hunks) {
    const oldStart = isNewFile ? 0 : hunk.oldStart;
    const newStart = isDeletedFile ? 0 : hunk.newStart;
    lines.push(`@@ -${oldStart},${hunk.oldLines} +${newStart},${hunk.newLines} @@`);

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
  showSidebar,
  onShowSidebarChange,
}: {
  stats: { additions: number; deletions: number; filesChanged: number };
  viewMode: DiffViewMode;
  onViewModeChange: (mode: DiffViewMode) => void;
  fullWidth: boolean;
  onFullWidthChange: (fullWidth: boolean) => void;
  showSidebar?: boolean;
  onShowSidebarChange?: (show: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {onShowSidebarChange && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onShowSidebarChange(!showSidebar)}
            title={showSidebar ? "Hide file tree" : "Show file tree"}
          >
            <HugeiconsIcon
              icon={File01Icon}
              strokeWidth={2}
              className={cn("size-4", showSidebar && "text-primary")}
            />
          </Button>
        )}
        <DiffStats stats={stats} />
      </div>
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
  const { theme } = useTheme();

  const patchContent = fileDiffToUnifiedDiff(file);

  return (
    <div className="border border-border overflow-hidden">
      <FileHeader file={file} isExpanded={isExpanded} onToggle={() => setIsExpanded((prev) => !prev)} />
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
              // theme: { dark: "one-dark-pro", light: "one-light" },
              themeType: theme
            }}
          />
        )
      )}
    </div>
  );
}

export function DiffViewer({
  files,
  viewMode,
  fileRefs,
}: {
  files: FileDiff[];
  viewMode: DiffViewMode;
  fileRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
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
        <div
          key={file.path + idx}
          ref={(el) => {
            if (el && fileRefs) {
              fileRefs.current.set(file.path, el);
            }
          }}
        >
          <FileDiffView file={file} viewMode={viewMode} />
        </div>
      ))}
    </div>
  );
}

const statusIcons: Record<string, typeof File01Icon> = {
  added: FileAddIcon,
  modified: FileEditIcon,
  deleted: FileRemoveIcon,
  renamed: FileSyncIcon,
};

const statusColors: Record<string, string> = {
  added: "text-green-600 dark:text-green-400",
  modified: "text-yellow-600 dark:text-yellow-400",
  deleted: "text-red-600 dark:text-red-400",
  renamed: "text-blue-600 dark:text-blue-400",
};

export function FilePickerSidebar({
  files,
  selectedFile,
  onFileSelect,
}: {
  files: FileDiff[];
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
}) {
  const getFileName = (path: string) => path.split("/").pop() || path;
  const getDirectory = (path: string) => {
    const parts = path.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
  };

  return (
    <div className="border border-border bg-card overflow-hidden flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border bg-muted/50">
        <span className="text-sm font-medium">{files.length} files</span>
      </div>
      <div className="overflow-y-auto flex-1">
        {files.map((file) => {
          const Icon = statusIcons[file.status];
          const directory = getDirectory(file.path);
          const fileName = getFileName(file.path);
          const isSelected = selectedFile === file.path;

          return (
            <button
              key={file.path}
              onClick={() => onFileSelect(file.path)}
              className={cn(
                "w-full text-left px-3 py-2 hover:bg-muted/80 transition-colors border-b border-border/50 last:border-b-0",
                isSelected && "bg-muted"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <HugeiconsIcon
                  icon={Icon}
                  strokeWidth={2}
                  className={cn("size-4 shrink-0", statusColors[file.status])}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{fileName}</div>
                  {directory && (
                    <div className="text-xs text-muted-foreground truncate">{directory}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs font-mono">
                  {file.additions > 0 && (
                    <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
                  )}
                  {file.deletions > 0 && (
                    <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const HEADER_HEIGHT = 56;

export function useFileNavigation() {
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const scrollToFile = useCallback((path: string) => {
    setSelectedFile(path);
    const element = fileRefs.current.get(path);
    if (element) {
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - HEADER_HEIGHT - 16;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  }, []);

  return { fileRefs, selectedFile, scrollToFile };
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
