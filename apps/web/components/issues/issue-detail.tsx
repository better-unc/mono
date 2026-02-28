import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { timeAgo } from "@gitbruv/lib";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit02Icon, Delete02Icon, LockIcon, UserUnlockIcon } from "@hugeicons-pro/core-stroke-standard";
import type { Issue, Label, IssueAuthor } from "@gitbruv/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CodeViewer } from "@/components/code-viewer";
import { ReactionPicker } from "./reaction-picker";
import { LabelPicker } from "./label-picker";
import { AssigneePicker } from "./assignee-picker";
import { IssueForm } from "./issue-form";

interface IssueDetailProps {
  issue: Issue;
  labels: Label[];
  availableAssignees: IssueAuthor[];
  currentUserId?: string;
  isOwner: boolean;
  onToggleReaction: (emoji: string) => void;
  onUpdate: (data: { title?: string; body?: string; state?: "open" | "closed"; locked?: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddLabel: (labelId: string) => void;
  onRemoveLabel: (labelId: string) => void;
  onAddAssignee: (userId: string) => void;
  onRemoveAssignee: (userId: string) => void;
}

export function IssueDetail({
  issue,
  labels,
  availableAssignees,
  currentUserId,
  isOwner,
  onToggleReaction,
  onUpdate,
  onDelete,
  onAddLabel,
  onRemoveLabel,
  onAddAssignee,
  onRemoveAssignee,
}: IssueDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit = currentUserId === issue.author.id || isOwner;
  const canDelete = isOwner;

  const handleUpdate = async (data: { title: string; body: string }) => {
    setIsSubmitting(true);
    try {
      await onUpdate({ title: data.title, body: data.body });
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleState = async () => {
    setIsSubmitting(true);
    try {
      await onUpdate({ state: issue.state === "open" ? "closed" : "open" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLock = async () => {
    setIsSubmitting(true);
    try {
      await onUpdate({ locked: !issue.locked });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this issue?")) return;
    setIsSubmitting(true);
    try {
      await onDelete();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLabel = (labelId: string) => {
    const isSelected = issue.labels.some((l) => l.id === labelId);
    if (isSelected) {
      onRemoveLabel(labelId);
    } else {
      onAddLabel(labelId);
    }
  };

  const handleToggleAssignee = (userId: string) => {
    const isSelected = issue.assignees.some((a) => a.id === userId);
    if (isSelected) {
      onRemoveAssignee(userId);
    } else {
      onAddAssignee(userId);
    }
  };

  if (isEditing) {
    return (
      <div className="border border-border bg-card p-6">
        <IssueForm
          initialTitle={issue.title}
          initialBody={issue.body || ""}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
          submitLabel="Update issue"
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 space-y-4">
        <div className="border border-border bg-card">
          <div className="flex items-start justify-between px-4 py-3 bg-secondary/30 border-b border-border">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={issue.author.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">{issue.author.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <Link
                to="/$username"
                params={{ username: issue.author.username }}
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                {issue.author.username}
              </Link>
              <span className="text-xs text-muted-foreground">
                opened this issue {timeAgo(issue.createdAt)}
              </span>
            </div>

            {canEdit && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsEditing(true)}>
                  <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-4" />
                </Button>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-red-500 hover:text-red-600"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="p-4">
            {issue.body ? (
              <CodeViewer content={issue.body} language="markdown" className="p-0 md:p-0" />
            ) : (
              <p className="text-muted-foreground italic">No description provided.</p>
            )}
          </div>

          <div className="px-4 pb-3">
            <ReactionPicker
              reactions={issue.reactions}
              onToggle={onToggleReaction}
              disabled={!currentUserId}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {canEdit && (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={handleToggleState}
              disabled={isSubmitting}
            >
              {issue.state === "open" ? "Close issue" : "Reopen issue"}
            </Button>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleToggleLock}
                disabled={isSubmitting}
              >
                <HugeiconsIcon
                  icon={issue.locked ? UserUnlockIcon : LockIcon}
                  strokeWidth={2}
                  className="size-4 mr-2"
                />
                {issue.locked ? "Unlock conversation" : "Lock conversation"}
              </Button>
            )}
          </div>
        )}

        <div className="border-t border-border pt-4">
          <LabelPicker
            labels={labels}
            selectedIds={issue.labels.map((l) => l.id)}
            onToggle={handleToggleLabel}
            isLoading={!canEdit}
          />
        </div>

        <div className="border-t border-border pt-4">
          <AssigneePicker
            availableUsers={availableAssignees}
            selectedIds={issue.assignees.map((a) => a.id)}
            onToggle={handleToggleAssignee}
            isLoading={!canEdit}
          />
        </div>

        {issue.state === "closed" && issue.closedBy && (
          <div className="border-t border-border pt-4">
            <span className="text-sm font-medium text-muted-foreground">Closed by</span>
            <div className="flex items-center gap-2 mt-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={issue.closedBy.avatarUrl || undefined} />
                <AvatarFallback className="text-[10px]">{issue.closedBy.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <Link
                to="/$username"
                params={{ username: issue.closedBy.username }}
                className="text-sm hover:text-primary transition-colors"
              >
                {issue.closedBy.username}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
