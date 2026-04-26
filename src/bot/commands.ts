import type { Bot, Context } from 'grammy';
import {
  getUserByTelegramId, updateUser, clearConversation,
  getTodaySpend, getDrafts,
} from '../db/queries.js';
import { listAgents } from '../agents/registry.js';
import { db } from '../db/client.js';
import { taskLogs } from '../db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';

export function registerCommands(bot: Bot) {
  bot.command('start', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const user = getUserByTelegramId(telegramId);

    if (user && (user.onboardingStep ?? 0) === 0 && user.businessName) {
      await ctx.reply(
        `Welcome back! 👋\n\n` +
        `Your AI team is standing by.\n\n` +
        `🛠 *Staff Engineer* — /eng <message>\n` +
        `🔍 *Research Agent* — /res <message>\n` +
        `✍️ *Content Strategist* — /con <message>\n\n` +
        `Or just send any message — I'll route it automatically.`,
        { parse_mode: 'Markdown' },
      );
    }
    // else: setup wizard handles it via handleSetupWizard
  });

  bot.command('team', async (ctx) => {
    const agents = listAgents();
    const lines = agents.map(
      (a) => `${a.emoji} *${a.name}*\n  ${a.description}\n  Force: /${a.key.slice(0, 3)} <message>`,
    );
    await ctx.reply(
      `*Your AI Team*\n\n${lines.join('\n\n')}\n\nSend any message — I'll route it to the right agent.`,
      { parse_mode: 'Markdown' },
    );
  });

  bot.command('status', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const user = getUserByTelegramId(telegramId);
    if (!user) { await ctx.reply('Please /start first.'); return; }

    const spend = getTodaySpend(user.id);
    const budget = user.dailyBudget ?? 5.00;
    const used = spend?.totalCost ?? 0;
    const tokens = spend?.totalTokens ?? 0;
    const requests = spend?.requestCount ?? 0;

    // Agent breakdown from task_logs
    const today = new Date().toISOString().split('T')[0];
    const breakdown = db.all<{ agent_key: string; cnt: number; cost: number }>(
      sql`SELECT agent_key, COUNT(*) as cnt, COALESCE(SUM(cost_usd),0) as cost
          FROM task_logs
          WHERE user_id = ${user.id} AND date(created_at) = ${today}
          GROUP BY agent_key`,
    );

    const agentLines = breakdown.map((row) => {
      const agent = listAgents().find((a) => a.key === row.agent_key);
      return `  ${agent?.emoji ?? '🤖'} ${agent?.name ?? row.agent_key}: ${row.cnt} req · $${(row.cost as number).toFixed(4)}`;
    }).join('\n') || '  No activity yet';

    // Weekly spend
    const weeklyResult = db.get<{ total: number }>(
      sql`SELECT COALESCE(SUM(total_cost),0) as total FROM daily_spend
          WHERE user_id = ${user.id} AND date >= date('now','-7 days')`,
    );
    const weekly = weeklyResult?.total ?? 0;

    await ctx.reply(
      `📊 *Today's Usage*\n\n` +
      `💰 Spent: $${used.toFixed(4)} / $${budget.toFixed(2)} budget\n` +
      `📨 Requests: ${requests}\n` +
      `🔤 Tokens: ${tokens.toLocaleString()}\n\n` +
      `*Agent breakdown:*\n${agentLines}\n\n` +
      `📅 This week: $${weekly.toFixed(4)}`,
      { parse_mode: 'Markdown' },
    );
  });

  bot.command('drafts', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const user = getUserByTelegramId(telegramId);
    if (!user) { await ctx.reply('Please /start first.'); return; }

    const items = getDrafts(user.id, undefined, 10);
    if (items.length === 0) {
      await ctx.reply('No drafts saved yet. Agents save drafts automatically when they create content.');
      return;
    }

    const lines = items.map(
      (d, i) => `${i + 1}. *${d.title}* [${d.contentType}] — ${d.createdAt?.split('T')[0] ?? ''}`,
    );
    await ctx.reply(`*Your Drafts*\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
  });

  bot.command('clear', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const user = getUserByTelegramId(telegramId);
    if (!user) { await ctx.reply('Please /start first.'); return; }

    const args = ctx.match?.trim();
    const agentKey = args || undefined;
    clearConversation(user.id, agentKey);

    const msg = agentKey
      ? `✅ Cleared conversation with ${agentKey} agent.`
      : '✅ Cleared all agent conversations.';
    await ctx.reply(msg);
  });

  bot.command('budget', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const args = ctx.match?.trim();

    if (!args) {
      const user = getUserByTelegramId(telegramId);
      await ctx.reply(`Current budget: $${(user?.dailyBudget ?? 5).toFixed(2)}/day\n\nUsage: /budget <amount>`);
      return;
    }

    const amount = parseFloat(args);
    if (isNaN(amount) || amount < 0) {
      await ctx.reply('Invalid amount. Example: /budget 10');
      return;
    }

    updateUser(telegramId, { dailyBudget: amount });
    await ctx.reply(`✅ Daily budget set to $${amount.toFixed(2)}`);
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `*Commands*\n\n` +
      `/start — Welcome + setup wizard\n` +
      `/team — List your AI agents\n` +
      `/status — Today's spend & usage\n` +
      `/drafts — View saved drafts\n` +
      `/clear [agent] — Reset conversation\n` +
      `/budget <amount> — Set daily spend limit\n` +
      `/eng <msg> — Force Staff Engineer\n` +
      `/res <msg> — Force Research Agent\n` +
      `/con <msg> — Force Content Strategist`,
      { parse_mode: 'Markdown' },
    );
  });
}
