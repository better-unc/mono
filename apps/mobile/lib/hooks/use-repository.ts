import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export function useRepositoryPageData(owner: string, name: string) {
  return useQuery({
    queryKey: ["repository", owner, name, "pageData"],
    queryFn: () => api.repositories.getPageData(owner, name),
    enabled: !!owner && !!name,
    staleTime: 1000 * 60 * 5,
  });
}

export function useRepositoryTree(
  owner: string,
  name: string,
  branch: string,
  path: string = ""
) {
  return useQuery({
    queryKey: ["repository", owner, name, "tree", branch, path],
    queryFn: () => api.repositories.getTree(owner, name, branch, path),
    enabled: !!owner && !!name && !!branch,
    staleTime: 1000 * 60 * 10,
  });
}

export function useRepositoryFile(
  owner: string,
  name: string,
  branch: string,
  path: string
) {
  return useQuery({
    queryKey: ["repository", owner, name, "file", branch, path],
    queryFn: () => api.repositories.getFile(owner, name, branch, path),
    enabled: !!owner && !!name && !!branch && !!path,
    staleTime: 1000 * 60 * 10,
  });
}

export function useRepositoryCommits(
  owner: string,
  name: string,
  branch: string,
  limit: number = 30
) {
  return useQuery({
    queryKey: ["repository", owner, name, "commits", branch, limit],
    queryFn: () => api.repositories.getCommits(owner, name, branch, limit),
    enabled: !!owner && !!name && !!branch,
    staleTime: 1000 * 60 * 2,
  });
}

export function usePublicRepositories(
  sortBy: "stars" | "updated" | "created" = "updated",
  limit: number = 20
) {
  return useQuery({
    queryKey: ["repositories", "public", sortBy, limit],
    queryFn: () => api.repositories.getPublic(sortBy, limit),
    staleTime: 1000 * 60 * 2,
  });
}

export function useUserRepositories(username: string) {
  return useQuery({
    queryKey: ["repositories", "user", username],
    queryFn: () => api.repositories.getUserRepos(username),
    enabled: !!username,
    staleTime: 1000 * 60 * 5,
  });
}

export function useToggleStar(repoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.repositories.toggleStar(repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repository"] });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });
}
