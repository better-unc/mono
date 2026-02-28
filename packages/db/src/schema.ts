import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  jsonb,
  primaryKey,
  integer,
  index,
  bigint,
  customType,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export type UserPreferences = {
  emailNotifications?: boolean;
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  showEmail?: boolean;
  wordWrap?: boolean;
};

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  username: text('username').notNull().unique(),
  bio: text('bio'),
  location: text('location'),
  website: text('website'),
  pronouns: text('pronouns'),
  avatarUrl: text('avatar_url'),
  company: text('company'),
  lastActiveAt: timestamp('last_active_at'),
  gitEmail: text('git_email'),
  defaultRepositoryVisibility: text('default_repository_visibility', {
    enum: ['public', 'private'],
  })
    .notNull()
    .default('public'),
  preferences: jsonb('preferences').$type<UserPreferences>(),
  socialLinks: jsonb('social_links').$type<{
    github?: string;
    twitter?: string;
    linkedin?: string;
    custom?: string[];
  }>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    forkedFromId: uuid('forked_from_id').references(() => repositories.id, {
      onDelete: 'set null',
    }),
    visibility: text('visibility', { enum: ['public', 'private'] })
      .notNull()
      .default('public'),
    defaultBranch: text('default_branch').notNull().default('main'),
    searchVector: tsvector('search_vector'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('repositories_forked_from_id_idx').on(table.forkedFromId),
    index('repositories_search_idx').using('gin', table.searchVector),
  ],
);

export const repoBranchMetadata = pgTable(
  'repo_branch_metadata',
  {
    repoId: uuid('repo_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    branch: text('branch').notNull(),
    headOid: text('head_oid').notNull(),
    commitCount: bigint('commit_count', { mode: 'number' }).notNull().default(0),
    lastCommitOid: text('last_commit_oid').notNull(),
    lastCommitMessage: text('last_commit_message').notNull(),
    lastCommitAuthorName: text('last_commit_author_name').notNull(),
    lastCommitAuthorEmail: text('last_commit_author_email').notNull(),
    lastCommitTimestamp: timestamp('last_commit_timestamp').notNull(),
    readmeOid: text('readme_oid'),
    rootTree:
      jsonb('root_tree').$type<Array<{ name: string; type: string; oid: string; path: string }>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.repoId, table.branch] }),
    index('repo_branch_metadata_repo_id_idx').on(table.repoId),
  ],
);

export const branchProtectionRules = pgTable(
  'branch_protection_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    branchName: text('branch_name').notNull(),
    preventDirectPush: boolean('prevent_direct_push').notNull().default(false),
    preventForcePush: boolean('prevent_force_push').notNull().default(false),
    preventDeletion: boolean('prevent_deletion').notNull().default(false),
    requireReviews: boolean('require_reviews').notNull().default(false),
    requiredReviewCount: integer('required_review_count').notNull().default(1),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('branch_protection_rules_repo_id_idx').on(table.repositoryId),
    uniqueIndex('branch_protection_rules_repo_branch_unique').on(table.repositoryId, table.branchName),
    check('branch_protection_rules_required_review_count_check', sql`${table.requiredReviewCount} >= 1`),
  ],
);

export const stars = pgTable(
  'stars',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.repositoryId] })],
);

export const issues = pgTable(
  'issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: integer('number').notNull(),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body'),
    state: text('state', { enum: ['open', 'closed'] })
      .notNull()
      .default('open'),
    locked: boolean('locked').notNull().default(false),
    closedAt: timestamp('closed_at'),
    closedById: text('closed_by_id').references(() => users.id),
    searchVector: tsvector('search_vector'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('issues_repository_id_idx').on(table.repositoryId),
    index('issues_repository_number_idx').on(table.repositoryId, table.number),
    index('issues_search_idx').using('gin', table.searchVector),
  ],
);

export const labels = pgTable(
  'labels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color').notNull().default('6b7280'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('labels_repository_id_idx').on(table.repositoryId)],
);

