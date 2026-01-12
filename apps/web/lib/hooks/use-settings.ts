import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { api, fetcher, type UserProfile } from "@/lib/api/client";

export function useCurrentUser() {
  return useSWR<{ user: UserProfile }>("/api/settings", fetcher);
}

export function useUpdateProfile() {
  return useSWRMutation(
    "/api/settings/profile",
    (_, { arg }: { arg: { name: string; username: string; bio?: string; location?: string; website?: string; pronouns?: string } }) =>
      api.settings.updateProfile(arg)
  );
}

export function useUpdateSocialLinks() {
  return useSWRMutation(
    "/api/settings/social-links",
    (_, { arg }: { arg: { github?: string; twitter?: string; linkedin?: string; custom?: string[] } }) => api.settings.updateSocialLinks(arg)
  );
}

export function useUpdateAvatar() {
  return useSWRMutation("/api/settings/avatar", (_, { arg }: { arg: File }) => api.settings.updateAvatar(arg));
}

export function useUpdateEmail() {
  return useSWRMutation("/api/settings/email", (_, { arg }: { arg: { email: string } }) => api.settings.updateEmail(arg));
}

export function useUpdatePassword() {
  return useSWRMutation("/api/settings/password", (_, { arg }: { arg: { currentPassword: string; newPassword: string } }) =>
    api.settings.updatePassword(arg)
  );
}

export function useDeleteAccount() {
  return useSWRMutation("/api/settings/account", () => api.settings.deleteAccount());
}
