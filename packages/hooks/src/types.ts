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

export type DiffHunkLine = {
  type: "context" | "addition" | "deletion";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
};

export type DiffHunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffHunkLine[];
};

export type FileDiff = {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  oldPath?: string;
};

export type DiffStats = {
  additions: number;
  deletions: number;
  filesChanged: number;
};

export type CommitDiff = {
  commit: Commit;
  parent: string | null;
  files: FileDiff[];
  stats: DiffStats;
};

export type UserPreferences = {
  emailNotifications?: boolean;
  theme?: "light" | "dark" | "system";
  language?: string;
  showEmail?: boolean;
  wordWrap?: boolean;
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

export type UserSummary = {
  name: string;
  avatarUrl: string | null;
};

export type Label = {
  id: string;
  name: string;
  description: string | null;
  color: string;
};

export type IssueAuthor = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
};

export type ReactionSummary = {
  emoji: string;
  count: number;
  reacted: boolean;
};

export type Issue = {
  id: string;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  locked: boolean;
  author: IssueAuthor;
  labels: Label[];
  assignees: IssueAuthor[];
  reactions: ReactionSummary[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  closedBy: IssueAuthor | null;
};

export type IssueComment = {
  id: string;
  body: string;
  author: IssueAuthor;
  reactions: ReactionSummary[];
  createdAt: string;
  updatedAt: string;
};

export type IssueFilters = {
  state?: "open" | "closed" | "all";
  label?: string;
  assignee?: string;
  limit?: number;
  offset?: number;
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
    getCommitDiff: (owner: string, name: string, oid: string) => Promise<CommitDiff>;
    getReadme: (owner: string, name: string, oid: string) => Promise<{ content: string }>;
    getReadmeOid: (owner: string, name: string, branch: string) => Promise<{ readmeOid: string | null }>;
  };
  users: {
    getProfile: (username: string) => Promise<UserProfile>;
    getSummary: () => Promise<UserSummary>;
    getStarred: (username: string) => Promise<{ repos: RepositoryWithStars[] }>;
    getAvatarByUsername: (username: string) => Promise<{ avatarUrl: string | null }>;
    getPublic: (sortBy: "newest" | "oldest", limit: number, offset: number) => Promise<{ users: PublicUser[]; hasMore: boolean }>;
  };
  settings: {
    getCurrentUser: () => Promise<{ user: UserProfile }>;
    getWordWrap: () => Promise<{ wordWrap: boolean }>;
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
    updateWordWrap: (data: { wordWrap: boolean }) => Promise<{ success: boolean; wordWrap: boolean }>;
    updateSocialLinks?: (data: { github?: string; twitter?: string; linkedin?: string; custom?: string[] }) => Promise<{ success: boolean }>;
    updateEmail: (data: { email: string }) => Promise<{ success: boolean } | UserProfile>;
    updatePassword?: (data: { currentPassword: string; newPassword: string }) => Promise<{ success: boolean }>;
    deleteAccount: () => Promise<{ success: boolean }>;
  };
  issues: {
    list: (owner: string, repo: string, filters?: IssueFilters) => Promise<{ issues: Issue[]; hasMore: boolean }>;
    get: (owner: string, repo: string, number: number) => Promise<Issue>;
    create: (owner: string, repo: string, data: { title: string; body?: string; labels?: string[]; assignees?: string[] }) => Promise<Issue>;
    update: (id: string, data: { title?: string; body?: string; state?: "open" | "closed"; locked?: boolean }) => Promise<{ success: boolean }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    getCount: (owner: string, repo: string) => Promise<{ open: number; closed: number }>;
    listLabels: (owner: string, repo: string) => Promise<{ labels: Label[] }>;
    createLabel: (owner: string, repo: string, data: { name: string; description?: string; color: string }) => Promise<Label>;
    updateLabel: (id: string, data: { name?: string; description?: string; color?: string }) => Promise<Label>;
    deleteLabel: (id: string) => Promise<{ success: boolean }>;
    addLabels: (issueId: string, labels: string[]) => Promise<{ success: boolean }>;
    removeLabel: (issueId: string, labelId: string) => Promise<{ success: boolean }>;
    addAssignees: (issueId: string, assignees: string[]) => Promise<{ success: boolean }>;
    removeAssignee: (issueId: string, userId: string) => Promise<{ success: boolean }>;
    listComments: (issueId: string) => Promise<{ comments: IssueComment[] }>;
    createComment: (issueId: string, body: string) => Promise<IssueComment>;
    updateComment: (commentId: string, body: string) => Promise<{ success: boolean }>;
    deleteComment: (commentId: string) => Promise<{ success: boolean }>;
    toggleIssueReaction: (issueId: string, emoji: string) => Promise<{ added: boolean }>;
    toggleCommentReaction: (commentId: string, emoji: string) => Promise<{ added: boolean }>;
  };
};
