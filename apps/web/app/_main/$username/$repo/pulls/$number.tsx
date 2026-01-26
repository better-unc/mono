import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { GitBranchIcon, GitMergeIcon } from "@hugeicons-pro/core-stroke-standard";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePullRequest,
  useLabels,
  usePullRequestComments,
  usePullRequestDiff,
  useUpdatePullRequest,
  useDeletePullRequest,
  useMergePullRequest,
  useAddPRLabels,
  useRemovePRLabel,
  useAddPRAssignees,
  useRemovePRAssignee,
  useAddPRReviewers,
  useRemovePRReviewer,
  useCreatePRComment,
  useSubmitReview,
  useTogglePRReaction,
  useRepositoryInfo,
} from "@gitbruv/hooks";
import { PRDetail } from "@/components/pulls/pr-detail";
import { PRHeader } from "@/components/pulls/pr-header";
import { CommentList, CommentForm } from "@/components/issues";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api/client";

export const Route = createFileRoute("/_main/$username/$repo/pulls/$number")({
  component: PullRequestDetailPage,
});

function PullRequestDetailPage() {
  const { username, repo, number } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;

  const prNumber = parseInt(number, 10);

  const { data: repoInfo, isLoading: isLoadingRepo } = useRepositoryInfo(username, repo);
  const { data: pr, isLoading: isLoadingPR } = usePullRequest(username, repo, prNumber);
  const { data: labelsData, isLoading: isLoadingLabels } = useLabels(username, repo);
  const { data: commentsData, isLoading: isLoadingComments } = usePullRequestComments(pr?.id || "");
  const { data: diffData, isLoading: isLoadingDiff } = usePullRequestDiff(pr?.id || "");

  const updatePR = useUpdatePullRequest(pr?.id || "", username, repo);
  const deletePR = useDeletePullRequest(pr?.id || "", username, repo);
  const mergePR = useMergePullRequest(pr?.id || "", username, repo, prNumber);
  const toggleReaction = useTogglePRReaction(pr?.id || "", username, repo, prNumber);
  const addLabels = useAddPRLabels(pr?.id || "", username, repo, prNumber);
  const removeLabel = useRemovePRLabel(pr?.id || "", username, repo, prNumber);
  const addAssignees = useAddPRAssignees(pr?.id || "", username, repo, prNumber);
  const removeAssignee = useRemovePRAssignee(pr?.id || "", username, repo, prNumber);
  const addReviewers = useAddPRReviewers(pr?.id || "", username, repo, prNumber);
  const removeReviewer = useRemovePRReviewer(pr?.id || "", username, repo, prNumber);
  const createComment = useCreatePRComment(pr?.id || "");
  const submitReview = useSubmitReview(pr?.id || "", username, repo, prNumber);

  const isLoading = isLoadingRepo || isLoadingPR || isLoadingLabels;
  const labels = labelsData?.labels || [];
  const comments = commentsData?.comments || [];
  const isOwner = repoInfo?.isOwner || false;

  const availableAssignees = pr
    ? [
        pr.author,
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

  const handleUpdate = async (data: { title?: string; body?: string; state?: "open" | "closed" }) => {
    await updatePR.mutateAsync(data);
  };

  const handleDelete = async () => {
    await deletePR.mutateAsync();
    navigate({ to: "/$username/$repo/pulls", params: { username, repo } });
  };

  const handleMerge = async () => {
    await mergePR.mutateAsync({});
  };

  const handleToggleReaction = (emoji: string) => {
    toggleReaction.mutate(emoji);
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

  const handleAddReviewer = (userId: string) => {
    addReviewers.mutate([userId]);
  };

  const handleRemoveReviewer = (userId: string) => {
    removeReviewer.mutate(userId);
  };

  const handleCreateComment = async (body: string) => {
    await createComment.mutateAsync(body);
  };

  const handleSubmitReview = async (data: {
    body?: string;
    state: "approved" | "changes_requested" | "commented";
  }) => {
    await submitReview.mutateAsync(data);
  };

  const handleUpdateComment = async (commentId: string, body: string) => {
    await api.pullRequests.updateComment(commentId, body);
    queryClient.invalidateQueries({ queryKey: ["pullRequest", pr?.id, "comments"] });
  };

  const handleDeleteComment = async (commentId: string) => {
    await api.pullRequests.deleteComment(commentId);
    queryClient.invalidateQueries({ queryKey: ["pullRequest", pr?.id, "comments"] });
    queryClient.invalidateQueries({ queryKey: ["pullRequest"] });
  };

  const handleToggleCommentReaction = async (commentId: string, emoji: string) => {
    await api.pullRequests.toggleCommentReaction(commentId, emoji);
    queryClient.invalidateQueries({ queryKey: ["pullRequest", pr?.id, "comments"] });
  };

  if (isLoading) {
    return (
      <div className="container max-w-6xl px-4">
        <PRDetailSkeleton />
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="container max-w-6xl px-4">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Pull request not found</h2>
          <Link
            to="/$username/$repo/pulls"
            params={{ username, repo }}
            className="text-primary hover:underline"
          >
            Back to pull requests
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl px-4">
      <PRHeader
        pullRequest={pr}
        isOwner={isOwner}
        currentUserId={currentUserId}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onMerge={handleMerge}
        isMerging={mergePR.isPending}
      />

      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <HugeiconsIcon icon={GitBranchIcon} strokeWidth={2} className="size-4" />
        <span className="font-mono">
          {pr.headRepo?.owner.username}:{pr.headBranch}
        </span>
        <HugeiconsIcon icon={GitMergeIcon} strokeWidth={2} className="size-4" />
        <span className="font-mono">
          {pr.baseRepo?.owner.username}:{pr.baseBranch}
        </span>
      </div>

      <PRDetail
        pullRequest={pr}
        labels={labels}
        availableAssignees={availableAssignees}
        diffData={diffData}
        isLoadingDiff={isLoadingDiff}
        currentUserId={currentUserId}
        isOwner={isOwner}
        onToggleReaction={handleToggleReaction}
        onAddLabel={handleAddLabel}
        onRemoveLabel={handleRemoveLabel}
        onAddAssignee={handleAddAssignee}
        onRemoveAssignee={handleRemoveAssignee}
        onAddReviewer={handleAddReviewer}
        onRemoveReviewer={handleRemoveReviewer}
        onSubmitReview={handleSubmitReview}
        isSubmittingReview={submitReview.isPending}
      />

      <div className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Conversation ({pr.commentCount})</h2>

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

        {currentUserId && (
          <div className="mt-6 border-t border-border pt-6">
            <CommentForm
              currentUserAvatar={session?.user?.image}
              currentUserName={session?.user?.name || ""}
              onSubmit={handleCreateComment}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PRDetailSkeleton() {
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
