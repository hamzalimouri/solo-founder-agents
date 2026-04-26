import type { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { createToken, verifyToken, checkPassword } from './auth.js';
import { db } from '../db/client.js';
import { taskLogs, conversations, drafts, pendingTasks, dailySpend, users } from '../db/schema.js';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import {
  getUserByTelegramId, updateUser, clearConversation,
  getDrafts, getDraftById, insertDraft, getTodaySpend,
  getConversation, upsertConversation, insertTaskLog,
} from '../db/queries.js';
import { routeMessage, getAgent, stripAgentCommand, agentRegistry } from '../agents/registry.js';
import { config, getModelId, calculateCost } from '../config.js';
import { trackSpend } from '../utils/cost.js';
import { logger } from '../utils/logger.js';
import type { AgentMessage, BusinessContext } from '../agents/types.js';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

// Helper: get first user from DB (solo founder = one user)
function getFounder() {
  return db.select().from(users).limit(1).get();
}

export async function registerApiRoutes(fastify: FastifyInstance) {
  // ── Auth middleware ────────────────────────────────────────────────────────
  fastify.addHook('onRequest', async (request, reply) => {
    const url = request.url.split('?')[0];
    if (!url.startsWith('/api/') || url === '/api/login') return;

    const authHeader = (request.headers as Record<string, string>).authorization;
    const token = authHeader?.replace('Bearer ', '').trim();
    if (!token || !(await verifyToken(token))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // ── POST /api/login ────────────────────────────────────────────────────────
  fastify.post('/api/login', async (request, reply) => {
    const { password } = request.body as { password: string };
    if (!checkPassword(password)) {
      return reply.status(401).send({ error: 'Invalid password' });
    }
    const token = await createToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return { token, expiresAt };
  });

  // ── GET /api/analytics/overview ───────────────────────────────────────────
  fastify.get('/api/analytics/overview', async (request) => {
    const { days = '7' } = request.query as { days?: string };
    const d = parseInt(days, 10);
    const founder = getFounder();
    const userId = founder?.id;

    const spendByDay = db.all<{ date: string; cost: number; requests: number; tokens: number }>(
      sql`SELECT date(created_at) as date,
               COALESCE(SUM(cost_usd),0) as cost,
               COUNT(*) as requests,
               COALESCE(SUM(input_tokens+output_tokens),0) as tokens
          FROM task_logs
          WHERE ${userId ? sql`user_id = ${userId} AND` : sql``}
                created_at >= datetime('now', ${sql.raw(`'-${d} days'`)})
          GROUP BY date(created_at)
          ORDER BY date ASC`,
    );

    const spendByAgent = db.all<{ agent_key: string; cost: number; requests: number; tokens: number; avg_ms: number }>(
      sql`SELECT agent_key,
               COALESCE(SUM(cost_usd),0) as cost,
               COUNT(*) as requests,
               COALESCE(SUM(input_tokens+output_tokens),0) as tokens,
               COALESCE(AVG(duration_ms),0) as avg_ms
          FROM task_logs
          WHERE ${userId ? sql`user_id = ${userId} AND` : sql``}
                created_at >= datetime('now', ${sql.raw(`'-${d} days'`)})
          GROUP BY agent_key`,
    );

    const topQueries = db.all<{ user_message: string; agent_key: string; cost_usd: number; created_at: string }>(
      sql`SELECT user_message, agent_key, cost_usd, created_at
          FROM task_logs
          WHERE ${userId ? sql`user_id = ${userId} AND` : sql``}
                cost_usd IS NOT NULL
          ORDER BY cost_usd DESC
          LIMIT 5`,
    );

    const totals = db.get<{ cost: number; requests: number; tokens: number }>(
      sql`SELECT COALESCE(SUM(cost_usd),0) as cost,
               COUNT(*) as requests,
               COALESCE(SUM(input_tokens+output_tokens),0) as tokens
          FROM task_logs
          WHERE ${userId ? sql`user_id = ${userId} AND` : sql``}
                date(created_at) = date('now')`,
    ) ?? { cost: 0, requests: 0, tokens: 0 };

    const yesterday = db.get<{ cost: number; requests: number }>(
      sql`SELECT COALESCE(SUM(cost_usd),0) as cost, COUNT(*) as requests
          FROM task_logs
          WHERE ${userId ? sql`user_id = ${userId} AND` : sql``}
                date(created_at) = date('now','-1 day')`,
    ) ?? { cost: 0, requests: 0 };

    const agentMap = Object.fromEntries(
      Array.from(agentRegistry.entries()).map(([k, a]) => [k, { name: a.name, emoji: a.emoji }]),
    );

    return {
      totalSpend: totals.cost,
      totalRequests: totals.requests,
      totalTokens: totals.tokens,
      averageCostPerRequest: totals.requests > 0 ? totals.cost / totals.requests : 0,
      yesterdaySpend: yesterday.cost,
      yesterdayRequests: yesterday.requests,
      spendByDay,
      spendByAgent: spendByAgent.map((r) => ({
        ...r,
        name: agentMap[r.agent_key]?.name ?? r.agent_key,
        emoji: agentMap[r.agent_key]?.emoji ?? '🤖',
      })),
      topQueries,
    };
  });

  // ── GET /api/analytics/agents ─────────────────────────────────────────────
  fastify.get('/api/analytics/agents', async (request) => {
    const { days = '7' } = request.query as { days?: string };
    const d = parseInt(days, 10);
    const founder = getFounder();
    const userId = founder?.id;

    const rows = db.all<{
      agent_key: string; requests: number; cost: number; tokens: number;
      avg_input: number; avg_output: number; avg_ms: number;
    }>(
      sql`SELECT agent_key,
               COUNT(*) as requests,
               COALESCE(SUM(cost_usd),0) as cost,
               COALESCE(SUM(input_tokens+output_tokens),0) as tokens,
               COALESCE(AVG(input_tokens),0) as avg_input,
               COALESCE(AVG(output_tokens),0) as avg_output,
               COALESCE(AVG(duration_ms),0) as avg_ms
          FROM task_logs
          WHERE ${userId ? sql`user_id = ${userId} AND` : sql``}
                created_at >= datetime('now', ${sql.raw(`'-${d} days'`)})
          GROUP BY agent_key`,
    );

    const dailyRows = db.all<{ agent_key: string; date: string; requests: number }>(
      sql`SELECT agent_key, date(created_at) as date, COUNT(*) as requests
          FROM task_logs
          WHERE ${userId ? sql`user_id = ${userId} AND` : sql``}
                created_at >= datetime('now', ${sql.raw(`'-${d} days'`)})
          GROUP BY agent_key, date(created_at)
          ORDER BY date ASC`,
    );

    const topByAgent = db.all<{ agent_key: string; user_message: string; cost_usd: number }>(
      sql`SELECT agent_key, user_message, cost_usd
          FROM task_logs
          WHERE ${userId ? sql`user_id = ${userId} AND` : sql``}
                cost_usd IS NOT NULL
          ORDER BY cost_usd DESC
          LIMIT 15`,
    );

    const agentMap = Object.fromEntries(
      Array.from(agentRegistry.entries()).map(([k, a]) => [k, a]),
    );

    return rows.map((r) => ({
      key: r.agent_key,
      name: agentMap[r.agent_key]?.name ?? r.agent_key,
      emoji: agentMap[r.agent_key]?.emoji ?? '🤖',
      totalRequests: r.requests,
      totalCost: r.cost,
      totalTokens: r.tokens,
      avgInputTokens: Math.round(r.avg_input),
      avgOutputTokens: Math.round(r.avg_output),
      avgDurationMs: Math.round(r.avg_ms),
      avgCostPerRequest: r.requests > 0 ? r.cost / r.requests : 0,
      dailyUsage: dailyRows.filter((dr) => dr.agent_key === r.agent_key),
      topQueries: topByAgent
        .filter((q) => q.agent_key === r.agent_key)
        .slice(0, 3)
        .map((q) => ({ message: q.user_message, cost: q.cost_usd })),
    }));
  });

  // ── GET /api/conversations ────────────────────────────────────────────────
  fastify.get('/api/conversations', async () => {
    const rows = db.all<{ id: string; agent_key: string; messages: string; updated_at: string }>(
      sql`SELECT id, agent_key, messages, updated_at FROM conversations ORDER BY updated_at DESC`,
    );
    return rows.map((r) => {
      const msgs: AgentMessage[] = JSON.parse(r.messages);
      const last = msgs[msgs.length - 1];
      return {
        id: r.id,
        agentKey: r.agent_key,
        agentName: agentRegistry.get(r.agent_key)?.name ?? r.agent_key,
        agentEmoji: agentRegistry.get(r.agent_key)?.emoji ?? '🤖',
        messageCount: msgs.length,
        lastMessage: typeof last?.content === 'string' ? last.content.slice(0, 120) : '',
        updatedAt: r.updated_at,
      };
    });
  });

  // ── GET /api/conversations/:agentKey ─────────────────────────────────────
  fastify.get<{ Params: { agentKey: string } }>('/api/conversations/:agentKey', async (request, reply) => {
    const { agentKey } = request.params;
    const founder = getFounder();
    if (!founder) return reply.status(404).send({ error: 'No user found' });

    const conv = getConversation(founder.id, agentKey);
    const messages: AgentMessage[] = conv ? JSON.parse(conv.messages) : [];
    return {
      agentKey,
      agentName: agentRegistry.get(agentKey)?.name ?? agentKey,
      agentEmoji: agentRegistry.get(agentKey)?.emoji ?? '🤖',
      messages,
    };
  });

  // ── DELETE /api/conversations/:agentKey ───────────────────────────────────
  fastify.delete<{ Params: { agentKey: string } }>('/api/conversations/:agentKey', async (request) => {
    const { agentKey } = request.params;
    const founder = getFounder();
    if (founder) clearConversation(founder.id, agentKey);
    return { cleared: true };
  });

  // ── POST /api/chat (streaming SSE) ────────────────────────────────────────
  fastify.post('/api/chat', async (request, reply) => {
    const { message, agentKey: forceKey } = request.body as { message: string; agentKey?: string };
    const founder = getFounder();

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (data: object) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const agentKey = forceKey ?? (await routeMessage(message));
      const agent = getAgent(agentKey)!;
      const cleanMsg = stripAgentCommand(message);

      send({ type: 'agent', agent: { key: agent.key, name: agent.name, emoji: agent.emoji } });

      const context: BusinessContext = {
        name: founder?.businessName ?? 'your business',
        description: founder?.businessDesc ?? '',
        audience: founder?.targetAudience ?? '',
        url: founder?.productUrl ?? '',
      };

      const conv = founder ? getConversation(founder.id, agentKey) : null;
      const history: AgentMessage[] = conv ? JSON.parse(conv.messages) : [];

      const apiMessages: Anthropic.MessageParam[] = [
        ...history.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content as Anthropic.MessageParam['content'],
        })),
        { role: 'user', content: cleanMsg },
      ];

      const tools = agent.tools.filter((t) => t.name !== 'web_search') as Anthropic.Tool[];
      const hasWebSearch = agent.tools.some((t) => t.name === 'web_search');
      const allTools: Anthropic.Tool[] = hasWebSearch
        ? [{ type: 'web_search_20250305', name: 'web_search' } as unknown as Anthropic.Tool, ...tools]
        : tools;

      const start = Date.now();
      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      const stream = await anthropic.messages.stream({
        model: getModelId(agent.model),
        max_tokens: agent.maxTokens,
        system: agent.buildSystemPrompt(context),
        messages: apiMessages,
        ...(allTools.length > 0 && { tools: allTools }),
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullText += event.delta.text;
          send({ type: 'text', text: event.delta.text });
        }
        if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
          send({ type: 'tool_start', tool: event.content_block.name });
        }
      }

      const final = await stream.finalMessage();
      inputTokens = final.usage.input_tokens;
      outputTokens = final.usage.output_tokens;
      const costUsd = calculateCost(getModelId(agent.model), inputTokens, outputTokens);

      send({ type: 'done', usage: { inputTokens, outputTokens, cost: costUsd } });

      // Persist
      if (founder) {
        const newHistory: AgentMessage[] = [
          ...history,
          { role: 'user' as const, content: cleanMsg, timestamp: new Date().toISOString() },
          { role: 'assistant' as const, content: fullText, timestamp: new Date().toISOString() },
        ].slice(-config.maxConversationLength);
        upsertConversation(founder.id, agentKey, newHistory);
        trackSpend(founder.id, getModelId(agent.model), inputTokens, outputTokens);
        insertTaskLog({
          userId: founder.id, agentKey, userMessage: cleanMsg, agentResponse: fullText,
          model: getModelId(agent.model), inputTokens, outputTokens, costUsd,
          durationMs: Date.now() - start, status: 'success',
        });
      }
    } catch (err) {
      logger.error('chat_stream_error', { err: String(err) });
      send({ type: 'error', message: String(err) });
    }

    reply.raw.end();
  });

  // ── GET /api/drafts ───────────────────────────────────────────────────────
  fastify.get('/api/drafts', async (request) => {
    const { type, status, limit = '20' } = request.query as {
      type?: string; status?: string; limit?: string;
    };
    const founder = getFounder();
    if (!founder) return [];

    let q = db.select().from(drafts).where(eq(drafts.userId, founder.id));
    const items = q.orderBy(desc(drafts.createdAt)).limit(parseInt(limit, 10)).all();

    return items
      .filter((d) => (!type || d.contentType === type) && (!status || d.status === status))
      .map((d) => ({
        ...d,
        preview: d.content.slice(0, 200),
        content: undefined,
      }));
  });

  // ── GET /api/drafts/:id ───────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/api/drafts/:id', async (request, reply) => {
    const draft = getDraftById(request.params.id);
    if (!draft) return reply.status(404).send({ error: 'Not found' });
    return draft;
  });

  // ── PATCH /api/drafts/:id ─────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>('/api/drafts/:id', async (request) => {
    const { status, title, content } = request.body as {
      status?: string; title?: string; content?: string;
    };
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    db.update(drafts).set(updates).where(eq(drafts.id, request.params.id)).run();
    return { updated: true };
  });

  // ── DELETE /api/drafts/:id ────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/api/drafts/:id', async (request) => {
    db.delete(drafts).where(eq(drafts.id, request.params.id)).run();
    return { deleted: true };
  });

  // ── GET /api/tasks ────────────────────────────────────────────────────────
  fastify.get('/api/tasks', async (request) => {
    const { status, limit = '20' } = request.query as { status?: string; limit?: string };
    let q = db.select().from(pendingTasks).orderBy(desc(pendingTasks.createdAt)).limit(parseInt(limit, 10));
    const items = q.all();
    return status ? items.filter((t) => t.status === status) : items;
  });

  // ── GET /api/settings ─────────────────────────────────────────────────────
  fastify.get('/api/settings', async () => {
    const founder = getFounder();
    const spend = founder ? getTodaySpend(founder.id) : null;
    return {
      businessName: founder?.businessName ?? '',
      businessDesc: founder?.businessDesc ?? '',
      targetAudience: founder?.targetAudience ?? '',
      productUrl: founder?.productUrl ?? '',
      dailyBudget: founder?.dailyBudget ?? 5,
      todaySpend: spend?.totalCost ?? 0,
    };
  });

  // ── PATCH /api/settings ───────────────────────────────────────────────────
  fastify.patch('/api/settings', async (request) => {
    const body = request.body as {
      businessName?: string; businessDesc?: string;
      targetAudience?: string; productUrl?: string; dailyBudget?: number;
    };
    const founder = getFounder();
    if (!founder) return { updated: false };
    db.update(users).set({
      businessName: body.businessName,
      businessDesc: body.businessDesc,
      targetAudience: body.targetAudience,
      productUrl: body.productUrl,
      dailyBudget: body.dailyBudget,
    }).where(eq(users.id, founder.id)).run();
    return { updated: true };
  });

  // ── POST /api/settings/clear-conversations ────────────────────────────────
  fastify.post('/api/settings/clear-conversations', async () => {
    db.delete(conversations).run();
    return { cleared: true };
  });

  // ── POST /api/settings/clear-drafts ──────────────────────────────────────
  fastify.post('/api/settings/clear-drafts', async () => {
    const founder = getFounder();
    if (founder) db.delete(drafts).where(eq(drafts.userId, founder.id)).run();
    return { cleared: true };
  });

  // ── POST /api/settings/reset-spend ───────────────────────────────────────
  fastify.post('/api/settings/reset-spend', async () => {
    db.delete(dailySpend).run();
    return { reset: true };
  });
}
