import { useState, useEffect } from "react";
import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./context";

export function useRepoPageData(owner: string, name: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["repository", owner, name, "pageData"],
    queryFn: () => api.repositories.getPageData(owner, name),
    enabled: !!owner && !!name,
  });
}

export function useRepositoryInfo(owner: string, name: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["repository", owner, name, "info"],
    queryFn: () => api.repositories.getInfo(owner, name),
    enabled: !!owner && !!name,
  });
}

export function useRepositoryWithStars(owner: string, name: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["repository", owner, name, "withStars"],
    queryFn: () => api.repositories.getWithStars(owner, name),
    enabled: !!owner && !!name,
  });
}

export function useUserRepositories(username: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["repositories", "user", username],
    queryFn: () => api.repositories.getUserRepos(username),
    enabled: !!username,
  });
}

export function usePublicRepositories(sortBy: "stars" | "updated" | "created" = "updated", limit = 20, offset = 0) {
  const api = useApi();
  return useQuery({
    queryKey: ["repositories", "public", sortBy, limit, offset],
    queryFn: () => api.repositories.getPublic(sortBy, limit, offset),
  });
}

export function useInfinitePublicRepositories(sortBy: "stars" | "updated" | "created" = "updated", pageSize = 20) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ["repositories", "public", "infinite", sortBy],
    queryFn: ({ pageParam = 0 }) => api.repositories.getPublic(sortBy, pageSize, pageParam),
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length * pageSize : undefined),
    initialPageParam: 0,
  });
}

export function useRepoTree(owner: string, name: string, branch: string, path = "") {
  const api = useApi();
  return useQuery({
    queryKey: ["repository", owner, name, "tree", branch, path],
    queryFn: () => api.repositories.getTree(owner, name, branch, path),
    enabled: !!owner && !!name && !!branch,
  });
}

export function useRepoFile(owner: string, name: string, branch: string, path: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["repository", owner, name, "file", branch, path],
    queryFn: () => api.repositories.getFile(owner, name, branch, path),
    enabled: !!owner && !!name && !!branch && !!path,
  });
}

export function useRepoBranches(owner: string, name: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["repository", owner, name, "branches"],
    queryFn: () => api.repositories.getBranches(owner, name),
    enabled: !!owner && !!name,
  });
}

export function useRepoCommits(owner: string, name: string, branch: string, limit = 30, skip = 0) {
  const api = useApi();
  return useQuery({
    queryKey: ["repository", owner, name, "commits", branch, limit, skip],
    queryFn: () => api.repositories.getCommits(owner, name, branch, limit, skip),
    enabled: !!owner && !!name && !!branch,
  });
}

export function useRepoCommitCount(owner: string, name: string, branch: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["repository", owner, name, "commits", "count", branch],
    queryFn: () => api.repositories.getCommitCount(owner, name, branch),
    enabled: !!owner && !!name && !!branch,
  });
}

export function useRepoReadmeOid(owner: string, name: string, branch: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["repository", owner, name, "readmeOid", branch],
    queryFn: () => api.repositories.getReadmeOid(owner, name, branch),
    enabled: !!owner && !!name && !!branch,
  });
}

export function useRepoReadme(owner: string, name: string, oid: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["repository", owner, name, "readme", oid],
    queryFn: () => api.repositories.getReadme(owner, name, oid!),
    enabled: !!owner && !!name && !!oid,
  });
}

export function useCreateRepository() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; visibility: "public" | "private" }) => api.repositories.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });
}

export function useUpdateRepository(id: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; description?: string; visibility?: "public" | "private" }) => api.repositories.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repository"] });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });
}

export function useDeleteRepository(id: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.repositories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repository"] });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });
}

export function useIsStarredByUser(repoId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["repository", repoId, "isStarred"],
    queryFn: () => api.repositories.isStarred(repoId),
    enabled: !!repoId,
  });
}

export function useToggleStar(repoId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.repositories.toggleStar(repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repository"] });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });
}

export function useStarRepository(repoId: string, initialStarCount?: number) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { data, isLoading } = useIsStarredByUser(repoId);
  const [starCount, setStarCount] = useState(initialStarCount);
  const [isStarred, setIsStarred] = useState(false);

  useEffect(() => {
    setStarCount(initialStarCount);
  }, [initialStarCount]);

  useEffect(() => {
    if (data !== undefined) {
      setIsStarred(data.starred);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const currentStarred = isStarred;
      const newStarred = !currentStarred;
      setIsStarred(newStarred);
      setStarCount((prev) => (newStarred ? (prev || 0) + 1 : Math.max(0, (prev || 0) - 1)));
      try {
        const result = await api.repositories.toggleStar(repoId);
        setIsStarred(result.starred);
        return result;
      } catch (error) {
        setIsStarred(currentStarred);
        setStarCount(initialStarCount);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repository", repoId, "isStarred"] });
    },
  });

  return {
    isStarred,
    isLoading,
    starCount,
    toggleStar: mutation.mutate,
    isMutating: mutation.isPending,
  };
}
