export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  webhookUrl: process.env.WEBHOOK_URL ?? '',
  webhookSecret: process.env.WEBHOOK_SECRET ?? '',
  databasePath: process.env.DATABASE_PATH ?? './agents.db',
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  models: {
    sonnet: process.env.DEFAULT_MODEL ?? 'claude-sonnet-4-6-20250514',
    opus: 'claude-opus-4-7-20250514',
    haiku: process.env.HAIKU_MODEL ?? 'claude-haiku-4-5-20251001',
  },

  dailyBudgetDefault: parseFloat(process.env.DAILY_BUDGET_DEFAULT ?? '5.00'),
  maxConversationLength: parseInt(process.env.MAX_CONVERSATION_LENGTH ?? '20', 10),

  pricing: {
    'claude-sonnet-4-6-20250514': { input: 3.0, output: 15.0 },
    'claude-opus-4-7-20250514': { input: 15.0, output: 75.0 },
    'claude-haiku-4-5-20251001': { input: 0.80, output: 4.0 },
  } as Record<string, { input: number; output: number }>,
} as const;

export function getModelId(tier: 'sonnet' | 'opus' | 'haiku'): string {
  return config.models[tier];
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = config.pricing[model] ?? config.pricing['claude-sonnet-4-6-20250514'];
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}
