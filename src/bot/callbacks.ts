import type { Bot, Context } from 'grammy';
import { getUserByTelegramId, insertDraft } from '../db/queries.js';
import { getAgent } from '../agents/registry.js';
import { logger } from '../utils/logger.js';

// In-memory map of last response per chat (for regenerate/revise/deeper)
const lastResponse = new Map<number, { agentKey: string; userMessage: string; responseText: string }>();

export function setLastResponse(chatId: number, agentKey: string, userMessage: string, responseText: string) {
  lastResponse.set(chatId, { agentKey, userMessage, responseText });
}

export function registerCallbacks(bot: Bot) {
  bot.callbackQuery('save_draft', async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const last = lastResponse.get(chatId);
    if (!last) {
      await ctx.reply('Nothing to save — send a message first.');
      return;
    }

    const telegramId = ctx.from?.id;
    const user = telegramId ? getUserByTelegramId(telegramId) : null;
    if (!user) return;

    const agent = getAgent(last.agentKey);
    const draft = insertDraft({
      userId: user.id,
      agentKey: last.agentKey,
      title: last.userMessage.slice(0, 80),
      content: last.responseText,
      contentType: last.agentKey === 'engineer' ? 'code'
        : last.agentKey === 'research' ? 'report'
        : 'blog_post',
    });

    await ctx.reply(`✅ Saved as draft: _${last.userMessage.slice(0, 60)}_\nID: \`${draft?.id}\``, {
      parse_mode: 'Markdown',
    });
    logger.info('draft_saved_via_callback', { userId: user.id, draftId: draft?.id });
  });

  bot.callbackQuery('regenerate', async (ctx) => {
    await ctx.answerCallbackQuery('Regenerating...');
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const last = lastResponse.get(chatId);
    if (!last) {
      await ctx.reply('Nothing to regenerate.');
      return;
    }

    // Re-emit the message as if the user sent it again
    await ctx.reply(`🔄 Regenerating response...`);
    // The main handler will pick this up; we simulate by just noting intent
    // In practice, we send the original message text back to be processed
    await ctx.api.sendMessage(chatId, last.userMessage);
  });

  bot.callbackQuery('revise', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('✏️ What should I change? Reply with your revision instructions.');
  });

  bot.callbackQuery('deeper', async (ctx) => {
    await ctx.answerCallbackQuery('Going deeper...');
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const last = lastResponse.get(chatId);
    if (!last) {
      await ctx.reply('Nothing to expand on.');
      return;
    }

    await ctx.api.sendMessage(chatId, `Go deeper on this analysis: ${last.userMessage}`);
  });
}
