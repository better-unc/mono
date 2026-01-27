import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./context";
import type { Project, ProjectListItem, ProjectItem, ProjectColumn } from "./types";

export type { Project, ProjectListItem, ProjectItem, ProjectColumn };

export function useProjects(owner: string, repo: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["projects", owner, repo],
    queryFn: () => api.projects.list(owner, repo),
    enabled: !!owner && !!repo,
  });
}

export function useProject(id: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["project", id],
    queryFn: () => api.projects.get(id),
    enabled: !!id,
  });
}

export function useCreateProject(owner: string, repo: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.projects.create(owner, repo, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", owner, repo] });
    },
  });
}

export function useAddProjectItem(projectId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { columnId: string; issueId?: string; pullRequestId?: string; noteContent?: string }) =>
      api.projects.addItem(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

export function useReorderProjectItems(projectId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: { id: string; columnId: string; position: number }[]) =>
      api.projects.reorderItems(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

export function useDeleteProjectItem(projectId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => api.projects.deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

export function useAddProjectColumn(projectId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.projects.addColumn(projectId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}
