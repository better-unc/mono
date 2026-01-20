"use client";

import { useState, useEffect, useCallback } from "react";
import { CodeViewer } from "./code-viewer";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading02Icon } from "@hugeicons-pro/core-stroke-standard";

const CHUNK_SIZE = 64 * 1024;
const LARGE_FILE_THRESHOLD = 100 * 1024;

interface ChunkedCodeViewerProps {
  username: string;
  repoName: string;
  branch: string;
  filePath: string;
  language: string;
  initialContent?: string;
  totalSize?: number;
  wordWrap?: boolean;
}

export function ChunkedCodeViewer({ username, repoName, branch, filePath, language, initialContent, totalSize, wordWrap }: ChunkedCodeViewerProps) {
  const [content, setContent] = useState(initialContent || "");
  const [loading, setLoading] = useState(!initialContent);
  const [progress, setProgress] = useState(initialContent ? 100 : 0);
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback(async () => {
    if (initialContent) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/file/${username}/${repoName}/${branch}/${filePath}`);

      if (!response.ok) {
        throw new Error("Failed to load file");
      }

      const size = parseInt(response.headers.get("X-Total-Size") || "0", 10);

      if (size < LARGE_FILE_THRESHOLD || !response.body) {
        const text = await response.text();
        setContent(text);
        setProgress(100);
        setLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = "";
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        result += decoder.decode(value, { stream: true });
        loaded += value.length;
        setProgress(Math.min(Math.round((loaded / size) * 100), 100));
        setContent(result);
      }

      result += decoder.decode();
      setContent(result);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load file");
    } finally {
      setLoading(false);
    }
  }, [username, repoName, branch, filePath, initialContent]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && progress < 100 && (
        <div className="absolute top-0 left-0 right-0 z-10">
          <div className="h-1 bg-muted overflow-hidden">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="absolute top-2 right-2 flex items-center gap-2 text-xs text-muted-foreground bg-card/90 px-2 py-1 rounded">
            <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-3 animate-spin" />
            <span>{progress}%</span>
          </div>
        </div>
      )}
      {content ? (
        <CodeViewer content={content} language={language} showLineNumbers wordWrap={wordWrap} />
      ) : (
        <div className="p-8 flex items-center justify-center">
          <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
