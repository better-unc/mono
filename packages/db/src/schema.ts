import { pgTable, text, timestamp, boolean, uuid, jsonb, primaryKey, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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

export const repositories = pgTable("repositories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  visibility: text("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("public"),
  defaultBranch: text("default_branch").notNull().default("main"),
  forkedFromId: uuid("forked_from_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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

export const pullRequests = pgTable("pull_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["open", "merged", "closed"] }).notNull().default("open"),
  baseBranch: text("base_branch").notNull(),
  headBranch: text("head_branch").notNull(),
  baseCommitOid: text("base_commit_oid"), // The base branch commit when PR was created, used to detect out-of-sync
  repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  headRepositoryId: uuid("head_repository_id").references(() => repositories.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mergedBy: text("merged_by").references(() => users.id),
  mergedAt: timestamp("merged_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Event types: "commit", "branch_update", "comment", "merged", "closed", "reopened"
export const pullRequestEvents = pgTable("pull_request_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  pullRequestId: uuid("pull_request_id").notNull().references(() => pullRequests.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "commit", "branch_update", "comment", "merged", "closed", "reopened"
  actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
  data: jsonb("data").$type<{
    // For commits
    commits?: Array<{
      oid: string;
      message: string;
      author: { name: string; email: string };
      timestamp: number;
    }>;
    // For branch updates
    mergeCommitOid?: string;
    baseBranch?: string;
    commitCount?: number;
    // For comments
    body?: string;
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  repositories: many(repositories),
  sessions: many(sessions),
  accounts: many(accounts),
  stars: many(stars),
  pullRequests: many(pullRequests),
}));

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  owner: one(users, {
    fields: [repositories.ownerId],
    references: [users.id],
  }),
  forkedFrom: one(repositories, {
    fields: [repositories.forkedFromId],
    references: [repositories.id],
    relationName: "forks",
  }),
  forks: many(repositories, { relationName: "forks" }),
  stars: many(stars),
  pullRequests: many(pullRequests),
}));

export const starsRelations = relations(stars, ({ one }) => ({
  user: one(users, {
    fields: [stars.userId],
    references: [users.id],
  }),
  repository: one(repositories, {
    fields: [stars.repositoryId],
    references: [repositories.id],
  }),
}));

export const pullRequestsRelations = relations(pullRequests, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [pullRequests.repositoryId],
    references: [repositories.id],
    relationName: "pullRequestsBase",
  }),
  headRepository: one(repositories, {
    fields: [pullRequests.headRepositoryId],
    references: [repositories.id],
    relationName: "pullRequestsHead",
  }),
  author: one(users, {
    fields: [pullRequests.authorId],
    references: [users.id],
  }),
  merger: one(users, {
    fields: [pullRequests.mergedBy],
    references: [users.id],
  }),
  events: many(pullRequestEvents),
}));

export const pullRequestEventsRelations = relations(pullRequestEvents, ({ one }) => ({
  pullRequest: one(pullRequests, {
    fields: [pullRequestEvents.pullRequestId],
    references: [pullRequests.id],
  }),
  actor: one(users, {
    fields: [pullRequestEvents.actorId],
    references: [users.id],
  }),
}));
