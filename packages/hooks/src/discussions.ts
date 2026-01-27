import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./context";

export function useDiscussions(owner: string, repo: string, options?: { category?: string; limit?: number; offset?: number }) {
  const api = useApi();
  const { category, limit = 20, offset = 0 } = options || {};

  return useQuery({
    queryKey: ["discussions", owner, repo, category, limit, offset],
    queryFn: () => api.discussions.list(owner, repo, { category, limit, offset }),
    enabled: !!owner && !!repo,
  });
}

export function useDiscussion(owner: string, repo: string, number: number) {
  const api = useApi();

  return useQuery({
    queryKey: ["discussion", owner, repo, number],
    queryFn: () => api.discussions.get(owner, repo, number),
    enabled: !!owner && !!repo && !!number,
  });
}

export function useDiscussionCategories(owner: string, repo: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["discussionCategories", owner, repo],
    queryFn: () => api.discussions.getCategories(owner, repo),
    enabled: !!owner && !!repo,
  });
}

export function useDiscussionComments(discussionId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["discussion", discussionId, "comments"],
    queryFn: () => api.discussions.listComments(discussionId),
    enabled: !!discussionId,
  });
}

export function useCreateDiscussion(owner: string, repo: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; body: string; categoryId?: string }) =>
      api.discussions.create(owner, repo, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discussions", owner, repo] });
    },
  });
}

export function useCreateDiscussionComment(discussionId: string, owner: string, repo: string, number: number) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { body: string; parentId?: string }) =>
      api.discussions.createComment(discussionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discussion", discussionId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["discussion", owner, repo, number] });
    },
  });
}

export function useMarkDiscussionAnswer(discussionId: string, owner: string, repo: string, number: number) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => api.discussions.markAnswer(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discussion", discussionId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["discussion", owner, repo, number] });
    },
  });
}

export function useToggleDiscussionReaction(discussionId: string, owner: string, repo: string, number: number) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emoji: string) => api.discussions.toggleReaction(discussionId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discussion", owner, repo, number] });
    },
  });
}
