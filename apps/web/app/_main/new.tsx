import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSession } from "@/lib/auth-client";
import { useCreateRepository } from "@gitbruv/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, Globe } from "lucide-react";

export const Route = createFileRoute("/_main/new")({
  component: NewRepoPage,
});

function NewRepoPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const { mutate: createRepo, isPending: isCreating } = useCreateRepository();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    visibility: "public" as "public" | "private",
  });

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.user) {
    navigate({ to: "/login" });
    return null;
  }

  const username = (session.user as { username?: string }).username || "";

  async function handleSubmit(e: React.FormEvent) {
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
    <div className="max-w-xl py-12 mx-auto px-4 sm:px-0">
      <div className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold mb-2">Create a new repository</h1>
        <p className="text-muted-foreground text-sm">A repository contains all project files, including the revision history.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-6">
          <div className="space-y-3">
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
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Great repository names are short and memorable. Need inspiration? How about{" "}
            <span className="text-success font-semibold italic">awesome-project</span>?
          </p>

          <div className="space-y-3">
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

        <div className="space-y-4 pt-4 border-t border-border">
          <div className="space-y-4">
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
                  <Globe className="h-4 w-4 text-muted-foreground" />
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
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Private
                </div>
                <p className="text-xs text-muted-foreground mt-1">You choose who can see and commit to this repository.</p>
              </div>
            </label>
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <Button type="submit" disabled={isCreating || !formData.name} className="h-9 px-6 text-sm font-semibold">
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create repository"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
