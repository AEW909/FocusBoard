import { boolean, date, integer, jsonb, numeric, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

const neonAuthSchema = pgSchema("neon_auth");
const focusboardSchema = pgSchema("focusboard");

// ── neon_auth tables (Better Auth) ───────────────────────────────────────────

export const neonAuthUser = neonAuthSchema.table("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
  role: text("role"),
  banned: boolean("banned"),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires", { withTimezone: true }),
});

export const neonAuthSession = neonAuthSchema.table("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: uuid("userId").notNull().references(() => neonAuthUser.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonatedBy"),
  activeOrganizationId: text("activeOrganizationId"),
});

export const neonAuthAccount = neonAuthSchema.table("account", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: uuid("userId").notNull().references(() => neonAuthUser.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  issuer: text("issuer"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
});

export const neonAuthVerification = neonAuthSchema.table("verification", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
});

// ── focusboard tables ─────────────────────────────────────────────────────────

export const clients = focusboardSchema.table("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientKey: text("client_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("active"),
  contentLabEnabled: boolean("content_lab_enabled").notNull().default(false),
  businessStatsEnabled: boolean("business_stats_enabled").notNull().default(false),
  createdBy: uuid("created_by").references(() => neonAuthUser.id, { onDelete: "set null" }),
  updatedBy: uuid("updated_by").references(() => neonAuthUser.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformUsers = focusboardSchema.table("platform_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => neonAuthUser.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("platform_owner"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientMemberships = focusboardSchema.table("client_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => neonAuthUser.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  contentLabAccess: boolean("content_lab_access").notNull().default(false),
  createdBy: uuid("created_by").references(() => neonAuthUser.id, { onDelete: "set null" }),
  updatedBy: uuid("updated_by").references(() => neonAuthUser.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const focusBoardSettings = focusboardSchema.table("focus_board_settings", {
  boardKey: text("board_key").primaryKey(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  boardSlug: text("board_slug").notNull().unique(),
  adminSlug: text("admin_slug").notNull().unique(),
  themePreset: text("theme_preset").notNull().default("default"),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  weeklyTarget: integer("weekly_target").notNull().default(5),
  weeklyRewardLabel: text("weekly_reward_label").notNull().default(""),
  weeklyRewardDescription: text("weekly_reward_description").notNull().default(""),
  weeklyRewardLockedDescription: text("weekly_reward_locked_description").notNull().default(""),
  weeklyRewardUnlockedDescription: text("weekly_reward_unlocked_description").notNull().default(""),
  weeklyRewardLockedStickerSrc: text("weekly_reward_locked_sticker_src").notNull().default(""),
  weeklyRewardUnlockedStickerSrc: text("weekly_reward_unlocked_sticker_src").notNull().default(""),
  weeklyRewardStickerAlt: text("weekly_reward_sticker_alt").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const focusBoardSections = focusboardSchema.table("focus_board_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  boardKey: text("board_key").notNull().references(() => focusBoardSettings.boardKey, { onDelete: "cascade" }),
  sectionKey: text("section_key").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const focusBoardTasks = focusboardSchema.table("focus_board_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  sectionId: uuid("section_id").notNull().references(() => focusBoardSections.id, { onDelete: "restrict" }),
  boardKey: text("board_key").notNull().references(() => focusBoardSettings.boardKey, { onDelete: "cascade" }),
  taskKey: text("task_key").notNull(),
  icon: text("icon").notNull(),
  stickerSrc: text("sticker_src").notNull(),
  stickerAlt: text("sticker_alt").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  accentClass: text("accent_class").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isVisible: boolean("is_visible").notNull().default(true),
  isBoosted: boolean("is_boosted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const focusBoardTaskMetrics = focusboardSchema.table("focus_board_task_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => focusBoardTasks.id, { onDelete: "cascade" }),
  metricKey: text("metric_key").notNull(),
  label: text("label").notNull(),
  target: integer("target").notNull().default(1),
  points: integer("points").notNull().default(1),
  kind: text("kind").notNull().default("count"),
  checkboxOptions: jsonb("checkbox_options").notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const focusBoardRewardTiers = focusboardSchema.table("focus_board_reward_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  boardKey: text("board_key").notNull().references(() => focusBoardSettings.boardKey, { onDelete: "cascade" }),
  label: text("label").notNull(),
  minPoints: integer("min_points").notNull().default(0),
  minWeeksHit: integer("min_weeks_hit").notNull().default(0),
  lockedStickerSrc: text("locked_sticker_src").notNull(),
  unlockedStickerSrc: text("unlocked_sticker_src").notNull(),
  stickerAlt: text("sticker_alt").notNull(),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const focusBoardWeeklyRoundups = focusboardSchema.table("focus_board_weekly_roundups", {
  id: uuid("id").primaryKey().defaultRandom(),
  boardKey: text("board_key").notNull().references(() => focusBoardSettings.boardKey, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => neonAuthUser.id, { onDelete: "cascade" }),
  weekStart: date("week_start").notNull(),
  seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const focusBoardEvents = focusboardSchema.table("focus_board_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  boardKey: text("board_key").notNull(),
  monthKey: text("month_key").notNull(),
  weekStart: text("week_start").notNull(),
  taskKey: text("task_key").notNull(),
  metricKey: text("metric_key").notNull(),
  points: integer("points").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientContentProfiles = focusboardSchema.table("client_content_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().unique().references(() => clients.id, { onDelete: "cascade" }),
  businessName: text("business_name").notNull(),
  brandVoice: text("brand_voice"),
  targetAudience: text("target_audience"),
  services: text("services"),
  differentiators: text("differentiators"),
  contentRules: text("content_rules"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessStatGroups = focusboardSchema.table("business_stat_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#00f5d4"),
  sortOrder: integer("sort_order").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessStatCategories = focusboardSchema.table("business_stat_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => businessStatGroups.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("number"),
  prefix: text("prefix").notNull().default(""),
  suffix: text("suffix").notNull().default(""),
  color: text("color").notNull().default("#ff4dca"),
  weeklyTarget: numeric("weekly_target"),
  monthlyTarget: numeric("monthly_target"),
  sortOrder: integer("sort_order").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessStatEntries = focusboardSchema.table("business_stat_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => businessStatCategories.id, { onDelete: "cascade" }),
  weekStart: date("week_start").notNull(),
  value: numeric("value").notNull().default("0"),
  createdBy: uuid("created_by").references(() => neonAuthUser.id, { onDelete: "set null" }),
  updatedBy: uuid("updated_by").references(() => neonAuthUser.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
