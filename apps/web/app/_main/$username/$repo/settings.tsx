import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  useRepositoryWithStars,
  useUpdateRepository,
  useDeleteRepository,
} from "@/lib/hooks/use-repositories"
import { useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Loader2, Lock, Globe, Trash2, AlertTriangle } from "lucide-react"
import { mutate } from "swr"

export const Route = createFileRoute("/_main/$username/$repo/settings")({
  component: RepoSettingsPage,
})

function RepoSettingsPage() {
  const { username, repo: repoName } = Route.useParams()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const { data: repo, isLoading } = useRepositoryWithStars(username, repoName)
  const { trigger: updateRepo, isMutating: saving } = useUpdateRepository(
    repo?.id || ""
  )
  const { trigger: deleteRepo, isMutating: deleting } = useDeleteRepository(
    repo?.id || ""
  )

  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    visibility: "public" as "public" | "private",
  })
  const [initialized, setInitialized] = useState(false)

  if (!initialized && repo) {
    setFormData({
      name: repo.name,
      description: repo.description || "",
      visibility: repo.visibility,
    })
    setInitialized(true)
  }

  const isOwner = session?.user?.id === repo?.ownerId

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!repo) return

    try {
      const updated = await updateRepo({
        name: formData.name,
        description: formData.description,
        visibility: formData.visibility,
      })
      mutate((key) => typeof key === "string" && key.includes("/repositories"))
      toast.success("Settings saved")
      if (updated && updated.name !== repo.name) {
        navigate({
          to: "/$username/$repo/settings",
          params: { username, repo: updated.name },
        })
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings"
      )
    }
  }

  async function handleDelete() {
    if (!repo || deleteConfirm !== repo.name) return

    try {
      await deleteRepo()
      mutate((key) => typeof key === "string" && key.includes("/repositories"))
      toast.success("Repository deleted")
      navigate({ to: "/$username", params: { username } })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete repository"
      )
    }
  }

  if (isLoading) {
    return (
      <div className="container max-w-3xl py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!repo || !isOwner) {
    return (
      <div className="container max-w-3xl py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">
              You don't have permission to access this page
            </p>
            <Button asChild>
              <Link to="/$username/$repo" params={{ username, repo: repoName }}>
                Back to repository
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-3xl py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Repository Settings</h1>
        <p className="text-muted-foreground">
          Manage settings for{" "}
          <Link
            to="/$username/$repo"
            params={{ username, repo: repoName }}
            className="text-accent hover:underline"
          >
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
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                pattern="^[a-zA-Z0-9_.-]+$"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
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
                    onChange={() =>
                      setFormData({ ...formData, visibility: "public" })
                    }
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
                    onChange={() =>
                      setFormData({ ...formData, visibility: "private" })
                    }
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
                    This action cannot be undone. This will permanently delete
                    the{" "}
                    <strong>
                      {username}/{repo.name}
                    </strong>{" "}
                    repository and all of its contents.
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
                    {deleting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Delete repository
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

