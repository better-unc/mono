import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export function useUserProfile(username: string) {
  return useQuery({
    queryKey: ["user", username, "profile"],
    queryFn: () => api.users.getProfile(username),
    enabled: !!username,
    staleTime: 1000 * 60 * 10,
  });
}

export function usePublicUsers(
  sortBy: "newest" | "oldest" = "newest",
  limit: number = 20
) {
  return useQuery({
    queryKey: ["users", "public", sortBy, limit],
    queryFn: () => api.users.getPublic(sortBy, limit),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUserStarred(username: string) {
  return useQuery({
    queryKey: ["user", username, "starred"],
    queryFn: () => api.users.getStarred(username),
    enabled: !!username,
    staleTime: 1000 * 60 * 5,
  });
}