export const issueLabels = pgTable(
  'issue_labels',
  {
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.issueId, table.labelId] })],
);

export const issueAssignees = pgTable(
  'issue_assignees',
  {
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.issueId, table.userId] })],
);

export const issueComments = pgTable(
  'issue_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('issue_comments_issue_id_idx').on(table.issueId)],
);

export const issueReactions = pgTable(
  'issue_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => issueComments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('issue_reactions_issue_id_idx').on(table.issueId),
    index('issue_reactions_comment_id_idx').on(table.commentId),
  ],
);

export const apiKeys = pgTable('api_key', {
  id: text('id').primaryKey(),
  name: text('name'),
  start: text('start'),
  prefix: text('prefix'),
  key: text('key').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  refillInterval: integer('refill_interval'),
  refillAmount: integer('refill_amount'),
  lastRefillAt: timestamp('last_refill_at'),
  enabled: boolean('enabled').notNull().default(true),
  rateLimitEnabled: boolean('rate_limit_enabled').notNull().default(false),
  rateLimitTimeWindow: integer('rate_limit_time_window'),
  rateLimitMax: integer('rate_limit_max'),
  requestCount: integer('request_count').notNull().default(0),
  remaining: integer('remaining'),
  lastRequest: timestamp('last_request'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  permissions: text('permissions'),
  metadata: jsonb('metadata'),
});

export const pullRequests = pgTable(
  'pull_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: integer('number').notNull(),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body'),
    state: text('state', { enum: ['open', 'closed', 'merged'] })
      .notNull()
      .default('open'),
    isDraft: boolean('is_draft').notNull().default(false),
    headRepoId: uuid('head_repo_id')
      .notNull()
      .references(() => repositories.id),
    headBranch: text('head_branch').notNull(),
    headOid: text('head_oid').notNull(),
    baseRepoId: uuid('base_repo_id')
      .notNull()
      .references(() => repositories.id),
    baseBranch: text('base_branch').notNull(),
    baseOid: text('base_oid').notNull(),
    merged: boolean('merged').notNull().default(false),
    mergedAt: timestamp('merged_at'),
    mergedById: text('merged_by_id').references(() => users.id),
    mergeCommitOid: text('merge_commit_oid'),
    closedAt: timestamp('closed_at'),
    closedById: text('closed_by_id').references(() => users.id),
    searchVector: tsvector('search_vector'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('pull_requests_repository_id_idx').on(table.repositoryId),
    index('pull_requests_repository_number_idx').on(table.repositoryId, table.number),
    index('pull_requests_head_repo_id_idx').on(table.headRepoId),
    index('pull_requests_base_repo_id_idx').on(table.baseRepoId),
    index('pull_requests_search_idx').using('gin', table.searchVector),
  ],
);

export const prReviews = pgTable(
  'pr_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pullRequestId: uuid('pull_request_id')
      .notNull()
      .references(() => pullRequests.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body'),
    state: text('state', { enum: ['approved', 'changes_requested', 'commented'] }).notNull(),
    commitOid: text('commit_oid').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('pr_reviews_pull_request_id_idx').on(table.pullRequestId)],
);

export const prComments = pgTable(
  'pr_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pullRequestId: uuid('pull_request_id')
      .notNull()
      .references(() => pullRequests.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    filePath: text('file_path'),
    side: text('side', { enum: ['left', 'right'] }),
    lineNumber: integer('line_number'),
    commitOid: text('commit_oid'),
    replyToId: uuid('reply_to_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('pr_comments_pull_request_id_idx').on(table.pullRequestId),
    index('pr_comments_file_path_idx').on(table.pullRequestId, table.filePath),
  ],
);

export const prLabels = pgTable(
  'pr_labels',
  {
    pullRequestId: uuid('pull_request_id')
      .notNull()
      .references(() => pullRequests.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.pullRequestId, table.labelId] })],
);

