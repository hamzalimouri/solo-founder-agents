import { insertDraft, getDrafts, getTodaySpend } from '../db/queries.js';
import { logger } from '../utils/logger.js';

interface ToolContext {
  userId: string;
  agentKey: string;
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  logger.info('tool_call', { tool: name, userId: ctx.userId });

  switch (name) {
    case 'save_draft':
      return handleSaveDraft(input, ctx);
    case 'list_drafts':
      return handleListDrafts(input, ctx);
    case 'get_metrics':
      return handleGetMetrics(input, ctx);
    default:
      logger.warn('unknown_tool', { tool: name });
      return { error: `Unknown tool: ${name}` };
  }
}

function handleSaveDraft(input: Record<string, unknown>, ctx: ToolContext) {
  const draft = insertDraft({
    userId: ctx.userId,
    agentKey: ctx.agentKey,
    title: input.title as string,
    content: input.content as string,
    contentType: input.content_type as string,
    tags: input.tags as string[] | undefined,
  });
  return { draft_id: draft?.id, message: `Draft saved: ${input.title}` };
}

function handleListDrafts(input: Record<string, unknown>, ctx: ToolContext) {
  const limit = (input.limit as number | undefined) ?? 10;
  const items = getDrafts(ctx.userId, input.content_type as string | undefined, limit);
  return { drafts: items };
}

function handleGetMetrics(input: Record<string, unknown>, ctx: ToolContext) {
  const metric = input.metric as string;
  const days = (input.days as number | undefined) ?? 7;

  if (metric === 'daily_spend') {
    const spend = getTodaySpend(ctx.userId);
    return {
      today: {
        cost: spend?.totalCost ?? 0,
        tokens: spend?.totalTokens ?? 0,
        requests: spend?.requestCount ?? 0,
      },
    };
  }

  return { metric, days, message: 'Query logged' };
}
