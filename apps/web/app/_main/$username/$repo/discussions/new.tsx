import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading02Icon } from "@hugeicons-pro/core-stroke-standard";
import { useCreateDiscussion, useDiscussionCategories } from "@gitbruv/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_main/$username/$repo/discussions/new")({
  component: NewDiscussionPage,
});

function NewDiscussionPage() {
  const { username, repo } = Route.useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");

  const { data: categoriesData } = useDiscussionCategories(username, repo);
  const createDiscussion = useCreateDiscussion(username, repo);

  const categories = categoriesData?.categories || [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }

    try {
      const discussion = await createDiscussion.mutateAsync({
        title,
        body,
        categoryId: categoryId || undefined,
      });

      toast.success("Discussion created");
      navigate({
        to: "/$username/$repo/discussions/$number",
        params: { username, repo, number: String(discussion.number) },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create discussion");
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Start a new discussion</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {categories.length > 0 && (
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category (optional)" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's on your mind?"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Body</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts, ask a question, or start a conversation..."
            rows={10}
            required
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/$username/$repo/discussions", params: { username, repo } })}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createDiscussion.isPending || !title.trim() || !body.trim()}>
            {createDiscussion.isPending ? (
              <>
                <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Start discussion"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
