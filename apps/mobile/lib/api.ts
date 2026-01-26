import { createApiClient } from "@gitbruv/lib";
import { authClient } from "./auth-client";
import type { ApiClient } from "@gitbruv/hooks";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

const baseClient = createApiClient({
  baseUrl: API_URL,
  getAuthHeaders: async (): Promise<HeadersInit> => {
    try {
      const session = await authClient.getSession();
      if (session?.data?.session?.token) {
        return { Authorization: `Bearer ${session.data.session.token}` };
      }
    } catch {}
    return {};
  },
});

export const api = {
  ...baseClient,
  settings: {
    ...baseClient.settings,
    updateAvatar: async (uri: string, mimeType: string) => {
      const session = await authClient.getSession();
      const authHeaders: HeadersInit = session?.data?.session?.token
        ? { Authorization: `Bearer ${session.data.session.token}` }
        : {};

      const formData = new FormData();
      const ext = mimeType.split("/")[1] || "png";
      formData.append("avatar", {
        uri,
        name: `avatar.${ext}`,
        type: mimeType,
      } as any);

      const res = await fetch(`${API_URL}/api/settings/avatar`, {
        method: "POST",
        headers: authHeaders,
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
