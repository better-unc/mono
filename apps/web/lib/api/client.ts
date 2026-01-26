import { createApiClient } from "@gitbruv/lib";
import type { ApiClient } from "@gitbruv/hooks";
import { authClient } from "@/lib/auth-client";
import { getApiUrl } from "@/lib/utils";

const baseClient = createApiClient({
  baseUrl: getApiUrl() || "",
  getAuthHeaders: async (): Promise<HeadersInit> => {
    try {
      const session = await authClient.getSession();
      if (session.data?.session.token) {
        return { Authorization: `Bearer ${session.data.session.token}` };
      }
    } catch {}
    return {};
  },
  fetchOptions: {
    credentials: "include",
  },
});

export const api = {
  ...baseClient,
  settings: {
    ...baseClient.settings,
    updateAvatar: async (file: File) => {
      const apiUrl = getApiUrl();
      if (!apiUrl) {
        throw new Error("API URL not configured");
      }

      const session = await authClient.getSession();
      const headers: HeadersInit = session.data?.session.token
        ? { Authorization: `Bearer ${session.data.session.token}` }
        : {};

      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch(`${apiUrl}/api/settings/avatar`, {
        method: "POST",
        credentials: "include",
        headers,
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to upload avatar");
      }
      return res.json();
    },
  },
} as unknown as ApiClient;
