import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { KanbanIcon, Loading02Icon, Add01Icon } from "@hugeicons-pro/core-stroke-standard";
import { useProjects, useCreateProject } from "@gitbruv/hooks";
import { formatRelativeTime } from "@gitbruv/lib";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_main/$username/$repo/projects/")({
  component: ProjectsListPage,
});

function ProjectsListPage() {
  const { username, repo } = Route.useParams();
  const { data, isLoading } = useProjects(username, repo);
  const createProject = useCreateProject(username, repo);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const projects = data?.projects || [];

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();

    if (!newProjectName.trim()) return;

    try {
      await createProject.mutateAsync({ name: newProjectName });
      toast.success("Project created");
      setNewProjectName("");
      setIsDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4 mr-2" />
              New project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project name</Label>
                <Input
                  id="name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My Project"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createProject.isPending || !newProjectName.trim()}>
                  {createProject.isPending ? (
                    <>
                      <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create project"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-16">
          <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 mx-auto animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 border border-border">
          <HugeiconsIcon icon={KanbanIcon} strokeWidth={2} className="size-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-medium mb-2">No projects yet</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Create a project board to organize your work.
          </p>
          <Button onClick={() => setIsDialogOpen(true)}>Create a project</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              to="/$username/$repo/projects/$projectId"
              params={{ username, repo, projectId: project.id }}
              className="block p-4 border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted">
                  <HugeiconsIcon icon={KanbanIcon} strokeWidth={2} className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{project.name}</h3>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Created {formatRelativeTime(project.createdAt)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