export const prAssignees = pgTable(
  'pr_assignees',
  {
    pullRequestId: uuid('pull_request_id')
      .notNull()
      .references(() => pullRequests.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.pullRequestId, table.userId] })],
);

export const prReviewers = pgTable(
  'pr_reviewers',
  {
    pullRequestId: uuid('pull_request_id')
      .notNull()
      .references(() => pullRequests.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    requestedAt: timestamp('requested_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.pullRequestId, table.userId] })],
);

export const prReactions = pgTable(
  'pr_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pullRequestId: uuid('pull_request_id').references(() => pullRequests.id, {
      onDelete: 'cascade',
    }),
    commentId: uuid('comment_id').references(() => prComments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('pr_reactions_pull_request_id_idx').on(table.pullRequestId),
    index('pr_reactions_comment_id_idx').on(table.commentId),
  ],
);

export const discussionCategories = pgTable(
  'discussion_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    emoji: text('emoji'),
    description: text('description'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('discussion_categories_repo_id_idx').on(table.repositoryId)],
);

export const discussions = pgTable(
  'discussions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: integer('number').notNull(),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => discussionCategories.id, {
      onDelete: 'set null',
    }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    isPinned: boolean('is_pinned').notNull().default(false),
    isLocked: boolean('is_locked').notNull().default(false),
    isAnswered: boolean('is_answered').notNull().default(false),
    answerId: uuid('answer_id'),
    searchVector: tsvector('search_vector'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('discussions_repo_id_idx').on(table.repositoryId),
    index('discussions_repo_number_idx').on(table.repositoryId, table.number),
    index('discussions_search_idx').using('gin', table.searchVector),
  ],
);

export const discussionComments = pgTable(
  'discussion_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    discussionId: uuid('discussion_id')
      .notNull()
      .references(() => discussions.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    body: text('body').notNull(),
    isAnswer: boolean('is_answer').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('discussion_comments_discussion_id_idx').on(table.discussionId),
    index('discussion_comments_parent_id_idx').on(table.parentId),
  ],
);

export const discussionReactions = pgTable(
  'discussion_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    discussionId: uuid('discussion_id').references(() => discussions.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => discussionComments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('discussion_reactions_discussion_id_idx').on(table.discussionId),
    index('discussion_reactions_comment_id_idx').on(table.commentId),
  ],
);

export const discussionCategoryRelations = relations(discussionCategories, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [discussionCategories.repositoryId],
    references: [repositories.id],
  }),
  discussions: many(discussions),
}));

export const discussionRelations = relations(discussions, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [discussions.repositoryId],
    references: [repositories.id],
  }),
  category: one(discussionCategories, {
    fields: [discussions.categoryId],
    references: [discussionCategories.id],
  }),
  author: one(users, {
    fields: [discussions.authorId],
    references: [users.id],
  }),
  comments: many(discussionComments),
  reactions: many(discussionReactions),
}));

export const discussionCommentRelations = relations(discussionComments, ({ one, many }) => ({
  discussion: one(discussions, {
    fields: [discussionComments.discussionId],
    references: [discussions.id],
  }),
  author: one(users, {
    fields: [discussionComments.authorId],
    references: [users.id],
  }),
  parent: one(discussionComments, {
    fields: [discussionComments.parentId],
    references: [discussionComments.id],
    relationName: 'parentChild',
  }),
  replies: many(discussionComments, { relationName: 'parentChild' }),
  reactions: many(discussionReactions),
}));

export const discussionReactionRelations = relations(discussionReactions, ({ one }) => ({
  discussion: one(discussions, {
    fields: [discussionReactions.discussionId],
    references: [discussions.id],
  }),
  comment: one(discussionComments, {
    fields: [discussionReactions.commentId],
    references: [discussionComments.id],
  }),
  user: one(users, {
    fields: [discussionReactions.userId],
    references: [users.id],
  }),
}));

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('projects_repo_id_idx').on(table.repositoryId)],
);

