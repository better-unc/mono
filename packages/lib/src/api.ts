import type {
  ApiClient,
  Commit,
  CommitDiff,
  FileLastCommit,
  Issue,
  IssueComment,
  IssueFilters,
  Label,
  PublicUser,
  RepoInfo,
  RepoPageData,
  Repository,
  RepositoryWithOwner,
  RepositoryWithStars,
  TreeResponse,
  UserPreferences,
  UserProfile,
  UserSummary,
} from "@gitbruv/hooks";

export interface ApiClientConfig {
  baseUrl: string;
  getAuthHeaders: () => Promise<HeadersInit>;
  fetchOptions?: RequestInit;
}

export function createApiClient(config: ApiClientConfig): Omit<ApiClient, "settings"> & {
  settings: Omit<ApiClient["settings"], "updateAvatar" | "deleteAvatar">;
} {
  const { baseUrl, getAuthHeaders, fetchOptions = {} } = config;

  async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const fullUrl = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;
    const authHeaders = await getAuthHeaders();

    const res = await fetch(fullUrl, {
      ...fetchOptions,
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...fetchOptions.headers,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed: ${res.status}`);
    }

    return res.json();
  }

  return {
    repositories: {
      create: (data: { name: string; description?: string; visibility: "public" | "private" }) =>
        apiFetch<Repository>("/api/repositories", {
          method: "POST",
          body: JSON.stringify(data),
        }),

      fork: (owner: string, name: string, data?: { name?: string; description?: string }) =>
        apiFetch<RepoInfo>(`/api/repositories/${owner}/${name}/fork`, {
          method: "POST",
          body: JSON.stringify(data || {}),
        }),

      getForks: (owner: string, name: string, limit = 20, offset = 0) =>
        apiFetch<{ forks: RepositoryWithOwner[] }>(
          `/api/repositories/${owner}/${name}/forks?limit=${limit}&offset=${offset}`
        ),

      get: (owner: string, name: string) => apiFetch<RepositoryWithOwner>(`/api/repositories/${owner}/${name}`),

      getWithStars: (owner: string, name: string) =>
        apiFetch<RepositoryWithOwner>(`/api/repositories/${owner}/${name}/with-stars`),

      getInfo: (owner: string, name: string) => apiFetch<RepoInfo>(`/api/repositories/${owner}/${name}/info`),

      getPageData: (owner: string, name: string) => apiFetch<RepoPageData>(`/api/repositories/${owner}/${name}/page-data`),

      getUserRepos: (username: string) => apiFetch<{ repos: RepositoryWithStars[] }>(`/api/repositories/user/${username}`),

      getPublic: (sortBy: "stars" | "updated" | "created" = "updated", limit = 20, offset = 0) =>
        apiFetch<{ repos: RepositoryWithStars[]; hasMore: boolean }>(
          `/api/repositories/public?sortBy=${sortBy}&limit=${limit}&offset=${offset}`
        ),

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

      getBranches: (owner: string, name: string) =>
        apiFetch<{ branches: string[] }>(`/api/repositories/${owner}/${name}/branches`),

      getTree: (owner: string, name: string, branch: string, path = "") =>
        apiFetch<TreeResponse>(
          `/api/repositories/${owner}/${name}/tree?branch=${branch}&path=${encodeURIComponent(path)}`
        ),

      getTreeCommits: (owner: string, name: string, branch: string, path = "") =>
        apiFetch<{ files: FileLastCommit[] }>(
          `/api/repositories/${owner}/${name}/tree-commits?branch=${branch}&path=${encodeURIComponent(path)}`
        ),

      getFile: (owner: string, name: string, branch: string, path: string) =>
        apiFetch<{ content: string; oid: string; path: string }>(
          `/api/repositories/${owner}/${name}/file?branch=${branch}&path=${encodeURIComponent(path)}`
        ),

      getCommits: (owner: string, name: string, branch: string, limit = 30, skip = 0) =>
        apiFetch<{ commits: Commit[]; hasMore: boolean }>(
          `/api/repositories/${owner}/${name}/commits?branch=${branch}&limit=${limit}&skip=${skip}`
        ),

      getCommitCount: (owner: string, name: string, branch: string) =>
        apiFetch<{ count: number }>(`/api/repositories/${owner}/${name}/commits/count?branch=${branch}`),

      getCommitDiff: (owner: string, name: string, oid: string) =>
        apiFetch<CommitDiff>(`/api/repositories/${owner}/${name}/commits/${oid}/diff`),

      getReadme: (owner: string, name: string, oid: string) =>
        apiFetch<{ content: string }>(`/api/repositories/${owner}/${name}/readme?oid=${oid}`),

      getReadmeOid: (owner: string, name: string, branch: string) =>
        apiFetch<{ readmeOid: string | null }>(`/api/repositories/${owner}/${name}/readme-oid?branch=${branch}`),
    },

    users: {
      getProfile: (username: string) => apiFetch<UserProfile>(`/api/users/${username}/profile`),
      getSummary: () => apiFetch<UserSummary>(`/api/users/me/summary`),
      getStarred: (username: string) => apiFetch<{ repos: RepositoryWithStars[] }>(`/api/users/${username}/starred`),
      getAvatarByUsername: (username: string) => apiFetch<{ avatarUrl: string | null }>(`/api/users/${username}/avatar`),
      getPublic: (sortBy: "newest" | "oldest" = "newest", limit = 20, offset = 0) =>
        apiFetch<{ users: PublicUser[]; hasMore: boolean }>(
          `/api/users/public?sortBy=${sortBy}&limit=${limit}&offset=${offset}`
        ),
    },

    settings: {
      getCurrentUser: () => apiFetch<{ user: UserProfile }>("/api/settings"),
      getWordWrap: () => apiFetch<{ wordWrap: boolean }>("/api/settings/word-wrap"),

      updateProfile: (data: {
        name?: string;
        username?: string;
        bio?: string;
        location?: string;
        website?: string;
        pronouns?: string;
        company?: string;
        gitEmail?: string;
        defaultRepositoryVisibility?: "public" | "private";
      }) =>
        apiFetch<{ success: boolean; username: string }>("/api/settings/profile", {
          method: "PATCH",
          body: JSON.stringify(data),
        }),

      updatePreferences: (data: Partial<UserPreferences>) =>
        apiFetch<{ success: boolean }>("/api/settings/preferences", {
          method: "PATCH",
          body: JSON.stringify(data),
        }),

      updateWordWrap: (data: { wordWrap: boolean }) =>
        apiFetch<{ success: boolean; wordWrap: boolean }>("/api/settings/word-wrap", {
          method: "PATCH",
          body: JSON.stringify(data),
        }),

      updateSocialLinks: (data: { github?: string; twitter?: string; linkedin?: string; custom?: string[] }) =>
        apiFetch<{ success: boolean }>("/api/settings/social-links", {
          method: "PATCH",
          body: JSON.stringify(data),
        }),

      updateEmail: (data: { email: string }) =>
        apiFetch<{ success: boolean }>("/api/settings/email", {
          method: "PATCH",
          body: JSON.stringify(data),
        }),

      updatePassword: (data: { currentPassword: string; newPassword: string }) =>
        apiFetch<{ success: boolean }>("/api/settings/password", {
          method: "PATCH",
          body: JSON.stringify(data),
        }),

      deleteAvatar: () =>
        apiFetch<{ success: boolean; avatarUrl: string | null }>("/api/settings/avatar", {
          method: "DELETE",
        }),

      deleteAccount: () =>
        apiFetch<{ success: boolean }>("/api/settings/account", {
          method: "DELETE",
        }),
    },

    issues: {
      list: (owner: string, repo: string, filters?: IssueFilters) => {
        const params = new URLSearchParams();
        if (filters?.state) params.set("state", filters.state);
        if (filters?.label) params.set("label", filters.label);
        if (filters?.assignee) params.set("assignee", filters.assignee);
        if (filters?.limit) params.set("limit", String(filters.limit));
        if (filters?.offset) params.set("offset", String(filters.offset));
        const query = params.toString();
        return apiFetch<{ issues: Issue[]; hasMore: boolean }>(
          `/api/repositories/${owner}/${repo}/issues${query ? `?${query}` : ""}`
        );
      },

      get: (owner: string, repo: string, number: number) => apiFetch<Issue>(`/api/repositories/${owner}/${repo}/issues/${number}`),

      create: (owner: string, repo: string, data: { title: string; body?: string; labels?: string[]; assignees?: string[] }) =>
        apiFetch<Issue>(`/api/repositories/${owner}/${repo}/issues`, {
          method: "POST",
          body: JSON.stringify(data),
        }),

      update: (id: string, data: { title?: string; body?: string; state?: "open" | "closed"; locked?: boolean }) =>
        apiFetch<{ success: boolean }>(`/api/issues/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }),

      delete: (id: string) =>
        apiFetch<{ success: boolean }>(`/api/issues/${id}`, {
          method: "DELETE",
        }),

      getCount: (owner: string, repo: string) =>
        apiFetch<{ open: number; closed: number }>(`/api/repositories/${owner}/${repo}/issues/count`),

      listLabels: (owner: string, repo: string) => apiFetch<{ labels: Label[] }>(`/api/repositories/${owner}/${repo}/labels`),

      createLabel: (owner: string, repo: string, data: { name: string; description?: string; color: string }) =>
        apiFetch<Label>(`/api/repositories/${owner}/${repo}/labels`, {
          method: "POST",
          body: JSON.stringify(data),
        }),

      updateLabel: (id: string, data: { name?: string; description?: string; color?: string }) =>
        apiFetch<Label>(`/api/labels/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }),

      deleteLabel: (id: string) =>
        apiFetch<{ success: boolean }>(`/api/labels/${id}`, {
          method: "DELETE",
        }),

      addLabels: (issueId: string, labels: string[]) =>
        apiFetch<{ success: boolean }>(`/api/issues/${issueId}/labels`, {
          method: "POST",
          body: JSON.stringify({ labels }),
        }),

      removeLabel: (issueId: string, labelId: string) =>
        apiFetch<{ success: boolean }>(`/api/issues/${issueId}/labels/${labelId}`, {
          method: "DELETE",
        }),

      addAssignees: (issueId: string, assignees: string[]) =>
        apiFetch<{ success: boolean }>(`/api/issues/${issueId}/assignees`, {
          method: "POST",
          body: JSON.stringify({ assignees }),
        }),

      removeAssignee: (issueId: string, userId: string) =>
        apiFetch<{ success: boolean }>(`/api/issues/${issueId}/assignees/${userId}`, {
          method: "DELETE",
        }),

      listComments: (issueId: string) => apiFetch<{ comments: IssueComment[] }>(`/api/issues/${issueId}/comments`),

      createComment: (issueId: string, body: string) =>
        apiFetch<IssueComment>(`/api/issues/${issueId}/comments`, {
          method: "POST",
          body: JSON.stringify({ body }),
        }),

      updateComment: (commentId: string, body: string) =>
        apiFetch<{ success: boolean }>(`/api/issues/comments/${commentId}`, {
          method: "PATCH",
          body: JSON.stringify({ body }),
        }),

      deleteComment: (commentId: string) =>
        apiFetch<{ success: boolean }>(`/api/issues/comments/${commentId}`, {
          method: "DELETE",
        }),

      toggleIssueReaction: (issueId: string, emoji: string) =>
        apiFetch<{ added: boolean }>(`/api/issues/${issueId}/reactions`, {
          method: "POST",
          body: JSON.stringify({ emoji }),
        }),

      toggleCommentReaction: (commentId: string, emoji: string) =>
        apiFetch<{ added: boolean }>(`/api/issues/comments/${commentId}/reactions`, {
          method: "POST",
          body: JSON.stringify({ emoji }),
        }),
    },
  };
}
