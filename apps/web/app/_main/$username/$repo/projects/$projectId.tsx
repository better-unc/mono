import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Loading02Icon,
  ArrowLeft02Icon,
  Add01Icon,
  Delete02Icon,
  AlertCircleIcon,
  GitPullRequestIcon,
  StickyNote01Icon,
} from "@hugeicons-pro/core-stroke-standard";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useProject,
  useReorderProjectItems,
  useAddProjectItem,
  useDeleteProjectItem,
  type ProjectItem,
  type ProjectColumn,
} from "@gitbruv/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_main/$username/$repo/projects/$projectId")({
  component: ProjectBoardPage,
});

function SortableCard({ item, onDelete }: { item: ProjectItem; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-card border border-border p-3 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {item.type === "issue" && (
            <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4 text-green-500 mt-0.5 shrink-0" />
          )}
          {item.type === "pull_request" && (
            <HugeiconsIcon icon={GitPullRequestIcon} strokeWidth={2} className="size-4 text-purple-500 mt-0.5 shrink-0" />
          )}
          {item.type === "note" && (
            <HugeiconsIcon icon={StickyNote01Icon} strokeWidth={2} className="size-4 text-yellow-500 mt-0.5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {item.issue?.title || item.pullRequest?.title || "Note"}
            </p>
            {item.type === "note" && item.noteContent && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.noteContent}</p>
            )}
            {(item.issue || item.pullRequest) && (
              <p className="text-xs text-muted-foreground mt-1">
                #{item.issue?.number || item.pullRequest?.number}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 opacity-0 group-hover:opacity-100"
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3" />
        </Button>
      </div>
    </div>
  );
}

function Column({
  column,
  onAddNote,
  onDeleteItem,
}: {
  column: ProjectColumn;
  onAddNote: (columnId: string, content: string) => void;
  onDeleteItem: (itemId: string) => void;
}) {
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteContent, setNoteContent] = useState("");

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteContent.trim()) return;
    onAddNote(column.id, noteContent);
    setNoteContent("");
    setIsAddingNote(false);
  }

  return (
    <div className="shrink-0 w-72 bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">{column.name}</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5">
          {column.items.length}
        </span>
      </div>

      <SortableContext items={column.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[100px]">
          {column.items.map((item) => (
            <div key={item.id} className="group">
              <SortableCard item={item} onDelete={() => onDeleteItem(item.id)} />
            </div>
          ))}
        </div>
      </SortableContext>

      {isAddingNote ? (
        <form onSubmit={handleAddNote} className="mt-3 space-y-2">
          <Input
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Enter a note..."
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" size="xs" disabled={!noteContent.trim()}>
              Add
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setIsAddingNote(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3 justify-start text-muted-foreground"
          onClick={() => setIsAddingNote(true)}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4 mr-2" />
          Add a note
        </Button>
      )}
    </div>
  );
}

function ProjectBoardPage() {
  const { username, repo, projectId } = Route.useParams();
  const { data: project, isLoading } = useProject(projectId);
  const reorderItems = useReorderProjectItems(projectId);
  const addItem = useAddProjectItem(projectId);
  const deleteItem = useDeleteProjectItem(projectId);
  const [activeItem, setActiveItem] = useState<ProjectItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const item = project?.columns
      .flatMap((c) => c.items)
      .find((i) => i.id === active.id);
    setActiveItem(item || null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);

    if (!over || !project) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const sourceColumn = project.columns.find((c) =>
      c.items.some((i) => i.id === activeId)
    );
    const destColumn = project.columns.find(
      (c) => c.id === overId || c.items.some((i) => i.id === overId)
    );

    if (!sourceColumn || !destColumn) return;

    const sourceItems = [...sourceColumn.items];
    const destItems = sourceColumn.id === destColumn.id ? sourceItems : [...destColumn.items];

    const activeIndex = sourceItems.findIndex((i) => i.id === activeId);
    const overIndex = destItems.findIndex((i) => i.id === overId);

    let newItems: { id: string; columnId: string; position: number }[];

    if (sourceColumn.id === destColumn.id) {
      const reordered = arrayMove(sourceItems, activeIndex, overIndex);
      newItems = reordered.map((item, index) => ({
        id: item.id,
        columnId: destColumn.id,
        position: index,
      }));
    } else {
      const [movedItem] = sourceItems.splice(activeIndex, 1);
      destItems.splice(overIndex >= 0 ? overIndex : destItems.length, 0, movedItem);

      newItems = [
        ...sourceItems.map((item, index) => ({
          id: item.id,
          columnId: sourceColumn.id,
          position: index,
        })),
        ...destItems.map((item, index) => ({
          id: item.id,
          columnId: destColumn.id,
          position: index,
        })),
      ];
    }

    try {
      await reorderItems.mutateAsync(newItems);
    } catch {
      toast.error("Failed to reorder items");
    }
  }

  async function handleAddNote(columnId: string, content: string) {
    try {
      await addItem.mutateAsync({ columnId, noteContent: content });
      toast.success("Note added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add note");
    }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await deleteItem.mutateAsync(itemId);
      toast.success("Item removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove item");
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 mx-auto animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/$username/$repo/projects"
          params={{ username, repo }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} className="size-4" />
          Projects
        </Link>
        <h1 className="text-xl font-semibold">{project.name}</h1>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {project.columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              onAddNote={handleAddNote}
              onDeleteItem={handleDeleteItem}
            />
          ))}
        </div>

        <DragOverlay>
          {activeItem && (
            <div className="bg-card border border-border p-3 shadow-lg">
              <p className="text-sm font-medium">
                {activeItem.issue?.title || activeItem.pullRequest?.title || activeItem.noteContent || "Note"}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
