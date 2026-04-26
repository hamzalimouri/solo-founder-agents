import type { Context } from 'grammy';
import { getUserByTelegramId, createUser, updateUser } from '../db/queries.js';
import { logger } from '../utils/logger.js';

const QUESTIONS = [
  "👋 Welcome! Let's set up your AI team.\n\nWhat's your product/business name?",
  (name: string) => `What does *${name}* do? _(one sentence)_`,
  'Who are your target customers?',
  "What's your website URL? _(send 'skip' to skip)_",
] as const;

export async function handleSetupWizard(ctx: Context): Promise<boolean> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return false;

  const user = getUserByTelegramId(telegramId);

  // New user — create and start wizard
  if (!user) {
    createUser({
      telegramId,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      onboardingStep: 1,
    });
    await ctx.reply(QUESTIONS[0], { parse_mode: 'Markdown' });
    return true; // handled
  }

  const step = user.onboardingStep ?? 0;

  // Wizard complete
  if (step === 0) return false;

  const text = (ctx.message as { text?: string })?.text?.trim() ?? '';

  if (step === 1) {
    updateUser(telegramId, { businessName: text, onboardingStep: 2 });
    const q = typeof QUESTIONS[1] === 'function' ? QUESTIONS[1](text) : QUESTIONS[1];
    await ctx.reply(q, { parse_mode: 'Markdown' });
    return true;
  }

  if (step === 2) {
    updateUser(telegramId, { businessDesc: text, onboardingStep: 3 });
    await ctx.reply(QUESTIONS[2], { parse_mode: 'Markdown' });
    return true;
  }

  if (step === 3) {
    updateUser(telegramId, { targetAudience: text, onboardingStep: 4 });
    await ctx.reply(QUESTIONS[3], { parse_mode: 'Markdown' });
    return true;
  }

  if (step === 4) {
    const url = text.toLowerCase() === 'skip' ? null : text;
    const updatedUser = updateUser(telegramId, { productUrl: url ?? undefined, onboardingStep: 0 });
    const name = updatedUser?.businessName ?? 'your product';

    logger.info('onboarding_complete', { telegramId });

    await ctx.reply(
      `✅ All set! Your AI team is ready.\n\n` +
      `🛠 *Staff Engineer* — code, PRDs, architecture\n` +
      `🔍 *Research Agent* — competitors, markets, trends\n` +
      `✍️ *Content Strategist* — posts, blogs, newsletters\n\n` +
      `Try: _"Write a tweet about ${name}"_\n\n` +
      `Use /team to see your agents, /help for all commands.`,
      { parse_mode: 'Markdown' },
    );
    return true;
  }

  return false;
}

export function isOnboarding(telegramId: number): boolean {
  const user = getUserByTelegramId(telegramId);
  return !user || (user.onboardingStep ?? 0) > 0;
}
