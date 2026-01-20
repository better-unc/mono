import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./context";
import type { IssueFilters } from "./types";

export function useIssues(owner: string, repo: string, filters?: IssueFilters) {
  const api = useApi();
  return useQuery({
    queryKey: ["issues", owner, repo, filters],
    queryFn: () => api.issues.list(owner, repo, filters),
    enabled: !!owner && !!repo,
  });
}

export function useIssue(owner: string, repo: string, number: number) {
  const api = useApi();
  return useQuery({
    queryKey: ["issue", owner, repo, number],
    queryFn: () => api.issues.get(owner, repo, number),
    enabled: !!owner && !!repo && !!number,
  });
}

export function useIssueCount(owner: string, repo: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["issues", owner, repo, "count"],
    queryFn: () => api.issues.getCount(owner, repo),
    enabled: !!owner && !!repo,
  });
}

export function useLabels(owner: string, repo: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["labels", owner, repo],
    queryFn: () => api.issues.listLabels(owner, repo),
    enabled: !!owner && !!repo,
  });
}

export function useIssueComments(issueId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["issue", issueId, "comments"],
    queryFn: () => api.issues.listComments(issueId),
    enabled: !!issueId,
  });
}

export function useCreateIssue(owner: string, repo: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; body?: string; labels?: string[]; assignees?: string[] }) =>
      api.issues.create(owner, repo, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", owner, repo] });
    },
  });
}

export function useUpdateIssue(id: string, owner: string, repo: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string; body?: string; state?: "open" | "closed"; locked?: boolean }) =>
      api.issues.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["issue"] });
    },
  });
}

export function useDeleteIssue(id: string, owner: string, repo: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.issues.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", owner, repo] });
    },
  });
}

export function useCreateLabel(owner: string, repo: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; color: string }) =>
      api.issues.createLabel(owner, repo, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels", owner, repo] });
    },
  });
}

export function useUpdateLabel(id: string, owner: string, repo: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; description?: string; color?: string }) =>
      api.issues.updateLabel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels", owner, repo] });
    },
  });
}

export function useDeleteLabel(id: string, owner: string, repo: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.issues.deleteLabel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels", owner, repo] });
    },
  });
}

export function useAddLabelsToIssue(issueId: string, owner: string, repo: string, issueNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labels: string[]) => api.issues.addLabels(issueId, labels),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["issue", owner, repo, issueNumber] });
    },
  });
}

export function useRemoveLabelFromIssue(issueId: string, owner: string, repo: string, issueNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => api.issues.removeLabel(issueId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["issue", owner, repo, issueNumber] });
    },
  });
}

export function useAddAssignees(issueId: string, owner: string, repo: string, issueNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignees: string[]) => api.issues.addAssignees(issueId, assignees),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["issue", owner, repo, issueNumber] });
    },
  });
}

export function useRemoveAssignee(issueId: string, owner: string, repo: string, issueNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.issues.removeAssignee(issueId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", owner, repo] });
      queryClient.invalidateQueries({ queryKey: ["issue", owner, repo, issueNumber] });
    },
  });
}

export function useCreateComment(issueId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.issues.createComment(issueId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", issueId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["issue"] });
    },
  });
}

export function useUpdateComment(commentId: string, issueId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.issues.updateComment(commentId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", issueId, "comments"] });
    },
  });
}

export function useDeleteComment(commentId: string, issueId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.issues.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", issueId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["issue"] });
    },
  });
}

export function useToggleIssueReaction(issueId: string, owner: string, repo: string, issueNumber: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emoji: string) => api.issues.toggleIssueReaction(issueId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", owner, repo, issueNumber] });
    },
  });
}

export function useToggleCommentReaction(commentId: string, issueId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emoji: string) => api.issues.toggleCommentReaction(commentId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", issueId, "comments"] });
    },
  });
}
