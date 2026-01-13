import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "./context";

export function useUserProfile(username: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["user", username, "profile"],
    queryFn: () => api.users.getProfile(username),
    enabled: !!username,
  });
}

export function useUserStarredRepos(username: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["user", username, "starred"],
    queryFn: () => api.users.getStarred(username),
    enabled: !!username,
  });
}

export function useUserAvatarByUsername(username: string | null | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["user", username, "avatar"],
    queryFn: () => api.users.getAvatarByUsername(username!),
    enabled: !!username,
  });
}

export function usePublicUsers(sortBy: "newest" | "oldest" = "newest", limit = 20, offset = 0) {
  const api = useApi();
  return useQuery({
    queryKey: ["users", "public", sortBy, limit, offset],
    queryFn: () => api.users.getPublic(sortBy, limit, offset),
  });
}

export function useInfinitePublicUsers(sortBy: "newest" | "oldest" = "newest", pageSize = 20) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ["users", "public", "infinite", sortBy],
    queryFn: ({ pageParam = 0 }) => api.users.getPublic(sortBy, pageSize, pageParam),
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length * pageSize : undefined),
    initialPageParam: 0,
  });
}
