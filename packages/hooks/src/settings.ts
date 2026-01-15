import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { useApi } from "./context";
import type { UserPreferences, UserProfile } from "./types";

export function useCurrentUser(options?: UseQueryOptions<{ user: UserProfile }, Error>) {
  const api = useApi();
  return useQuery({
    ...options,
    queryKey: ["settings", "currentUser"],
    queryFn: () => api.settings.getCurrentUser(),
  });
}

export function useWordWrapPreference(options?: Omit<UseQueryOptions<{ wordWrap: boolean }, Error>, "queryKey" | "queryFn">) {
  const api = useApi();
  return useQuery({
    ...options,
    queryKey: ["settings", "wordWrap"],
    queryFn: () => api.settings.getWordWrap(),
  });
}

export function useUpdateProfile() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; username?: string; bio?: string; location?: string; website?: string; pronouns?: string; company?: string; gitEmail?: string; defaultRepositoryVisibility?: "public" | "private" }) =>
      api.settings.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

export function useUpdatePreferences() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UserPreferences>) => api.settings.updatePreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

export function useUpdateWordWrapPreference() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { wordWrap: boolean }) => api.settings.updateWordWrap(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "wordWrap"] });
    },
  });
}

export function useUpdateSocialLinks() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { github?: string; twitter?: string; linkedin?: string; custom?: string[] }) => {
      if (!api.settings.updateSocialLinks) {
        throw new Error("updateSocialLinks not available on this platform");
      }
      return api.settings.updateSocialLinks(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

export function useUpdateEmail() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string }) => api.settings.updateEmail(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useUpdatePassword() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => {
      if (!api.settings.updatePassword) {
        throw new Error("updatePassword not available on this platform");
      }
      return api.settings.updatePassword(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useDeleteAccount() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.settings.deleteAccount(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
