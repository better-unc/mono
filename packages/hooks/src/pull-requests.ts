import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./context";
import type { PRFilters } from "./types";

export function usePullRequests(owner: string, repo: string, filters?: PRFilters) {
  const api = useApi();
  return useQuery({
    queryKey: ["pullRequests", owner, repo, filters],
    queryFn: () => api.pullRequests.list(owner, repo, filters),
    enabled: !!owner && !!repo,
  });
}

export function usePullRequest(owner: string, repo: string, number: number) {
  const api = useApi();
  return useQuery({
    queryKey: ["pullRequest", owner, repo, number],
    queryFn: () => api.pullRequests.get(owner, repo, number),
    enabled: !!owner && !!repo && !!number,
  });
}

export function usePullRequestCount(owner: string, repo: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["pullRequests", owner, repo, "count"],
    queryFn: () => api.pullRequests.getCount(owner, repo),
    enabled: !!owner && !!repo,
  });
}

export function usePullRequestDiff(prId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["pullRequest", prId, "diff"],
    queryFn: () => api.pullRequests.getDiff(prId),
    enabled: !!prId,
  });
}

export function usePullRequestCommits(prId: string, limit = 30, skip = 0) {
  const api = useApi();
  return useQuery({
    queryKey: ["pullRequest", prId, "commits", limit, skip],
    queryFn: () => api.pullRequests.getCommits(prId, limit, skip),
    enabled: !!prId,
  });
}

export function usePullRequestReviews(prId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["pullRequest", prId, "reviews"],
    queryFn: () => api.pullRequests.listReviews(prId),
    enabled: !!prId,
  });
}

export function usePullRequestComments(prId: string, options?: { groupByFile?: boolean; filePath?: string }) {
  const api = useApi();
  return useQuery({
    queryKey: ["pullRequest", prId, "comments", options],
    queryFn: () => api.pullRequests.listComments(prId, options),
    enabled: !!prId,
  });
}

export function useCreatePullRequest(owner: string, repo: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      body?: string;
      headRepoOwner?: string;
      headRepoName?: string;
      headBranch: string;
      baseBranch?: string;
      labels?: string[];
      assignees?: string[];
      reviewers?: string[];
    }) => api.pullRequests.create(owner, repo, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequests", owner, repo] });
    },
  });
}

export function useUpdatePullRequest(id: string, owner: string, repo: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string; body?: string; state?: "open" | "closed" }) =>
      api.pullRequests.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequests", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["pullRequest"] });
    },
  });
}

export function useDeletePullRequest(id: string, owner: string, repo: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.pullRequests.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequests", owner, repo] });
    },
  });
}

export function useMergePullRequest(id: string, owner: string, repo: string, prNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { commitMessage?: string }) => api.pullRequests.merge(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequests", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["pullRequest", owner, repo, prNumber] });
    },
  });
}

export function useMarkPRReady(id: string, owner: string, repo: string, prNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.pullRequests.markReady(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequests", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["pullRequest", owner, repo, prNumber] });
    },
  });
}

export function useConvertPRToDraft(id: string, owner: string, repo: string, prNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.pullRequests.convertToDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequests", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["pullRequest", owner, repo, prNumber] });
    },
  });
}

export function useSubmitReview(prId: string, owner: string, repo: string, prNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { body?: string; state: "approved" | "changes_requested" | "commented" }) =>
      api.pullRequests.submitReview(prId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequest", prId, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["pullRequest", owner, repo, prNumber] });
    },
  });
}

export function useCreatePRComment(prId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: string | { body: string; filePath?: string; side?: "left" | "right"; lineNumber?: number; commitOid?: string; replyToId?: string }) =>
      api.pullRequests.createComment(prId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequest", prId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["pullRequest"] });
    },
  });
}

export function useUpdatePRComment(commentId: string, prId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.pullRequests.updateComment(commentId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequest", prId, "comments"] });
    },
  });
}

export function useDeletePRComment(commentId: string, prId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.pullRequests.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequest", prId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["pullRequest"] });
    },
  });
}

export function useAddPRLabels(prId: string, owner: string, repo: string, prNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labels: string[]) => api.pullRequests.addLabels(prId, labels),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequests", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["pullRequest", owner, repo, prNumber] });
    },
  });
}

export function useRemovePRLabel(prId: string, owner: string, repo: string, prNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => api.pullRequests.removeLabel(prId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequests", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["pullRequest", owner, repo, prNumber] });
    },
  });
}

export function useAddPRAssignees(prId: string, owner: string, repo: string, prNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignees: string[]) => api.pullRequests.addAssignees(prId, assignees),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequests", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["pullRequest", owner, repo, prNumber] });
    },
  });
}

export function useRemovePRAssignee(prId: string, owner: string, repo: string, prNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.pullRequests.removeAssignee(prId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequests", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["pullRequest", owner, repo, prNumber] });
    },
  });
}

export function useAddPRReviewers(prId: string, owner: string, repo: string, prNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewers: string[]) => api.pullRequests.addReviewers(prId, reviewers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequests", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["pullRequest", owner, repo, prNumber] });
    },
  });
}

export function useRemovePRReviewer(prId: string, owner: string, repo: string, prNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.pullRequests.removeReviewer(prId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequests", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["pullRequest", owner, repo, prNumber] });
    },
  });
}

export function useTogglePRReaction(prId: string, owner: string, repo: string, prNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emoji: string) => api.pullRequests.toggleReaction(prId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequest", owner, repo, prNumber] });
    },
  });
}

export function useTogglePRCommentReaction(commentId: string, prId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emoji: string) => api.pullRequests.toggleCommentReaction(commentId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pullRequest", prId, "comments"] });
    },
  });
}
