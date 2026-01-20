import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon } from "@hugeicons-pro/core-stroke-standard";
import { useQueryClient } from "@tanstack/react-query";
import {
  useIssue,
  useLabels,
  useIssueComments,
  useUpdateIssue,
  useDeleteIssue,
  useAddLabelsToIssue,
  useRemoveLabelFromIssue,
  useAddAssignees,
  useRemoveAssignee,
  useCreateComment,
  useToggleIssueReaction,
  useRepositoryInfo,
} from "@gitbruv/hooks";
import { IssueDetail, CommentList, CommentForm, StateBadge } from "@/components/issues";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api/client";

export const Route = createFileRoute("/_main/$username/$repo/issues/$number")({
  component: IssueDetailPage,
});

function IssueDetailPage() {
  const { username, repo, number } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;

  const issueNumber = parseInt(number, 10);

  const { data: repoInfo, isLoading: isLoadingRepo } = useRepositoryInfo(username, repo);
  const { data: issue, isLoading: isLoadingIssue } = useIssue(username, repo, issueNumber);
  const { data: labelsData, isLoading: isLoadingLabels } = useLabels(username, repo);
  const { data: commentsData, isLoading: isLoadingComments } = useIssueComments(issue?.id || "");

  const updateIssue = useUpdateIssue(issue?.id || "", username, repo);
  const deleteIssue = useDeleteIssue(issue?.id || "", username, repo);
  const toggleIssueReaction = useToggleIssueReaction(issue?.id || "", username, repo, issueNumber);
  const addLabels = useAddLabelsToIssue(issue?.id || "", username, repo, issueNumber);
  const removeLabel = useRemoveLabelFromIssue(issue?.id || "", username, repo, issueNumber);
  const addAssignees = useAddAssignees(issue?.id || "", username, repo, issueNumber);
  const removeAssignee = useRemoveAssignee(issue?.id || "", username, repo, issueNumber);
  const createComment = useCreateComment(issue?.id || "");

  const isLoading = isLoadingRepo || isLoadingIssue || isLoadingLabels;
  const labels = labelsData?.labels || [];
  const comments = commentsData?.comments || [];
  const isOwner = repoInfo?.isOwner || false;

  const availableAssignees = issue
    ? [
        issue.author,
        ...(repoInfo?.repo.owner
          ? [
              {
                id: repoInfo.repo.owner.id,
                username: repoInfo.repo.owner.username,
                name: repoInfo.repo.owner.name,
                avatarUrl: repoInfo.repo.owner.avatarUrl,
              },
            ]
          : []),
      ].filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i)
    : [];

  const handleUpdate = async (data: { title?: string; body?: string; state?: "open" | "closed"; locked?: boolean }) => {
    await updateIssue.mutateAsync(data);
  };

  const handleDelete = async () => {
    await deleteIssue.mutateAsync();
    navigate({ to: "/$username/$repo/issues", params: { username, repo } });
  };

  const handleToggleReaction = (emoji: string) => {
    toggleIssueReaction.mutate(emoji);
  };

  const handleAddLabel = (labelId: string) => {
    addLabels.mutate([labelId]);
  };

  const handleRemoveLabel = (labelId: string) => {
    removeLabel.mutate(labelId);
  };

  const handleAddAssignee = (userId: string) => {
    addAssignees.mutate([userId]);
  };

  const handleRemoveAssignee = (userId: string) => {
    removeAssignee.mutate(userId);
  };

  const handleCreateComment = async (body: string) => {
    await createComment.mutateAsync(body);
  };

  const handleUpdateComment = async (commentId: string, body: string) => {
    await api.issues.updateComment(commentId, body);
    queryClient.invalidateQueries({ queryKey: ["issue", issue?.id, "comments"] });
  };

  const handleDeleteComment = async (commentId: string) => {
    await api.issues.deleteComment(commentId);
    queryClient.invalidateQueries({ queryKey: ["issue", issue?.id, "comments"] });
    queryClient.invalidateQueries({ queryKey: ["issue"] });
  };

  const handleToggleCommentReaction = async (commentId: string, emoji: string) => {
    await api.issues.toggleCommentReaction(commentId, emoji);
    queryClient.invalidateQueries({ queryKey: ["issue", issue?.id, "comments"] });
  };

  if (isLoading) {
    return (
      <div className="container max-w-6xl px-4">
        <IssueDetailSkeleton />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="container max-w-6xl px-4">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Issue not found</h2>
          <Link
            to="/$username/$repo/issues"
            params={{ username, repo }}
            className="text-primary hover:underline"
          >
            Back to issues
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl px-4">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{issue.title}</h1>
            <span className="text-2xl text-muted-foreground">#{issue.number}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <StateBadge state={issue.state} />
            {issue.locked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                <HugeiconsIcon icon={LockIcon} strokeWidth={2} className="size-3" />
                Locked
              </span>
            )}
          </div>
        </div>
      </div>

      <IssueDetail
        issue={issue}
        labels={labels}
        availableAssignees={availableAssignees}
        currentUserId={currentUserId}
        isOwner={isOwner}
        onToggleReaction={handleToggleReaction}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onAddLabel={handleAddLabel}
        onRemoveLabel={handleRemoveLabel}
        onAddAssignee={handleAddAssignee}
        onRemoveAssignee={handleRemoveAssignee}
      />

      <div className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Comments ({issue.commentCount})</h2>

        {isLoadingComments ? (
          <CommentsSkeleton />
        ) : (
          <CommentList
            comments={comments}
            currentUserId={currentUserId}
            onToggleReaction={handleToggleCommentReaction}
            onUpdateComment={handleUpdateComment}
            onDeleteComment={handleDeleteComment}
          />
        )}

        {currentUserId && !issue.locked && (
          <div className="mt-6 border-t border-border pt-6">
            <CommentForm
              currentUserAvatar={session?.user?.image}
              currentUserName={session?.user?.name || ""}
              onSubmit={handleCreateComment}
            />
          </div>
        )}

        {issue.locked && (
          <div className="text-center py-6 border border-border bg-secondary/30">
            <HugeiconsIcon icon={LockIcon} strokeWidth={2} className="size-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">This conversation has been locked.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function IssueDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-3/4 bg-secondary/50" />
        <div className="h-6 w-24 bg-secondary/50" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="border border-border bg-card p-6 space-y-4">
            <div className="h-4 w-full bg-secondary/50" />
            <div className="h-4 w-5/6 bg-secondary/50" />
            <div className="h-4 w-4/5 bg-secondary/50" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-24 bg-secondary/50" />
          <div className="h-24 bg-secondary/50" />
        </div>
      </div>
    </div>
  );
}

function CommentsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-secondary/50" />
            <div className="h-4 w-24 bg-secondary/50" />
          </div>
          <div className="h-4 w-full bg-secondary/50" />
          <div className="h-4 w-3/4 bg-secondary/50" />
        </div>
      ))}
    </div>
  );
}
