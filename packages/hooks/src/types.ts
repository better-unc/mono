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

export type RepositoryWithStars = Repository & {
  owner: Owner;
  starCount: number;
};

export type FileEntry = {
  name: string;
  type: "blob" | "tree";
  oid: string;
  path: string;
};

export type RepoInfo = {
  repo: RepositoryWithOwner;
  isOwner: boolean;
};

export type TreeResponse = {
  files: FileEntry[];
  isEmpty: boolean;
  readmeOid?: string | null;
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
    username?: string;
    userId?: string;
    avatarUrl?: string;
  };
  timestamp: number;
};

export type UserPreferences = {
  emailNotifications?: boolean;
  theme?: "light" | "dark" | "system";
  language?: string;
  showEmail?: boolean;
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
  company?: string | null;
  lastActiveAt?: string | null;
  gitEmail?: string | null;
  defaultRepositoryVisibility?: "public" | "private";
  preferences?: UserPreferences | null;
  socialLinks?: {
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

export type ApiClient = {
  repositories: {
    create: (data: { name: string; description?: string; visibility: "public" | "private" }) => Promise<Repository>;
    get: (owner: string, name: string) => Promise<RepositoryWithOwner>;
    getWithStars: (owner: string, name: string) => Promise<RepositoryWithOwner>;
    getInfo: (owner: string, name: string) => Promise<RepoInfo>;
    getPageData: (owner: string, name: string) => Promise<RepoPageData>;
    getUserRepos: (username: string) => Promise<{ repos: RepositoryWithStars[] }>;
    getPublic: (sortBy: "stars" | "updated" | "created", limit: number, offset: number) => Promise<{ repos: RepositoryWithStars[]; hasMore: boolean }>;
    update: (id: string, data: { name?: string; description?: string; visibility?: "public" | "private" }) => Promise<Repository>;
    delete: (id: string) => Promise<{ success: boolean }>;
    toggleStar: (id: string) => Promise<{ starred: boolean }>;
    isStarred: (id: string) => Promise<{ starred: boolean }>;
    getBranches: (owner: string, name: string) => Promise<{ branches: string[] }>;
    getTree: (owner: string, name: string, branch: string, path?: string) => Promise<TreeResponse>;
    getFile: (owner: string, name: string, branch: string, path: string) => Promise<{ content: string; oid: string; path: string }>;
    getCommits: (owner: string, name: string, branch: string, limit?: number, skip?: number) => Promise<{ commits: Commit[]; hasMore: boolean }>;
    getCommitCount: (owner: string, name: string, branch: string) => Promise<{ count: number }>;
    getReadme: (owner: string, name: string, oid: string) => Promise<{ content: string }>;
    getReadmeOid: (owner: string, name: string, branch: string) => Promise<{ readmeOid: string | null }>;
  };
  users: {
    getProfile: (username: string) => Promise<UserProfile>;
    getStarred: (username: string) => Promise<{ repos: RepositoryWithStars[] }>;
    getAvatarByUsername: (username: string) => Promise<{ avatarUrl: string | null }>;
    getPublic: (sortBy: "newest" | "oldest", limit: number, offset: number) => Promise<{ users: PublicUser[]; hasMore: boolean }>;
  };
  settings: {
    getCurrentUser: () => Promise<{ user: UserProfile }>;
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
    }) => Promise<{ success: boolean; username?: string } | UserProfile>;
    updatePreferences: (data: Partial<UserPreferences>) => Promise<{ success: boolean }>;
    updateSocialLinks?: (data: { github?: string; twitter?: string; linkedin?: string; custom?: string[] }) => Promise<{ success: boolean }>;
    updateEmail: (data: { email: string }) => Promise<{ success: boolean } | UserProfile>;
    updatePassword?: (data: { currentPassword: string; newPassword: string }) => Promise<{ success: boolean }>;
    deleteAccount: () => Promise<{ success: boolean }>;
  };
};
