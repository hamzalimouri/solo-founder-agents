import { calculateCost } from '../config.js';
import { getTodaySpend, upsertDailySpend } from '../db/queries.js';
import type { User } from '../db/schema.js';

export interface BudgetCheck {
  allowed: boolean;
  warningPct?: number;
  message?: string;
}

export function checkBudget(user: User): BudgetCheck {
  const spend = getTodaySpend(user.id);
  const used = spend?.totalCost ?? 0;
  const limit = user.dailyBudget ?? 5.00;

  if (used >= limit) {
    return {
      allowed: false,
      message: `⚠️ Daily budget of $${limit.toFixed(2)} reached. Use /budget <amount> to adjust.`,
    };
  }

  const pct = used / limit;
  if (pct >= 0.8) {
    return { allowed: true, warningPct: pct };
  }

  return { allowed: true };
}

export function trackSpend(userId: string, model: string, inputTokens: number, outputTokens: number) {
  const cost = calculateCost(model, inputTokens, outputTokens);
  const tokens = inputTokens + outputTokens;
  upsertDailySpend(userId, cost, tokens);
  return cost;
}

export { calculateCost };
