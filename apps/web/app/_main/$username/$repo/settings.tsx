import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useRepoPageData,
  useUpdateRepository,
  useDeleteRepository,
  useRepositoryInfo,
  useBranchProtectionRules,
  useCreateBranchProtectionRule,
  useUpdateBranchProtectionRule,
  useDeleteBranchProtectionRule,
} from "@gitbruv/hooks";
import type { BranchProtectionRule } from "@gitbruv/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockKeyIcon, GlobeIcon, Delete01Icon, Alert01Icon, Loading02Icon } from "@hugeicons-pro/core-stroke-standard";

export const Route = createFileRoute("/_main/$username/$repo/settings")({
  component: RepoSettingsPage,
});

function RepoSettingsPage() {
  const { username, repo: repoName } = Route.useParams();
  const navigate = useNavigate();
  const { data: pageData, isLoading } = useRepoPageData(username, repoName);
  const { data: repoInfo, isLoading: isLoadingInfo } = useRepositoryInfo(username, repoName);
  const repo = repoInfo?.repo;
  const isOwner = pageData?.isOwner ?? false;
  const { mutate: updateRepo, isPending: saving } = useUpdateRepository(repo?.id || "");
  const { mutate: deleteRepo, isPending: deleting } = useDeleteRepository(repo?.id || "");

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    visibility: "public" as "public" | "private",
  });
  const [initialized, setInitialized] = useState(false);

  if (!initialized && repo) {
    setFormData({
      name: repo.name,
      description: repo.description || "",
      visibility: repo.visibility,
    });
    setInitialized(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repo) return;

    updateRepo(
      {
        name: formData.name,
        description: formData.description,
        visibility: formData.visibility,
      },
      {
        onSuccess: (updated) => {
          toast.success("Settings saved");
          if (updated && updated.name !== repo.name) {
            navigate({
              to: "/$username/$repo/settings",
              params: { username, repo: updated.name },
            });
          }
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to save settings");
        },
      }
    );
  }

  async function handleDelete() {
    if (!repo || deleteConfirm !== repo.name) return;

    deleteRepo(undefined, {
      onSuccess: () => {
        toast.success("Repository deleted");
        navigate({ to: "/$username", params: { username } });
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to delete repository");
      },
    });
  }

  if (isLoading || isLoadingInfo) {
    return (
      <div className="container max-w-6xl px-4">
        <div className="flex items-center justify-center py-12">
          <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!repo || !isOwner) {
    return (
      <div className="container max-w-6xl px-4">
        <Card>
          <CardContent className="p-12 text-center">
            <HugeiconsIcon icon={Alert01Icon} strokeWidth={2} className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">You don't have permission to access this page</p>
            <Link to="/$username/$repo" params={{ username, repo: repoName }}>
              <Button>Back to repository</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl px-4 space-y-8">

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
                  className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                    formData.visibility === "public" ? "border-accent bg-accent/5" : "border-border hover:border-muted-foreground/50"
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
                  <HugeiconsIcon icon={GlobeIcon} strokeWidth={2} className="size-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Public</p>
                    <p className="text-sm text-muted-foreground">Anyone can see this repository</p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                    formData.visibility === "private" ? "border-accent bg-accent/5" : "border-border hover:border-muted-foreground/50"
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
                  <HugeiconsIcon icon={LockKeyIcon} strokeWidth={2} className="size-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Private</p>
                    <p className="text-sm text-muted-foreground">Only you can see this repository</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <BranchProtectionSection username={username} repoName={repoName} />

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions that can affect your repository</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border border-destructive/30 bg-destructive/5">
            <div>
              <p className="font-medium">Delete this repository</p>
              <p className="text-sm text-muted-foreground">Once deleted, it cannot be recovered</p>
            </div>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger>
                <Button variant="destructive" size="sm">
                  <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} className="size-4 mr-2" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete repository</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete the{" "}
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
                  <Input id="confirm" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={repo.name} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={deleteConfirm !== repo.name || deleting}>
                    {deleting && <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />}
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

function BranchProtectionSection({ username, repoName }: { username: string; repoName: string }) {
  const { data, isLoading } = useBranchProtectionRules(username, repoName);
  const createRule = useCreateBranchProtectionRule(username, repoName);
  const updateRule = useUpdateBranchProtectionRule(username, repoName);
  const deleteRule = useDeleteBranchProtectionRule(username, repoName);

  const [activeUpdatingRuleId, setActiveUpdatingRuleId] = useState<string | null>(null);
  const [activeDeletingRuleId, setActiveDeletingRuleId] = useState<string | null>(null);

  const [newBranch, setNewBranch] = useState("");
  const [newRule, setNewRule] = useState({
    preventDirectPush: true,
    preventForcePush: true,
    preventDeletion: true,
    requireReviews: false,
    requiredReviewCount: 1,
  });

  function handleCreate() {
    if (!newBranch.trim()) return;
    createRule.mutate(
      { branchName: newBranch.trim(), ...newRule },
      {
        onSuccess: () => {
          toast.success("Branch protection rule created");
          setNewBranch("");
          setNewRule({
            preventDirectPush: true,
            preventForcePush: true,
            preventDeletion: true,
            requireReviews: false,
            requiredReviewCount: 1,
          });
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to create rule");
        },
      }
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={LockKeyIcon} strokeWidth={2} className="size-5" />
          Branch Protection
        </CardTitle>
        <CardDescription>
          Configure protection rules for specific branches
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && (
          <div className="flex justify-center py-4">
            <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {data?.rules?.map((rule) => (
          <BranchProtectionRuleRow
            key={rule.id}
            rule={rule}
            onUpdate={(data) => {
              setActiveUpdatingRuleId(rule.id);
              updateRule.mutate(
                { ruleId: rule.id, data },
                {
                  onSuccess: () => { setActiveUpdatingRuleId(null); toast.success("Rule updated"); },
                  onError: (err) => { setActiveUpdatingRuleId(null); toast.error(err instanceof Error ? err.message : "Failed to update"); },
                }
              );
            }}
            onDelete={() => {
              setActiveDeletingRuleId(rule.id);
              deleteRule.mutate(rule.id, {
                onSuccess: () => { setActiveDeletingRuleId(null); toast.success("Rule deleted"); },
                onError: (err) => { setActiveDeletingRuleId(null); toast.error(err instanceof Error ? err.message : "Failed to delete"); },
              });
            }}
            saving={activeUpdatingRuleId === rule.id}
            deleting={activeDeletingRuleId === rule.id}
          />
        ))}

        {data?.rules?.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">No branch protection rules configured.</p>
        )}

        <div className="border-t pt-6 space-y-4">
          <h4 className="text-sm font-medium">Add new rule</h4>
          <div className="space-y-2">
            <Label htmlFor="new-branch">Branch name</Label>
            <Input
              id="new-branch"
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              placeholder="e.g. main"
            />
          </div>
          <ProtectionCheckboxes
            values={newRule}
            onChange={(updates) => setNewRule({ ...newRule, ...updates })}
          />
          <Button onClick={handleCreate} disabled={!newBranch.trim() || createRule.isPending}>
            {createRule.isPending && <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />}
            Add rule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BranchProtectionRuleRow({
  rule,
  onUpdate,
  onDelete,
  saving,
  deleting,
}: {
  rule: BranchProtectionRule;
  onUpdate: (data: {
    preventDirectPush?: boolean;
    preventForcePush?: boolean;
    preventDeletion?: boolean;
    requireReviews?: boolean;
    requiredReviewCount?: number;
  }) => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const [values, setValues] = useState({
    preventDirectPush: rule.preventDirectPush,
    preventForcePush: rule.preventForcePush,
    preventDeletion: rule.preventDeletion,
    requireReviews: rule.requireReviews,
    requiredReviewCount: rule.requiredReviewCount,
  });

  useEffect(() => {
    setValues({
      preventDirectPush: rule.preventDirectPush,
      preventForcePush: rule.preventForcePush,
      preventDeletion: rule.preventDeletion,
      requireReviews: rule.requireReviews,
      requiredReviewCount: rule.requiredReviewCount,
    });
  }, [
    rule.id,
    rule.preventDirectPush,
    rule.preventForcePush,
    rule.preventDeletion,
    rule.requireReviews,
    rule.requiredReviewCount,
  ]);

  const hasChanges =
    values.preventDirectPush !== rule.preventDirectPush ||
    values.preventForcePush !== rule.preventForcePush ||
    values.preventDeletion !== rule.preventDeletion ||
    values.requireReviews !== rule.requireReviews ||
    values.requiredReviewCount !== rule.requiredReviewCount;

  return (
    <div className="border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={LockKeyIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
          <span className="font-mono font-medium text-sm">{rule.branchName}</span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={deleting}
          aria-label={`Delete protection rule for ${rule.branchName}`}
        >
          {deleting ? (
            <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 animate-spin" />
          ) : (
            <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} className="size-4" />
          )}
        </Button>
      </div>
      <ProtectionCheckboxes
        values={values}
        onChange={(updates) => setValues({ ...values, ...updates })}
      />
      {hasChanges && (
        <Button size="sm" onClick={() => onUpdate(values)} disabled={saving}>
          {saving && <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />}
          Save changes
        </Button>
      )}
    </div>
  );
}

function ProtectionCheckboxes({
  values,
  onChange,
}: {
  values: {
    preventDirectPush: boolean;
    preventForcePush: boolean;
    preventDeletion: boolean;
    requireReviews: boolean;
    requiredReviewCount: number;
  };
  onChange: (updates: Partial<typeof values>) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.preventDirectPush}
          onChange={(e) => onChange({ preventDirectPush: e.target.checked })}
          className="rounded"
        />
        Prevent direct pushes (require pull requests)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.preventForcePush}
          onChange={(e) => onChange({ preventForcePush: e.target.checked })}
          className="rounded"
        />
        Prevent force pushes
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.preventDeletion}
          onChange={(e) => onChange({ preventDeletion: e.target.checked })}
          className="rounded"
        />
        Prevent branch deletion
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.requireReviews}
          onChange={(e) => onChange({ requireReviews: e.target.checked })}
          className="rounded"
        />
        Require pull request reviews before merging
      </label>
      {values.requireReviews && (
        <div className="ml-6 flex items-center gap-2">
          <Label htmlFor="review-count" className="text-sm whitespace-nowrap">
            Required approvals:
          </Label>
          <Input
            id="review-count"
            type="number"
            min={1}
            max={10}
            value={values.requiredReviewCount}
            onChange={(e) => onChange({ requiredReviewCount: parseInt(e.target.value) || 1 })}
            className="w-20"
          />
        </div>
      )}
    </div>
  );
}
