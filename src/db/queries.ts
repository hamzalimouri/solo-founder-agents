import { eq, and, sql } from 'drizzle-orm';
import { db } from './client.js';
import { users, conversations, taskLogs, drafts, pendingTasks, dailySpend } from './schema.js';
import type { NewUser } from './schema.js';

// ── Users ───────────────────────────────────────────────────────────────────

export function getUserByTelegramId(telegramId: number) {
  return db.select().from(users).where(eq(users.telegramId, telegramId)).get();
}

export function createUser(data: NewUser) {
  return db.insert(users).values(data).returning().get();
}

export function updateUser(telegramId: number, data: Partial<NewUser>) {
  return db.update(users).set(data).where(eq(users.telegramId, telegramId)).returning().get();
}

// ── Conversations ────────────────────────────────────────────────────────────

export function getConversation(userId: string, agentKey: string) {
  return db.select().from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.agentKey, agentKey)))
    .get();
}

export function upsertConversation(userId: string, agentKey: string, messages: object[]) {
  const json = JSON.stringify(messages);
  db.run(sql`
    INSERT INTO conversations (user_id, agent_key, messages, updated_at)
    VALUES (${userId}, ${agentKey}, ${json}, datetime('now'))
    ON CONFLICT(user_id, agent_key) DO UPDATE SET
      messages = excluded.messages,
      updated_at = excluded.updated_at
  `);
}

export function clearConversation(userId: string, agentKey?: string) {
  if (agentKey) {
    db.delete(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.agentKey, agentKey)))
      .run();
  } else {
    db.delete(conversations).where(eq(conversations.userId, userId)).run();
  }
}

// ── Task Logs ────────────────────────────────────────────────────────────────

export function insertTaskLog(data: {
  userId: string;
  agentKey: string;
  userMessage: string;
  agentResponse?: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  durationMs?: number;
  toolCalls?: string[];
  status?: string;
}) {
  return db.insert(taskLogs).values({
    userId: data.userId,
    agentKey: data.agentKey,
    userMessage: data.userMessage,
    agentResponse: data.agentResponse,
    model: data.model,
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
    costUsd: data.costUsd,
    durationMs: data.durationMs,
    toolCalls: data.toolCalls ? JSON.stringify(data.toolCalls) : null,
    status: data.status ?? 'success',
  }).run();
}

// ── Drafts ───────────────────────────────────────────────────────────────────

export function insertDraft(data: {
  userId: string;
  agentKey: string;
  title: string;
  content: string;
  contentType: string;
  tags?: string[];
}) {
  return db.insert(drafts).values({
    userId: data.userId,
    agentKey: data.agentKey,
    title: data.title,
    content: data.content,
    contentType: data.contentType,
    tags: data.tags ? JSON.stringify(data.tags) : null,
  }).returning().get();
}

export function getDrafts(userId: string, contentType?: string, limit = 10) {
  let q = db.select({
    id: drafts.id,
    title: drafts.title,
    contentType: drafts.contentType,
    status: drafts.status,
    createdAt: drafts.createdAt,
  }).from(drafts).where(eq(drafts.userId, userId));

  return q.limit(limit).all();
}

export function getDraftById(id: string) {
  return db.select().from(drafts).where(eq(drafts.id, id)).get();
}

// ── Pending Tasks ─────────────────────────────────────────────────────────────

export function enqueuePendingTask(data: {
  userId: string;
  telegramChatId: number;
  agentKey: string;
  message: string;
}) {
  return db.insert(pendingTasks).values(data).returning().get();
}

export function getNextPendingTask() {
  return db.select().from(pendingTasks)
    .where(eq(pendingTasks.status, 'pending'))
    .orderBy(pendingTasks.createdAt)
    .limit(1)
    .get();
}

export function updatePendingTaskStatus(id: string, status: string, result?: string) {
  db.update(pendingTasks)
    .set({ status, result: result ?? null })
    .where(eq(pendingTasks.id, id))
    .run();
}

export function incrementTaskRetries(id: string) {
  db.run(sql`UPDATE pending_tasks SET retries = retries + 1 WHERE id = ${id}`);
}

// ── Daily Spend ───────────────────────────────────────────────────────────────

export function getTodaySpend(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  return db.select().from(dailySpend)
    .where(and(eq(dailySpend.userId, userId), eq(dailySpend.date, today)))
    .get();
}

export function upsertDailySpend(userId: string, costUsd: number, tokens: number) {
  const today = new Date().toISOString().split('T')[0];
  db.run(sql`
    INSERT INTO daily_spend (user_id, date, total_cost, total_tokens, request_count)
    VALUES (${userId}, ${today}, ${costUsd}, ${tokens}, 1)
    ON CONFLICT(user_id, date) DO UPDATE SET
      total_cost    = total_cost + excluded.total_cost,
      total_tokens  = total_tokens + excluded.total_tokens,
      request_count = request_count + 1
  `);
}

export function getWeeklySpend(userId: string): number {
  const result = db.run(sql`
    SELECT COALESCE(SUM(total_cost), 0) as total
    FROM daily_spend
    WHERE user_id = ${userId}
      AND date >= date('now', '-7 days')
  `);
  // Access via raw sqlite for aggregation
  return 0;
}

export function getAgentBreakdown(userId: string, days = 7) {
  return db.run(sql`
    SELECT agent_key,
           COUNT(*) as request_count,
           COALESCE(SUM(cost_usd), 0) as total_cost
    FROM task_logs
    WHERE user_id = ${userId}
      AND created_at >= datetime('now', '-${days} days')
    GROUP BY agent_key
  `);
}

export function cleanOldRecords() {
  db.run(sql`DELETE FROM task_logs WHERE created_at < datetime('now', '-30 days')`);
  db.run(sql`DELETE FROM pending_tasks WHERE status IN ('done','failed') AND created_at < datetime('now', '-30 days')`);
}
