import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useSession } from "@/lib/auth-client"
import { useCreateRepository } from "@/lib/hooks/use-repositories"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Loader2, Lock, Globe } from "lucide-react"
import { mutate } from "swr"

export const Route = createFileRoute("/_main/new")({
  component: NewRepoPage,
})

function NewRepoPage() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session?.user) {
    navigate({ to: "/login" })
    return null
  }

  const username = (session.user as { username?: string }).username || ""

  return <NewRepoForm username={username} />
}

function NewRepoForm({ username }: { username: string }) {
  const navigate = useNavigate()
  const { trigger, isMutating } = useCreateRepository()
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    visibility: "public" as "public" | "private",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      await trigger({
        name: formData.name,
        description: formData.description || undefined,
        visibility: formData.visibility,
      })

      mutate((key) => typeof key === "string" && key.includes("/repositories"))
      toast.success("Repository created!")
      navigate({
        to: "/$username/$repo",
        params: {
          username,
          repo: formData.name.toLowerCase().replace(/\s+/g, "-"),
        },
      })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create repository"
      )
    }
  }

  return (
    <div className="container max-w-2xl! py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Create a new repository</h1>
        <p className="text-muted-foreground">
          A repository contains all project files, including the revision
          history.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="space-y-3">
            <Label htmlFor="name" className="text-sm font-medium">
              Repository name <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground font-medium">
                {username}
              </span>
              <span className="text-muted-foreground">/</span>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="my-awesome-project"
                required
                pattern="^[a-zA-Z0-9_.-]+$"
                className="flex-1 bg-input/50"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Great repository names are short and memorable.
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="description" className="text-sm font-medium">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="A short description of your project"
              rows={3}
              className="bg-input/50 resize-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <Label className="text-sm font-medium">Visibility</Label>
          <div className="space-y-3">
            <label
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                formData.visibility === "public"
                  ? "border-primary bg-primary/5"
                  : "border-transparent bg-input/30 hover:bg-input/50"
              }`}
            >
              <div
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  formData.visibility === "public"
                    ? "border-primary"
                    : "border-muted-foreground"
                }`}
              >
                {formData.visibility === "public" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
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
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  Public
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Anyone on the internet can see this repository.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                formData.visibility === "private"
                  ? "border-primary bg-primary/5"
                  : "border-transparent bg-input/30 hover:bg-input/50"
              }`}
            >
              <div
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  formData.visibility === "private"
                    ? "border-primary"
                    : "border-muted-foreground"
                }`}
              >
                {formData.visibility === "private" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
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
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Private
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  You choose who can see and commit to this repository.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Button type="button" variant="ghost" asChild>
            <Link to="/">Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={isMutating || !formData.name}
            className="min-w-[160px]"
          >
            {isMutating ? (
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
  )
}

