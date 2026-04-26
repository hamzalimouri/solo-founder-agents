import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  telegramId: integer('telegram_id').unique().notNull(),
  username: text('username'),
  firstName: text('first_name'),
  businessName: text('business_name'),
  businessDesc: text('business_desc'),
  targetAudience: text('target_audience'),
  productUrl: text('product_url'),
  dailyBudget: real('daily_budget').default(5.00),
  onboardingStep: integer('onboarding_step').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  userId: text('user_id').notNull().references(() => users.id),
  agentKey: text('agent_key').notNull(),
  messages: text('messages').notNull().default('[]'),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [unique().on(t.userId, t.agentKey)]);

export const taskLogs = sqliteTable('task_logs', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  userId: text('user_id').notNull().references(() => users.id),
  agentKey: text('agent_key').notNull(),
  userMessage: text('user_message').notNull(),
  agentResponse: text('agent_response'),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costUsd: real('cost_usd'),
  durationMs: integer('duration_ms'),
  toolCalls: text('tool_calls'),
  status: text('status').default('success'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export const drafts = sqliteTable('drafts', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  userId: text('user_id').notNull().references(() => users.id),
  agentKey: text('agent_key').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  contentType: text('content_type').notNull(),
  status: text('status').default('draft'),
  tags: text('tags'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export const pendingTasks = sqliteTable('pending_tasks', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  userId: text('user_id').notNull().references(() => users.id),
  telegramChatId: integer('telegram_chat_id').notNull(),
  agentKey: text('agent_key').notNull(),
  message: text('message').notNull(),
  status: text('status').default('pending'),
  result: text('result'),
  retries: integer('retries').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export const dailySpend = sqliteTable('daily_spend', {
  id: text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  userId: text('user_id').notNull().references(() => users.id),
  date: text('date').notNull(),
  totalCost: real('total_cost').default(0),
  totalTokens: integer('total_tokens').default(0),
  requestCount: integer('request_count').default(0),
}, (t) => [unique().on(t.userId, t.date)]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type TaskLog = typeof taskLogs.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type PendingTask = typeof pendingTasks.$inferSelect;
export type DailySpend = typeof dailySpend.$inferSelect;
