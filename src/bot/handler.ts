import type { Bot, Context } from 'grammy';
import { getUserByTelegramId } from '../db/queries.js';
import { routeMessage, getAgent, stripAgentCommand } from '../agents/registry.js';
import { executeAgent } from '../agents/executor.js';
import { getConversation, upsertConversation, insertTaskLog } from '../db/queries.js';
import { checkBudget, trackSpend } from '../utils/cost.js';
import { formatAgentResponse, splitMessage } from './format.js';
import { getKeyboardForAgent } from './keyboards.js';
import { handleSetupWizard, isOnboarding } from './setup-wizard.js';
import { setLastResponse } from './callbacks.js';
import { taskRunner } from '../queue/runner.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { AgentMessage, BusinessContext } from '../agents/types.js';

// In-memory rate limiter: userId → { count, windowStart }
const rateLimits = new Map<number, { count: number; windowStart: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(telegramId: number): boolean {
  const now = Date.now();
  const state = rateLimits.get(telegramId);

  if (!state || now - state.windowStart > RATE_WINDOW_MS) {
    rateLimits.set(telegramId, { count: 1, windowStart: now });
    return true;
  }

  if (state.count >= RATE_LIMIT) return false;
  state.count++;
  return true;
}

async function keepTyping(ctx: Context, signal: { stop: boolean }) {
  while (!signal.stop) {
    await ctx.replyWithChatAction('typing').catch(() => {});
    await new Promise((r) => setTimeout(r, 4000));
  }
}

export function registerMessageHandler(bot: Bot) {
  bot.on('message:text', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Rate limit
    if (!checkRateLimit(telegramId)) {
      await ctx.reply('⚠️ Too many messages. Please slow down (30/min limit).');
      return;
    }

    // Setup wizard takes priority
    if (isOnboarding(telegramId)) {
      await handleSetupWizard(ctx);
      return;
    }

    const user = getUserByTelegramId(telegramId);
    if (!user) {
      await handleSetupWizard(ctx);
      return;
    }

    // Budget check
    const budgetCheck = checkBudget(user);
    if (!budgetCheck.allowed) {
      await ctx.reply(budgetCheck.message ?? '⚠️ Budget exceeded.');
      return;
    }

    const message = ctx.message.text;
    const agentKey = await routeMessage(message);
    const agent = getAgent(agentKey)!;
    const cleanMessage = stripAgentCommand(message);

    // Build business context
    const context: BusinessContext = {
      name: user.businessName ?? 'your business',
      description: user.businessDesc ?? '',
      audience: user.targetAudience ?? '',
      url: user.productUrl ?? '',
    };

    // Async tasks → queue
    if (agent.isAsync(cleanMessage)) {
      await taskRunner.enqueue({
        userId: user.id,
        chatId: ctx.chat.id,
        agentKey,
        message: cleanMessage,
      });
      await ctx.reply(
        `${agent.emoji} *${agent.name}* is working on this. I'll message you when it's done (~2-3 min).`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    // Sync execution
    const typingSignal = { stop: false };
    await ctx.replyWithChatAction('typing');
    const typingLoop = keepTyping(ctx, typingSignal);

    try {
      // Load conversation history
      const conv = getConversation(user.id, agentKey);
      const history: AgentMessage[] = conv ? JSON.parse(conv.messages) : [];

      const result = await executeAgent(agent, history, cleanMessage, context, user.id);

      typingSignal.stop = true;

      // Update conversation history
      const newHistory: AgentMessage[] = [
        ...history,
        { role: 'user' as const, content: cleanMessage, timestamp: new Date().toISOString() },
        { role: 'assistant' as const, content: result.text, timestamp: new Date().toISOString() },
      ].slice(-config.maxConversationLength);

      upsertConversation(user.id, agentKey, newHistory);

      // Track cost
      trackSpend(user.id, agent.model === 'sonnet'
        ? config.models.sonnet
        : agent.model === 'opus'
          ? config.models.opus
          : config.models.haiku,
        result.inputTokens, result.outputTokens);

      // Log task
      insertTaskLog({
        userId: user.id,
        agentKey,
        userMessage: cleanMessage,
        agentResponse: result.text,
        model: config.models[agent.model],
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
        toolCalls: result.toolCallNames,
        status: 'success',
      });

      // Format and send
      const budgetWarning = budgetCheck.warningPct
        ? `Approaching daily budget (${Math.round(budgetCheck.warningPct * 100)}% used)`
        : undefined;

      const formatted = formatAgentResponse(
        agent.emoji, agent.name, result.text,
        result.inputTokens + result.outputTokens,
        result.costUsd, budgetWarning,
      );

      const chunks = splitMessage(formatted);
      const keyboard = getKeyboardForAgent(agentKey);

      for (let i = 0; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1;
        await ctx.reply(chunks[i], {
          parse_mode: 'Markdown',
          reply_markup: isLast ? keyboard : undefined,
        });
      }

      // Store last response for callbacks
      setLastResponse(ctx.chat.id, agentKey, cleanMessage, result.text);

      logger.info('message_handled', {
        telegramId, agentKey, tokens: result.inputTokens + result.outputTokens,
        cost: result.costUsd,
      });

    } catch (err) {
      typingSignal.stop = true;
      logger.error('message_handler_error', { err: String(err), telegramId });

      insertTaskLog({
        userId: user.id,
        agentKey,
        userMessage: cleanMessage,
        model: config.models[agent.model],
        status: 'error',
      });

      await ctx.reply(
        '❌ Something went wrong. Please try again.\n\n_If this persists, try /clear to reset the conversation._',
        { parse_mode: 'Markdown' },
      );
    }
  });
}
