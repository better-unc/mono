import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Edit02Icon, Delete02Icon } from "@hugeicons-pro/core-stroke-standard";
import { useLabels, useCreateLabel, useUpdateLabel, useDeleteLabel, useRepositoryInfo } from "@gitbruv/hooks";
import type { Label } from "@gitbruv/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelBadge } from "@/components/issues";

export const Route = createFileRoute("/_main/$username/$repo/labels")({
  component: LabelsPage,
});

const DEFAULT_COLORS = [
  "ef4444", "f97316", "eab308", "22c55e", "06b6d4", "3b82f6", "8b5cf6", "ec4899", "6b7280",
];

function LabelsPage() {
  const { username, repo } = Route.useParams();

  const { data: repoInfo } = useRepositoryInfo(username, repo);
  const { data: labelsData, isLoading } = useLabels(username, repo);
  const createLabel = useCreateLabel(username, repo);

  const [isCreating, setIsCreating] = useState(false);
  const [newLabel, setNewLabel] = useState({ name: "", description: "", color: "6b7280" });

  const labels = labelsData?.labels || [];
  const isOwner = repoInfo?.isOwner || false;

  const handleCreate = async () => {
    if (!newLabel.name.trim()) return;
    await createLabel.mutateAsync({
      name: newLabel.name.trim(),
      description: newLabel.description.trim() || undefined,
      color: newLabel.color,
    });
    setNewLabel({ name: "", description: "", color: "6b7280" });
    setIsCreating(false);
  };

  return (
    <div className="container max-w-6xl px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Labels</h1>
          <p className="text-sm text-muted-foreground">
            {labels.length} label{labels.length !== 1 ? "s" : ""}
          </p>
        </div>

        {isOwner && !isCreating && (
          <Button onClick={() => setIsCreating(true)}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4 mr-1.5" />
            New label
          </Button>
        )}
      </div>

      {isCreating && (
        <div className="border border-border bg-card p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="text-sm font-medium">Preview</label>
              <div className="mt-2">
                <LabelBadge
                  label={{
                    id: "preview",
                    name: newLabel.name || "Label preview",
                    description: null,
                    color: newLabel.color,
                  }}
                />
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newLabel.name}
                onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })}
                placeholder="Label name"
                className="mt-2"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={newLabel.description}
                onChange={(e) => setNewLabel({ ...newLabel, description: e.target.value })}
                placeholder="Optional description"
                className="mt-2"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-sm font-medium">Color</label>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex gap-1">
                  {DEFAULT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewLabel({ ...newLabel, color })}
                      className={`w-6 h-6 border-2 ${
                        newLabel.color === color ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: `#${color}` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createLabel.isPending || !newLabel.name.trim()}>
              {createLabel.isPending ? "Creating..." : "Create label"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <LabelsSkeleton />
      ) : labels.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border">
          <p className="text-muted-foreground mb-4">No labels yet</p>
          {isOwner && (
            <Button onClick={() => setIsCreating(true)}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4 mr-1.5" />
              Create the first label
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-border bg-card overflow-hidden">
          {labels.map((label) => (
            <LabelRow key={label.id} label={label} username={username} repo={repo} isOwner={isOwner} />
          ))}
        </div>
      )}
    </div>
  );
}

function LabelRow({
  label,
  username,
  repo,
  isOwner,
}: {
  label: Label;
  username: string;
  repo: string;
  isOwner: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: label.name, description: label.description || "", color: label.color });

  const updateLabel = useUpdateLabel(label.id, username, repo);
  const deleteLabel = useDeleteLabel(label.id, username, repo);

  const handleUpdate = async () => {
    await updateLabel.mutateAsync({
      name: editData.name.trim(),
      description: editData.description.trim() || undefined,
      color: editData.color,
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this label?")) return;
    await deleteLabel.mutateAsync();
  };

  if (isEditing) {
    return (
      <div className="p-4 border-b border-border last:border-b-0">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <LabelBadge
              label={{
                id: label.id,
                name: editData.name || "Label preview",
                description: null,
                color: editData.color,
              }}
            />
          </div>
          <Input
            value={editData.name}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            placeholder="Label name"
          />
          <Input
            value={editData.description}
            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
            placeholder="Description"
          />
          <div className="flex gap-1">
            {DEFAULT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setEditData({ ...editData, color })}
                className={`w-6 h-6 border-2 ${
                  editData.color === color ? "border-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: `#${color}` }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={updateLabel.isPending}>
            {updateLabel.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-3">
        <LabelBadge label={label} />
        {label.description && (
          <span className="text-sm text-muted-foreground">{label.description}</span>
        )}
      </div>
      {isOwner && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsEditing(true)}>
            <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-red-500 hover:text-red-600"
            onClick={handleDelete}
            disabled={deleteLabel.isPending}
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function LabelsSkeleton() {
  return (
    <div className="border border-border bg-card overflow-hidden animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
          <div className="h-5 w-16 bg-secondary/50" />
          <div className="h-4 w-32 bg-secondary/50" />
        </div>
      ))}
    </div>
  );
}
