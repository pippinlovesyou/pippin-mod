import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import * as z from 'zod';

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Discord user ID
  username: text("username").notNull(),
  totalPoints: integer("total_points").default(0).notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  isMuted: boolean("is_muted").default(false).notNull(),
  muteExpiresAt: timestamp("mute_expires_at"),
});

export const admin_users = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const discordSettings = pgTable("discord_settings", {
  id: serial("id").primaryKey(),
  botToken: text("bot_token").notNull(),
  guildId: text("guild_id").notNull(),
  status: text("status").notNull().default("disconnected"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const warningLevels = pgTable("warning_levels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull(),
  points: integer("points").notNull(),
  deleteMessage: boolean("delete_message").default(false).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  warningLevelId: integer("warning_level_id").references(() => warningLevels.id).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const warnings = pgTable("warnings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  levelId: integer("level_id").references(() => warningLevels.id).notNull(),
  points: integer("points").notNull(),
  ruleTriggered: text("rule_triggered").notNull(),
  messageContent: text("message_content").notNull(),
  messageContext: jsonb("message_context").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  messageDeleted: boolean("message_deleted").default(false).notNull(),
  messageIgnored: boolean("message_ignored").default(false).notNull(),
  ignoredAt: timestamp("ignored_at"),
  ignoredBy: text("ignored_by").references(() => users.id),
  ignoreReason: text("ignore_reason"),
});

export const punishments = pgTable("punishments", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // mute, ban
  reason: text("reason").notNull(),
  duration: integer("duration"), // in minutes, null for permanent
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const openaiSettings = pgTable("openai_settings", {
  id: serial("id").primaryKey(),
  apiKey: text("api_key").notNull(),
  status: text("status").notNull().default("disconnected"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiPromptTemplates = pgTable("ai_prompt_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiPromptHistory = pgTable("ai_prompt_history", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => aiPromptTemplates.id).notNull(),
  systemPrompt: text("system_prompt").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const punishmentRules = pgTable("punishment_rules", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "ban" or "mute"
  pointThreshold: integer("point_threshold").notNull(),
  duration: integer("duration"), // in minutes, null for permanent (used for mutes)
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const warningsRelations = relations(warnings, ({ one }) => ({
  user: one(users, {
    fields: [warnings.userId],
    references: [users.id],
  }),
  level: one(warningLevels, {
    fields: [warnings.levelId],
    references: [warningLevels.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  warnings: many(warnings),
  punishments: many(punishments),
}));

export const warningLevelsRelations = relations(warningLevels, ({ many }) => ({
  warnings: many(warnings),
  rules: many(rules),
}));

export const rulesRelations = relations(rules, ({ one }) => ({
  level: one(warningLevels, {
    fields: [rules.warningLevelId],
    references: [warningLevels.id],
  }),
}));

export const punishmentsRelations = relations(punishments, ({ one }) => ({
  user: one(users, {
    fields: [punishments.userId],
    references: [users.id],
  }),
}));

export const aiPromptTemplatesRelations = relations(aiPromptTemplates, ({ many }) => ({
  history: many(aiPromptHistory),
}));

export const aiPromptHistoryRelations = relations(aiPromptHistory, ({ one }) => ({
  template: one(aiPromptTemplates, {
    fields: [aiPromptHistory.templateId],
    references: [aiPromptTemplates.id],
  }),
}));


export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertWarningLevelSchema = createInsertSchema(warningLevels);
export const selectWarningLevelSchema = createSelectSchema(warningLevels);
export const insertWarningSchema = createInsertSchema(warnings);
export const selectWarningSchema = createSelectSchema(warnings);
export const insertPunishmentSchema = createInsertSchema(punishments);
export const selectPunishmentSchema = createSelectSchema(punishments);
export const insertRuleSchema = createInsertSchema(rules).extend({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  warningLevelId: z.number().int().positive("Warning level ID is required"),
});
export const selectRuleSchema = createSelectSchema(rules);
export const insertDiscordSettingsSchema = createInsertSchema(discordSettings);
export const selectDiscordSettingsSchema = createSelectSchema(discordSettings);
export const insertOpenAISettingsSchema = createInsertSchema(openaiSettings);
export const selectOpenAISettingsSchema = createSelectSchema(openaiSettings);

export const insertAIPromptTemplateSchema = createInsertSchema(aiPromptTemplates);
export const selectAIPromptTemplateSchema = createSelectSchema(aiPromptTemplates);
export const insertAIPromptHistorySchema = createInsertSchema(aiPromptHistory);
export const selectAIPromptHistorySchema = createSelectSchema(aiPromptHistory);

export const insertPunishmentRuleSchema = createInsertSchema(punishmentRules);
export const selectPunishmentRuleSchema = createSelectSchema(punishmentRules);

export const insertAdminUserSchema = createInsertSchema(admin_users);
export const selectAdminUserSchema = createSelectSchema(admin_users);

export type SelectUser = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SelectWarningLevel = typeof warningLevels.$inferSelect;
export type InsertWarningLevel = typeof warningLevels.$inferInsert;
export type SelectWarning = typeof warnings.$inferSelect;
export type InsertWarning = typeof warnings.$inferInsert;
export type SelectPunishment = typeof punishments.$inferSelect;
export type InsertPunishment = typeof punishments.$inferInsert;
export type SelectRule = typeof rules.$inferSelect;
export type InsertRule = typeof rules.$inferInsert;
export type SelectDiscordSettings = typeof discordSettings.$inferSelect;
export type InsertDiscordSettings = typeof discordSettings.$inferInsert;
export type SelectOpenAISettings = typeof openaiSettings.$inferSelect;
export type InsertOpenAISettings = typeof openaiSettings.$inferInsert;
export type SelectAIPromptTemplate = typeof aiPromptTemplates.$inferSelect;
export type InsertAIPromptTemplate = typeof aiPromptTemplates.$inferInsert;
export type SelectAIPromptHistory = typeof aiPromptHistory.$inferSelect;
export type InsertAIPromptHistory = typeof aiPromptHistory.$inferInsert;
export type SelectPunishmentRule = typeof punishmentRules.$inferSelect;
export type InsertPunishmentRule = typeof punishmentRules.$inferInsert;
export type SelectAdminUser = typeof admin_users.$inferSelect;
export type InsertAdminUser = typeof admin_users.$inferInsert;