export const projectColumns = pgTable(
  'project_columns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('project_columns_project_id_idx').on(table.projectId)],
);

export const projectItems = pgTable(
  'project_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    columnId: uuid('column_id')
      .notNull()
      .references(() => projectColumns.id, { onDelete: 'cascade' }),
    issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'cascade' }),
    pullRequestId: uuid('pull_request_id').references(() => pullRequests.id, {
      onDelete: 'cascade',
    }),
    noteContent: text('note_content'),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('project_items_column_id_idx').on(table.columnId),
    index('project_items_project_id_idx').on(table.projectId),
  ],
);

export const projectRelations = relations(projects, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [projects.repositoryId],
    references: [repositories.id],
  }),
  columns: many(projectColumns),
  items: many(projectItems),
}));

export const projectColumnRelations = relations(projectColumns, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectColumns.projectId],
    references: [projects.id],
  }),
  items: many(projectItems),
}));

export const projectItemRelations = relations(projectItems, ({ one }) => ({
  project: one(projects, {
    fields: [projectItems.projectId],
    references: [projects.id],
  }),
  column: one(projectColumns, {
    fields: [projectItems.columnId],
    references: [projectColumns.id],
  }),
  issue: one(issues, {
    fields: [projectItems.issueId],
    references: [issues.id],
  }),
  pullRequest: one(pullRequests, {
    fields: [projectItems.pullRequestId],
    references: [pullRequests.id],
  }),
}));

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    resourceType: text('resource_type'),
    resourceId: uuid('resource_id'),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    repoOwner: text('repo_owner'),
    repoName: text('repo_name'),
    resourceNumber: integer('resource_number'),
    read: boolean('read').notNull().default(false),
    emailSent: boolean('email_sent').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_user_read_idx').on(table.userId, table.read),
  ],
);

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
  }),
}));

export const passkeys = pgTable(
  'passkey',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    publicKey: text('public_key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialID: text('credential_id').notNull(),
    counter: integer('counter').notNull(),
    deviceType: text('device_type').notNull(),
    backedUp: boolean('backed_up').notNull(),
    transports: text('transports'),
    createdAt: timestamp('created_at'),
    aaguid: text('aaguid'),
  },
  (table) => [
    index('passkey_userId_idx').on(table.userId),
    index('passkey_credentialID_idx').on(table.credentialID),
  ],
);

export const jwks = pgTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: timestamp('created_at').notNull(),
  expiresAt: timestamp('expires_at'),
});

export const oauthClients = pgTable('oauth_client', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret'),
  disabled: boolean('disabled').default(false),
  skipConsent: boolean('skip_consent'),
  enableEndSession: boolean('enable_end_session'),
  scopes: text('scopes').array(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
  name: text('name'),
  uri: text('uri'),
  icon: text('icon'),
  contacts: text('contacts').array(),
  tos: text('tos'),
  policy: text('policy'),
  softwareId: text('software_id'),
  softwareVersion: text('software_version'),
  softwareStatement: text('software_statement'),
  redirectUris: text('redirect_uris').array().notNull(),
  postLogoutRedirectUris: text('post_logout_redirect_uris').array(),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method'),
  grantTypes: text('grant_types').array(),
  responseTypes: text('response_types').array(),
  public: boolean('public'),
  type: text('type'),
  referenceId: text('reference_id'),
  metadata: jsonb('metadata'),
});

