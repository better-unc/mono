import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { GlobeIcon, Loading02Icon, LockKeyIcon } from "@hugeicons-pro/core-stroke-standard";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCreateRepository, useCurrentUser } from "@gitbruv/hooks";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NewRepositoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewRepositoryModal({ open, onOpenChange }: NewRepositoryModalProps) {
  const { data: session } = useSession();
  const { data: currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const { mutate: createRepo, isPending: isCreating } = useCreateRepository();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    visibility: "public" as "public" | "private",
  });

  useEffect(() => {
    if (currentUser?.user.defaultRepositoryVisibility) {
      setFormData((prev) => ({
        ...prev,
        visibility: currentUser.user.defaultRepositoryVisibility as "public" | "private",
      }));
    }
  }, [currentUser?.user.defaultRepositoryVisibility]);

  useEffect(() => {
    if (!open) {
      setFormData({
        name: "",
        description: "",
        visibility: currentUser?.user.defaultRepositoryVisibility as "public" | "private" || "public",
      });
    }
  }, [open, currentUser?.user.defaultRepositoryVisibility]);

  if (!session?.user) {
    return null;
  }

  const username = (session.user as { username?: string }).username || "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    createRepo(
      {
        name: formData.name,
        description: formData.description || undefined,
        visibility: formData.visibility,
      },
      {
        onSuccess: () => {
          toast.success("Repository created!");
          onOpenChange(false);
          navigate({
            to: "/$username/$repo",
            params: {
              username,
              repo: formData.name.toLowerCase().replace(/\s+/g, "-"),
            },
          });
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to create repository");
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Create a new repository</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            A repository contains all project files, including the revision history.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">
                Repository name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="my-awesome-project"
                required
                pattern="^[a-zA-Z0-9_.-]+$"
                className="h-9 bg-background focus-visible:ring-1"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Great repository names are short and memorable. Need inspiration? How about{" "}
              <span className="text-success font-semibold italic">awesome-project</span>?
            </p>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-semibold">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="A short description of your project"
                className="h-9 bg-background focus-visible:ring-1"
              />
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={formData.visibility === "public"}
                onChange={() => setFormData({ ...formData, visibility: "public" })}
                className="mt-1.5 h-4 w-4 text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <HugeiconsIcon icon={GlobeIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
                  Public
                </div>
                <p className="text-xs text-muted-foreground mt-1">Anyone on the internet can see this repository. You choose who can commit.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={formData.visibility === "private"}
                onChange={() => setFormData({ ...formData, visibility: "private" })}
                className="mt-1.5 h-4 w-4 text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <HugeiconsIcon icon={LockKeyIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
                  Private
                </div>
                <p className="text-xs text-muted-foreground mt-1">You choose who can see and commit to this repository.</p>
              </div>
            </label>
          </div>

          <DialogFooter className="pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
              className="h-9"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !formData.name} className="h-9 px-6 text-sm font-semibold">
              {isCreating ? (
                <>
                  <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create repository"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
