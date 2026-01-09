import useSWR from "swr";
import { fetcher, type UserProfile, type PublicUser, type RepositoryWithStars } from "@/lib/api/client";

export function useUserProfile(username: string) {
  return useSWR<UserProfile>(username ? `/api/users/${username}/profile` : null, fetcher);
}

export function useUserStarredRepos(username: string) {
  return useSWR<{ repos: RepositoryWithStars[] }>(username ? `/api/users/${username}/starred` : null, fetcher);
}

export function useUserAvatarByEmail(email: string | null | undefined) {
  return useSWR<{ avatarUrl: string | null }>(
    email ? `/api/users/by-email/${encodeURIComponent(email)}/avatar` : null,
    fetcher
  );
}

export function usePublicUsers(sortBy: "newest" | "oldest" = "newest", limit = 20, offset = 0) {
  return useSWR<{ users: PublicUser[]; hasMore: boolean }>(`/api/users/public?sortBy=${sortBy}&limit=${limit}&offset=${offset}`, fetcher);
}