export const oauthRefreshTokens = pgTable('oauth_refresh_token', {
  id: text('id').primaryKey(),
  token: text('token').notNull(),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  referenceId: text('reference_id'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at'),
  revoked: timestamp('revoked'),
  scopes: text('scopes').array().notNull(),
});

export const oauthAccessTokens = pgTable('oauth_access_token', {
  id: text('id').primaryKey(),
  token: text('token').unique(),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  referenceId: text('reference_id'),
  refreshId: text('refresh_id').references(() => oauthRefreshTokens.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at'),
  scopes: text('scopes').array().notNull(),
});

export const oauthConsents = pgTable('oauth_consent', {
  id: text('id').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  referenceId: text('reference_id'),
  scopes: text('scopes').array().notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export const passkeyRelations = relations(passkeys, ({ one }) => ({
  user: one(users, {
    fields: [passkeys.userId],
    references: [users.id],
  }),
}));

export const oauthClientRelations = relations(oauthClients, ({ one, many }) => ({
  user: one(users, {
    fields: [oauthClients.userId],
    references: [users.id],
  }),
  oauthRefreshTokens: many(oauthRefreshTokens),
  oauthAccessTokens: many(oauthAccessTokens),
  oauthConsents: many(oauthConsents),
}));

export const oauthRefreshTokenRelations = relations(oauthRefreshTokens, ({ one, many }) => ({
  oauthClient: one(oauthClients, {
    fields: [oauthRefreshTokens.clientId],
    references: [oauthClients.clientId],
  }),
  session: one(sessions, {
    fields: [oauthRefreshTokens.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [oauthRefreshTokens.userId],
    references: [users.id],
  }),
  oauthAccessTokens: many(oauthAccessTokens),
}));

export const oauthAccessTokenRelations = relations(oauthAccessTokens, ({ one }) => ({
  oauthClient: one(oauthClients, {
    fields: [oauthAccessTokens.clientId],
    references: [oauthClients.clientId],
  }),
  session: one(sessions, {
    fields: [oauthAccessTokens.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [oauthAccessTokens.userId],
    references: [users.id],
  }),
  oauthRefreshToken: one(oauthRefreshTokens, {
    fields: [oauthAccessTokens.refreshId],
    references: [oauthRefreshTokens.id],
  }),
}));

export const oauthConsentRelations = relations(oauthConsents, ({ one }) => ({
  oauthClient: one(oauthClients, {
    fields: [oauthConsents.clientId],
    references: [oauthClients.clientId],
  }),
  user: one(users, {
    fields: [oauthConsents.userId],
    references: [users.id],
  }),
}));

export const userRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  apikeys: many(apiKeys),
  passkeys: many(passkeys),
  oauthClients: many(oauthClients),
  oauthRefreshTokens: many(oauthRefreshTokens),
  oauthAccessTokens: many(oauthAccessTokens),
  oauthConsents: many(oauthConsents),
}));

export const sessionRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  oauthRefreshTokens: many(oauthRefreshTokens),
  oauthAccessTokens: many(oauthAccessTokens),
}));

export const accountRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const apiKeyRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const repoBranchMetadataRelations = relations(repoBranchMetadata, ({ one }) => ({
  repo: one(repositories, {
    fields: [repoBranchMetadata.repoId],
    references: [repositories.id],
  }),
}));

export const branchProtectionRuleRelations = relations(branchProtectionRules, ({ one }) => ({
  repository: one(repositories, {
    fields: [branchProtectionRules.repositoryId],
    references: [repositories.id],
  }),
}));

export const issueRelations = relations(issues, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [issues.repositoryId],
    references: [repositories.id],
  }),
  author: one(users, {
    fields: [issues.authorId],
    references: [users.id],
  }),
  closedBy: one(users, {
    fields: [issues.closedById],
    references: [users.id],
  }),
  labels: many(issueLabels),
  assignees: many(issueAssignees),
  comments: many(issueComments),
  reactions: many(issueReactions),
}));

export const labelRelations = relations(labels, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [labels.repositoryId],
    references: [repositories.id],
  }),
  issues: many(issueLabels),
  pullRequests: many(prLabels),
}));

export const issueLabelRelations = relations(issueLabels, ({ one }) => ({
  issue: one(issues, {
    fields: [issueLabels.issueId],
    references: [issues.id],
  }),
  label: one(labels, {
    fields: [issueLabels.labelId],
    references: [labels.id],
  }),
}));

export const issueAssigneeRelations = relations(issueAssignees, ({ one }) => ({
  issue: one(issues, {
    fields: [issueAssignees.issueId],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [issueAssignees.userId],
    references: [users.id],
  }),
}));

