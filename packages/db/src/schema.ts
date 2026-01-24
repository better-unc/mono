import { pgTable, text, timestamp, boolean, uuid, jsonb, primaryKey, integer, index, bigint } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export type UserPreferences = {
  emailNotifications?: boolean;
  theme?: "light" | "dark" | "system";
  language?: string;
  showEmail?: boolean;
  wordWrap?: boolean;
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  username: text("username").notNull().unique(),
  bio: text("bio"),
  location: text("location"),
  website: text("website"),
  pronouns: text("pronouns"),
  avatarUrl: text("avatar_url"),
  company: text("company"),
  lastActiveAt: timestamp("last_active_at"),
  gitEmail: text("git_email"),
  defaultRepositoryVisibility: text("default_repository_visibility", { enum: ["public", "private"] })
    .notNull()
    .default("public"),
  preferences: jsonb("preferences").$type<UserPreferences>(),
  socialLinks: jsonb("social_links").$type<{
    github?: string;
    twitter?: string;
    linkedin?: string;
    custom?: string[];
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    forkedFromId: uuid("forked_from_id").references(() => repositories.id, { onDelete: "set null" }),
    visibility: text("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("public"),
    defaultBranch: text("default_branch").notNull().default("main"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("repositories_forked_from_id_idx").on(table.forkedFromId)]
);

export const repoBranchMetadata = pgTable(
  "repo_branch_metadata",
  {
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    branch: text("branch").notNull(),
    headOid: text("head_oid").notNull(),
    commitCount: bigint("commit_count", { mode: "number" }).notNull().default(0),
    lastCommitOid: text("last_commit_oid").notNull(),
    lastCommitMessage: text("last_commit_message").notNull(),
    lastCommitAuthorName: text("last_commit_author_name").notNull(),
    lastCommitAuthorEmail: text("last_commit_author_email").notNull(),
    lastCommitTimestamp: timestamp("last_commit_timestamp").notNull(),
    readmeOid: text("readme_oid"),
    rootTree: jsonb("root_tree").$type<Array<{ name: string; type: string; oid: string; path: string }>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.repoId, table.branch] }),
    index("repo_branch_metadata_repo_id_idx").on(table.repoId),
  ]
);

export const stars = pgTable(
  "stars",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.repositoryId] })]
);

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: integer("number").notNull(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    state: text("state", { enum: ["open", "closed"] }).notNull().default("open"),
    locked: boolean("locked").notNull().default(false),
    closedAt: timestamp("closed_at"),
    closedById: text("closed_by_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("issues_repository_id_idx").on(table.repositoryId),
    index("issues_repository_number_idx").on(table.repositoryId, table.number),
  ]
);

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color").notNull().default("6b7280"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("labels_repository_id_idx").on(table.repositoryId)]
);

export const issueLabels = pgTable(
  "issue_labels",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.issueId, table.labelId] })]
);

export const issueAssignees = pgTable(
  "issue_assignees",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.issueId, table.userId] })]
);

export const issueComments = pgTable(
  "issue_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("issue_comments_issue_id_idx").on(table.issueId)]
);

export const issueReactions = pgTable(
  "issue_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => issueComments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("issue_reactions_issue_id_idx").on(table.issueId),
    index("issue_reactions_comment_id_idx").on(table.commentId),
  ]
);

export const apiKeys = pgTable("api_key", {
  id: text("id").primaryKey(),
  name: text("name"),
  start: text("start"),
  prefix: text("prefix"),
  key: text("key").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  refillInterval: integer("refill_interval"),
  refillAmount: integer("refill_amount"),
  lastRefillAt: timestamp("last_refill_at"),
  enabled: boolean("enabled").notNull().default(true),
  rateLimitEnabled: boolean("rate_limit_enabled").notNull().default(false),
  rateLimitTimeWindow: integer("rate_limit_time_window"),
  rateLimitMax: integer("rate_limit_max"),
  requestCount: integer("request_count").notNull().default(0),
  remaining: integer("remaining"),
  lastRequest: timestamp("last_request"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  permissions: text("permissions"),
  metadata: jsonb("metadata"),
});

export const passkeys = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at"),
    aaguid: text("aaguid"),
  },
  (table) => [index("passkey_userId_idx").on(table.userId), index("passkey_credentialID_idx").on(table.credentialID)]
);

export const passkeyRelations = relations(passkeys, ({ one }) => ({
  user: one(users, {
    fields: [passkeys.userId],
    references: [users.id],
  }),
}));

export const userRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  apikeys: many(apiKeys),
  passkeys: many(passkeys),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
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
