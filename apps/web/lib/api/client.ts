import { authClient } from "@/lib/auth-client";

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
  const res = await fetch(endpoint, {
    ...options,
    credentials: "include",
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

export type Owner = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
};

export type Repository = {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  defaultBranch: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type RepositoryWithOwner = Repository & {
  owner: Owner;
  starCount: number;
  starred: boolean;
};

export type FileEntry = {
  name: string;
  type: "blob" | "tree";
  oid: string;
  path: string;
};

export type RepoPageData = {
  repo: RepositoryWithOwner;
  files: FileEntry[];
  isEmpty: boolean;
  branches: string[];
  readmeOid: string | null;
  isOwner: boolean;
};

export type Commit = {
  oid: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
  timestamp: number;
};

export type UserProfile = {
  id: string;
  name: string;
  username: string;
  email?: string;
  emailVerified?: boolean;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  pronouns: string | null;
  socialLinks: {
    github?: string;
    twitter?: string;
    linkedin?: string;
    custom?: string[];
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  repoCount: number;
};

export type RepositoryWithStars = Repository & {
  owner: Owner;
  starCount: number;
};

export const api = {
  repositories: {
    create: (data: { name: string; description?: string; visibility: "public" | "private" }) =>
      apiFetch<Repository>("/api/repositories", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    get: (owner: string, name: string) => apiFetch<RepositoryWithOwner>(`/api/repositories/${owner}/${name}`),

    getWithStars: (owner: string, name: string) => apiFetch<RepositoryWithOwner>(`/api/repositories/${owner}/${name}/with-stars`),

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

    getBranches: (owner: string, name: string) => apiFetch<{ branches: string[] }>(`/api/repositories/${owner}/${name}/branches`),

    getTree: (owner: string, name: string, branch: string, path = "") =>
      apiFetch<{ files: FileEntry[]; isEmpty: boolean }>(`/api/repositories/${owner}/${name}/tree?branch=${branch}&path=${encodeURIComponent(path)}`),

    getFile: (owner: string, name: string, branch: string, path: string) =>
      apiFetch<{ content: string; oid: string; path: string }>(`/api/repositories/${owner}/${name}/file?branch=${branch}&path=${encodeURIComponent(path)}`),

    getCommits: (owner: string, name: string, branch: string, limit = 30, skip = 0) =>
      apiFetch<{ commits: Commit[]; hasMore: boolean }>(`/api/repositories/${owner}/${name}/commits?branch=${branch}&limit=${limit}&skip=${skip}`),

    getCommitCount: (owner: string, name: string, branch: string) =>
      apiFetch<{ count: number }>(`/api/repositories/${owner}/${name}/commits/count?branch=${branch}`),

    getReadme: (owner: string, name: string, oid: string) => apiFetch<{ content: string }>(`/api/repositories/${owner}/${name}/readme?oid=${oid}`),
  },

  users: {
    getProfile: (username: string) => apiFetch<UserProfile>(`/api/users/${username}/profile`),

    getStarred: (username: string) => apiFetch<{ repos: RepositoryWithStars[] }>(`/api/users/${username}/starred`),

    getPublic: (sortBy: "newest" | "oldest" = "newest", limit = 20, offset = 0) =>
      apiFetch<{ users: PublicUser[]; hasMore: boolean }>(`/api/users/public?sortBy=${sortBy}&limit=${limit}&offset=${offset}`),
  },

  settings: {
    getCurrentUser: () => apiFetch<UserProfile>(`/api/settings/current-user`),

    updateProfile: (data: { name: string; username: string; bio?: string; location?: string; website?: string; pronouns?: string }) =>
      apiFetch<{ success: boolean; username: string }>(`/api/settings/profile`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    updateSocialLinks: (data: { github?: string; twitter?: string; linkedin?: string; custom?: string[] }) =>
      apiFetch<{ success: boolean }>(`/api/settings/social-links`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    updateAvatar: async (file: File) => {
      const authHeaders = await getAuthHeaders();
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/settings/avatar", {
        method: "POST",
        credentials: "include",
        headers: authHeaders,
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to upload avatar");
      }
      return res.json() as Promise<{ success: boolean; avatarUrl: string }>;
    },

    updateEmail: (data: { email: string }) =>
      apiFetch<{ success: boolean }>(`/api/settings/email`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    updatePassword: (data: { currentPassword: string; newPassword: string }) =>
      apiFetch<{ success: boolean }>(`/api/settings/password`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    deleteAccount: () =>
      apiFetch<{ success: boolean }>(`/api/settings/account`, {
        method: "DELETE",
      }),
  },
};

export const fetcher = async <T>(url: string): Promise<T> => {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, {
    credentials: "include",
    headers: authHeaders,
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};
