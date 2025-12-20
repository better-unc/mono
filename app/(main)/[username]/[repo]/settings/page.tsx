"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { getRepositoryWithStars, updateRepository, deleteRepository } from "@/actions/repositories";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Lock, Globe, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";

type RepoData = {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  ownerId: string;
};

export default function RepoSettingsPage({
  params,
}: {
  params: Promise<{ username: string; repo: string }>;
}) {
  const { username, repo: repoName } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const [repo, setRepo] = useState<RepoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    visibility: "public" as "public" | "private",
  });

  useEffect(() => {
    async function loadRepo() {
      try {
        const data = await getRepositoryWithStars(username, repoName);
        if (data) {
          setRepo(data);
          setFormData({
            name: data.name,
            description: data.description || "",
            visibility: data.visibility,
          });
        }
      } finally {
        setLoading(false);
      }
    }
    loadRepo();
  }, [username, repoName]);

  const isOwner = session?.user?.id === repo?.ownerId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repo) return;

    setSaving(true);
    try {
      const updated = await updateRepository(repo.id, {
        name: formData.name,
        description: formData.description,
        visibility: formData.visibility,
      });
      toast.success("Settings saved");
      if (updated.name !== repo.name) {
        router.push(`/${username}/${updated.name}/settings`);
      }
      setRepo({ ...repo, ...updated });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!repo || deleteConfirm !== repo.name) return;

    setDeleting(true);
    try {
      await deleteRepository(repo.id);
      toast.success("Repository deleted");
      router.push(`/${username}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete repository");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="container max-w-3xl py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!repo || !isOwner) {
    return (
      <div className="container max-w-3xl py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">
              You don&apos;t have permission to access this page
            </p>
            <Button asChild>
              <Link href={`/${username}/${repoName}`}>Back to repository</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Repository Settings</h1>
        <p className="text-muted-foreground">
          Manage settings for{" "}
          <Link href={`/${username}/${repoName}`} className="text-accent hover:underline">
            {username}/{repo.name}
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Basic repository information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Repository name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                pattern="^[a-zA-Z0-9_.-]+$"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="A short description of your repository"
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>Visibility</Label>
              <div className="space-y-2">
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.visibility === "public"
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={formData.visibility === "public"}
                    onChange={() => setFormData({ ...formData, visibility: "public" })}
                    className="sr-only"
                  />
                  <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Public</p>
                    <p className="text-sm text-muted-foreground">
                      Anyone can see this repository
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.visibility === "private"
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={formData.visibility === "private"}
                    onChange={() => setFormData({ ...formData, visibility: "private" })}
                    className="sr-only"
                  />
                  <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Private</p>
                    <p className="text-sm text-muted-foreground">
                      Only you can see this repository
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions that can affect your repository
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <div>
              <p className="font-medium">Delete this repository</p>
              <p className="text-sm text-muted-foreground">
                Once deleted, it cannot be recovered
              </p>
            </div>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete repository</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete the{" "}
                    <strong>{username}/{repo.name}</strong> repository and all of its contents.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                  <Label htmlFor="confirm">
                    Type <strong>{repo.name}</strong> to confirm
                  </Label>
                  <Input
                    id="confirm"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={repo.name}
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteOpen(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteConfirm !== repo.name || deleting}
                  >
                    {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete repository
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