export const issueCommentRelations = relations(issueComments, ({ one, many }) => ({
  issue: one(issues, {
    fields: [issueComments.issueId],
    references: [issues.id],
  }),
  author: one(users, {
    fields: [issueComments.authorId],
    references: [users.id],
  }),
  reactions: many(issueReactions),
}));

export const issueReactionRelations = relations(issueReactions, ({ one }) => ({
  issue: one(issues, {
    fields: [issueReactions.issueId],
    references: [issues.id],
  }),
  comment: one(issueComments, {
    fields: [issueReactions.commentId],
    references: [issueComments.id],
  }),
  user: one(users, {
    fields: [issueReactions.userId],
    references: [users.id],
  }),
}));

export const pullRequestRelations = relations(pullRequests, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [pullRequests.repositoryId],
    references: [repositories.id],
    relationName: 'pullRequestRepository',
  }),
  author: one(users, {
    fields: [pullRequests.authorId],
    references: [users.id],
    relationName: 'pullRequestAuthor',
  }),
  headRepo: one(repositories, {
    fields: [pullRequests.headRepoId],
    references: [repositories.id],
    relationName: 'pullRequestHeadRepo',
  }),
  baseRepo: one(repositories, {
    fields: [pullRequests.baseRepoId],
    references: [repositories.id],
    relationName: 'pullRequestBaseRepo',
  }),
  mergedBy: one(users, {
    fields: [pullRequests.mergedById],
    references: [users.id],
    relationName: 'pullRequestMergedBy',
  }),
  closedBy: one(users, {
    fields: [pullRequests.closedById],
    references: [users.id],
    relationName: 'pullRequestClosedBy',
  }),
  labels: many(prLabels),
  assignees: many(prAssignees),
  reviewers: many(prReviewers),
  reviews: many(prReviews),
  comments: many(prComments),
  reactions: many(prReactions),
}));

export const prReviewRelations = relations(prReviews, ({ one }) => ({
  pullRequest: one(pullRequests, {
    fields: [prReviews.pullRequestId],
    references: [pullRequests.id],
  }),
  author: one(users, {
    fields: [prReviews.authorId],
    references: [users.id],
  }),
}));

export const prCommentRelations = relations(prComments, ({ one, many }) => ({
  pullRequest: one(pullRequests, {
    fields: [prComments.pullRequestId],
    references: [pullRequests.id],
  }),
  author: one(users, {
    fields: [prComments.authorId],
    references: [users.id],
  }),
  reactions: many(prReactions),
}));

export const prLabelRelations = relations(prLabels, ({ one }) => ({
  pullRequest: one(pullRequests, {
    fields: [prLabels.pullRequestId],
    references: [pullRequests.id],
  }),
  label: one(labels, {
    fields: [prLabels.labelId],
    references: [labels.id],
  }),
}));

export const prAssigneeRelations = relations(prAssignees, ({ one }) => ({
  pullRequest: one(pullRequests, {
    fields: [prAssignees.pullRequestId],
    references: [pullRequests.id],
  }),
  user: one(users, {
    fields: [prAssignees.userId],
    references: [users.id],
  }),
}));

export const prReviewerRelations = relations(prReviewers, ({ one }) => ({
  pullRequest: one(pullRequests, {
    fields: [prReviewers.pullRequestId],
    references: [pullRequests.id],
  }),
  user: one(users, {
    fields: [prReviewers.userId],
    references: [users.id],
  }),
}));

export const prReactionRelations = relations(prReactions, ({ one }) => ({
  pullRequest: one(pullRequests, {
    fields: [prReactions.pullRequestId],
    references: [pullRequests.id],
  }),
  comment: one(prComments, {
    fields: [prReactions.commentId],
    references: [prComments.id],
  }),
  user: one(users, {
    fields: [prReactions.userId],
    references: [users.id],
  }),
}));
