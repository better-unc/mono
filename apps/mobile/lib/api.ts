import { authClient } from "./auth-client";
import type {
  Repository,
  RepositoryWithOwner,
  RepositoryWithStars,
  RepoInfo,
  RepoPageData,
  TreeResponse,
  Commit,
  UserProfile,
  PublicUser,
  ApiClient,
} from "@gitbruv/hooks";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    const session = await authClient.getSession();
    if (session?.data?.session?.token) {
      return { Authorization: `Bearer ${session.data.session.token}` };
    }
  } catch {}
  return {};
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api: ApiClient = {
  repositories: {
    create: (data: { name: string; description?: string; visibility: "public" | "private" }) =>
      apiFetch<Repository>("/api/repositories", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    get: (owner: string, name: string) => apiFetch<RepositoryWithOwner>(`/api/repositories/${owner}/${name}`),

    getWithStars: (owner: string, name: string) => apiFetch<RepositoryWithOwner>(`/api/repositories/${owner}/${name}/with-stars`),

    getInfo: (owner: string, name: string) => apiFetch<RepoInfo>(`/api/repositories/${owner}/${name}/info`),

    getPageData: (owner: string, name: string) => apiFetch<RepoPageData>(`/api/repositories/${owner}/${name}/page-data`),

    getUserRepos: (username: string) => apiFetch<{ repos: RepositoryWithStars[] }>(`/api/repositories/user/${username}`),

    getPublic: (sortBy: "stars" | "updated" | "created" = "updated", limit = 20, offset = 0) =>
      apiFetch<{ repos: RepositoryWithStars[]; hasMore: boolean }>(`/api/repositories/public?sortBy=${sortBy}&limit=${limit}&offset=${offset}`),

    update: (id: string, data: { name?: string; description?: string; visibility?: "public" | "private" }) =>
      apiFetch<Repository>(`/api/repositories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/repositories/${id}`, {
        method: "DELETE",
      }),

    toggleStar: (id: string) =>
      apiFetch<{ starred: boolean }>(`/api/repositories/${id}/star`, {
        method: "POST",
      }),

    isStarred: (id: string) => apiFetch<{ starred: boolean }>(`/api/repositories/${id}/is-starred`),

    getBranches: (owner: string, name: string) => apiFetch<{ branches: string[] }>(`/api/repositories/${owner}/${name}/branches`),

    getTree: (owner: string, name: string, branch: string, path = "") =>
      apiFetch<TreeResponse>(`/api/repositories/${owner}/${name}/tree?branch=${branch}&path=${encodeURIComponent(path)}`),

    getFile: (owner: string, name: string, branch: string, path: string) =>
      apiFetch<{ content: string; oid: string; path: string }>(`/api/repositories/${owner}/${name}/file?branch=${branch}&path=${encodeURIComponent(path)}`),

    getCommits: (owner: string, name: string, branch: string, limit = 30, skip = 0) =>
      apiFetch<{ commits: Commit[]; hasMore: boolean }>(`/api/repositories/${owner}/${name}/commits?branch=${branch}&limit=${limit}&skip=${skip}`),

    getCommitCount: (owner: string, name: string, branch: string) =>
      apiFetch<{ count: number }>(`/api/repositories/${owner}/${name}/commits/count?branch=${branch}`),

    getReadme: (owner: string, name: string, oid: string) => apiFetch<{ content: string }>(`/api/repositories/${owner}/${name}/readme?oid=${oid}`),

    getReadmeOid: (owner: string, name: string, branch: string) =>
      apiFetch<{ readmeOid: string | null }>(`/api/repositories/${owner}/${name}/readme-oid?branch=${branch}`),
  },

  users: {
    getProfile: (username: string) => apiFetch<UserProfile>(`/api/users/${username}/profile`),

    getStarred: (username: string) => apiFetch<{ repos: RepositoryWithStars[] }>(`/api/users/${username}/starred`),

    getAvatarByUsername: (username: string) => apiFetch<{ avatarUrl: string | null }>(`/api/users/${username}/avatar`),

    getPublic: (sortBy: "newest" | "oldest" = "newest", limit = 20, offset = 0) =>
      apiFetch<{ users: PublicUser[]; hasMore: boolean }>(`/api/users/public?sortBy=${sortBy}&limit=${limit}&offset=${offset}`),
  },

  settings: {
    getCurrentUser: () => apiFetch<{ user: UserProfile }>(`/api/settings`),

    updateProfile: (data: { name?: string; bio?: string; location?: string; website?: string; pronouns?: string }) =>
      apiFetch<UserProfile>(`/api/settings/profile`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    updateEmail: (data: { email: string }) =>
      apiFetch<UserProfile>(`/api/settings/email`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    deleteAccount: () =>
      apiFetch<{ success: boolean }>(`/api/settings/account`, {
        method: "DELETE",
      }),
  },
};

export async function updateAvatar(uri: string, mimeType: string): Promise<{ success: boolean; avatarUrl: string }> {
  const authHeaders = await getAuthHeaders();
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
}
