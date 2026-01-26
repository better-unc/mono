import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HugeiconsIcon } from "@hugeicons/react";
import { GitBranchIcon, GitMergeIcon, Loading02Icon } from "@hugeicons-pro/core-stroke-standard";
import type { ForkedFrom } from "@gitbruv/hooks";

interface PRFormProps {
  branches: string[];
  upstreamBranches?: string[];
  defaultBranch: string;
  forkedFrom?: ForkedFrom | null;
  currentRepoOwner?: string;
  currentRepoName?: string;
  onSubmit: (data: {
    title: string;
    body: string;
    headBranch: string;
    baseBranch: string;
    toUpstream?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  isSubmitting: boolean;
  initialTitle?: string;
  initialBody?: string;
}

export function PRForm({
  branches,
  upstreamBranches = [],
  defaultBranch,
  forkedFrom,
  currentRepoOwner,
  currentRepoName,
  onSubmit,
  onCancel,
  submitLabel,
  isSubmitting,
  initialTitle = "",
  initialBody = "",
}: PRFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [headBranch, setHeadBranch] = useState(branches[0] || "");
  const [toUpstream, setToUpstream] = useState(!!forkedFrom);
  const [baseBranch, setBaseBranch] = useState(
    toUpstream && upstreamBranches.length > 0 ? upstreamBranches[0] : defaultBranch
  );

  const availableBaseBranches = toUpstream && upstreamBranches.length > 0 ? upstreamBranches : branches;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !headBranch || !baseBranch) return;

    await onSubmit({
      title,
      body,
      headBranch,
      baseBranch,
      toUpstream: toUpstream && !!forkedFrom,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {forkedFrom && (
        <div className="flex items-center gap-4 p-3 bg-blue-500/10 border border-blue-500/20 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={toUpstream}
              onChange={(e) => {
                setToUpstream(e.target.checked);
                if (e.target.checked && upstreamBranches.length > 0) {
                  setBaseBranch(upstreamBranches[0]);
                } else {
                  setBaseBranch(defaultBranch);
                }
              }}
              className="rounded"
            />
            <span>
              Contribute to upstream repository{" "}
              <span className="font-semibold">
                {forkedFrom.owner.username}/{forkedFrom.name}
              </span>
            </span>
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 p-4 bg-secondary/30 border border-border">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">base:</span>
          {toUpstream && forkedFrom && (
            <span className="text-sm font-mono text-muted-foreground">
              {forkedFrom.owner.username}/{forkedFrom.name}:
            </span>
          )}
          {!toUpstream && currentRepoOwner && (
            <span className="text-sm font-mono text-muted-foreground">
              {currentRepoOwner}/{currentRepoName}:
            </span>
          )}
          <select
            value={baseBranch}
            onChange={(e) => setBaseBranch(e.target.value)}
            className="text-sm font-mono bg-background border border-border px-2 py-1"
          >
            {availableBaseBranches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </div>

        <HugeiconsIcon icon={GitMergeIcon} strokeWidth={2} className="size-4 text-muted-foreground" />

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">compare:</span>
          {currentRepoOwner && (
            <span className="text-sm font-mono text-muted-foreground">
              {currentRepoOwner}/{currentRepoName}:
            </span>
          )}
          <select
            value={headBranch}
            onChange={(e) => setHeadBranch(e.target.value)}
            className="text-sm font-mono bg-background border border-border px-2 py-1"
          >
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="Pull request title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Description</Label>
        <Textarea
          id="body"
          placeholder="Add a description..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !title.trim() || !headBranch || !baseBranch}>
          {isSubmitting ? (
            <>
              <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}
