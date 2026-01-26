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
  forkedFromId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ForkedFrom = {
  id: string;
  name: string;
  owner: Owner;
};

export type RepositoryWithOwner = Repository & {
  owner: Owner;
  starCount: number;
  starred: boolean;
  forkedFrom?: ForkedFrom | null;
  forkCount?: number;
};

export type RepositoryWithStars = Repository & {
  owner: Owner;
  starCount: number;
  forkedFrom?: ForkedFrom | null;
  forkCount?: number;
};

export type FileEntry = {
  name: string;
  type: "blob" | "tree";
  oid: string;
  path: string;
};

export type FileLastCommit = {
  path: string;
  commitOid: string;
  message: string;
  authorName: string;
  timestamp: number;
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

export type PRRepoInfo = {
  id: string;
  name: string;
  owner: Owner;
};

export type PRReview = {
  id: string;
  author: Owner;
  body: string | null;
  state: "approved" | "changes_requested" | "commented";
  commitOid: string;
  createdAt: string;
};

export type PullRequest = {
  id: string;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed" | "merged";
  author: Owner;
  headRepo: PRRepoInfo | null;
  headBranch: string;
  headOid: string;
  baseRepo: PRRepoInfo | null;
  baseBranch: string;
  baseOid: string;
  merged: boolean;
  mergedAt: string | null;
  mergedBy: Owner | null;
  mergeCommitOid: string | null;
  labels: Label[];
  assignees: Owner[];
  reviewers: Owner[];
  reviews: PRReview[];
  reactions: ReactionSummary[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  closedBy: Owner | null;
};

export type PRComment = {
  id: string;
  body: string;
  author: Owner;
  reactions: ReactionSummary[];
  createdAt: string;
  updatedAt: string;
};

export type PRFilters = {
  state?: "open" | "closed" | "merged" | "all";
  author?: string;
  assignee?: string;
  reviewer?: string;
  label?: string;
  limit?: number;
  offset?: number;
};

export type PRDiff = {
  files: FileDiff[];
  stats: DiffStats;
};

export type PRCount = {
  open: number;
  closed: number;
  merged: number;
};

export type ApiClient = {
  repositories: {
    create: (data: { name: string; description?: string; visibility: "public" | "private" }) => Promise<Repository>;
    fork: (owner: string, name: string, data?: { name?: string; description?: string }) => Promise<RepoInfo>;
    getForks: (owner: string, name: string, limit?: number, offset?: number) => Promise<{ forks: RepositoryWithOwner[] }>;
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
    getTreeCommits: (owner: string, name: string, branch: string, path?: string) => Promise<{ files: FileLastCommit[] }>;
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
    updateAvatar: (file: File) => Promise<{ success: boolean; avatarUrl: string }>;
    deleteAvatar: () => Promise<{ success: boolean; avatarUrl: string | null }>;
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
  pullRequests: {
    list: (owner: string, repo: string, filters?: PRFilters) => Promise<{ pullRequests: PullRequest[]; hasMore: boolean }>;
    get: (owner: string, repo: string, number: number) => Promise<PullRequest>;
    create: (owner: string, repo: string, data: {
      title: string;
      body?: string;
      headRepoOwner?: string;
      headRepoName?: string;
      headBranch: string;
      baseBranch?: string;
      labels?: string[];
      assignees?: string[];
      reviewers?: string[];
    }) => Promise<PullRequest>;
    update: (id: string, data: { title?: string; body?: string; state?: "open" | "closed" }) => Promise<{ success: boolean }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    getCount: (owner: string, repo: string) => Promise<PRCount>;
    getDiff: (id: string) => Promise<PRDiff>;
    getCommits: (id: string, limit?: number, skip?: number) => Promise<{ commits: Commit[]; hasMore: boolean }>;
    merge: (id: string, data?: { commitMessage?: string }) => Promise<{ success: boolean; mergeCommitOid: string }>;
    listReviews: (id: string) => Promise<{ reviews: PRReview[] }>;
    submitReview: (id: string, data: { body?: string; state: "approved" | "changes_requested" | "commented" }) => Promise<PRReview>;
    listComments: (id: string) => Promise<{ comments: PRComment[] }>;
    createComment: (id: string, body: string) => Promise<PRComment>;
    updateComment: (commentId: string, body: string) => Promise<{ success: boolean }>;
    deleteComment: (commentId: string) => Promise<{ success: boolean }>;
    addLabels: (id: string, labels: string[]) => Promise<{ success: boolean }>;
    removeLabel: (id: string, labelId: string) => Promise<{ success: boolean }>;
    addAssignees: (id: string, assignees: string[]) => Promise<{ success: boolean }>;
    removeAssignee: (id: string, userId: string) => Promise<{ success: boolean }>;
    addReviewers: (id: string, reviewers: string[]) => Promise<{ success: boolean }>;
    removeReviewer: (id: string, userId: string) => Promise<{ success: boolean }>;
    toggleReaction: (id: string, emoji: string) => Promise<{ added: boolean }>;
    toggleCommentReaction: (commentId: string, emoji: string) => Promise<{ added: boolean }>;
  };
};
