import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit02Icon, Delete02Icon, GitMergeIcon, Loading02Icon } from "@hugeicons-pro/core-stroke-standard";
import type { PullRequest } from "@gitbruv/hooks";
import { PRStateBadge } from "./pr-state-badge";

interface PRHeaderProps {
  pullRequest: PullRequest;
  isOwner: boolean;
  currentUserId?: string;
  onUpdate: (data: { title?: string; body?: string; state?: "open" | "closed" }) => Promise<void>;
  onDelete: () => Promise<void>;
  onMerge: () => Promise<void>;
  isMerging: boolean;
}

export function PRHeader({
  pullRequest,
  isOwner,
  currentUserId,
  onUpdate,
  onDelete,
  onMerge,
  isMerging,
}: PRHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(pullRequest.title);

  const canEdit = currentUserId === pullRequest.author.id || isOwner;
  const canMerge = (currentUserId === pullRequest.author.id || isOwner) && pullRequest.state === "open";
  const canDelete = isOwner;

  const handleSaveTitle = async () => {
    if (editedTitle.trim() && editedTitle !== pullRequest.title) {
      await onUpdate({ title: editedTitle });
    }
    setIsEditing(false);
  };

  const handleToggleState = async () => {
    const newState = pullRequest.state === "open" ? "closed" : "open";
    await onUpdate({ state: newState });
  };

  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="text-xl font-bold"
              autoFocus
            />
            <Button size="sm" onClick={handleSaveTitle}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{pullRequest.title}</h1>
            <span className="text-2xl text-muted-foreground">#{pullRequest.number}</span>
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditing(true)}>
                <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-4" />
              </Button>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <PRStateBadge state={pullRequest.state} merged={pullRequest.merged} />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {canMerge && !pullRequest.merged && (
          <Button onClick={onMerge} disabled={isMerging} className="bg-purple-600 hover:bg-purple-700">
            {isMerging ? (
              <>
                <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={GitMergeIcon} strokeWidth={2} className="size-4 mr-2" />
                Merge pull request
              </>
            )}
          </Button>
        )}

        {canEdit && !pullRequest.merged && (
          <Button variant="outline" onClick={handleToggleState}>
            {pullRequest.state === "open" ? "Close" : "Reopen"}
          </Button>
        )}

        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" className="text-red-600 hover:text-red-700">
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete pull request</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this pull request? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
