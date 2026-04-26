import type { ToolDefinition } from '../agents/types.js';

export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: 'web_search_20250305' as never,
  name: 'web_search',
} as unknown as ToolDefinition;

export const SAVE_DRAFT_TOOL: ToolDefinition = {
  name: 'save_draft',
  description:
    'Save content, code, or a report as a draft for the founder to review later. Use this whenever you produce a substantial piece of work.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short title for the draft' },
      content: { type: 'string', description: 'The full content' },
      content_type: {
        type: 'string',
        enum: ['blog_post', 'tweet', 'linkedin', 'newsletter', 'email', 'code', 'prd', 'report'],
        description: 'Type of content',
      },
      tags: { type: 'array', items: { type: 'string' }, description: 'Relevant tags' },
    },
    required: ['title', 'content', 'content_type'],
  },
};

export const LIST_DRAFTS_TOOL: ToolDefinition = {
  name: 'list_drafts',
  description: "List the founder's saved drafts, optionally filtered by type",
  input_schema: {
    type: 'object',
    properties: {
      content_type: { type: 'string', description: 'Filter by type (optional)' },
      limit: { type: 'number', description: 'Max drafts to return (default 10)' },
    },
  },
};

export const GET_METRICS_TOOL: ToolDefinition = {
  name: 'get_metrics',
  description: 'Get usage metrics: daily spend, agent usage breakdown, or task history',
  input_schema: {
    type: 'object',
    properties: {
      metric: {
        type: 'string',
        enum: ['daily_spend', 'agent_usage', 'task_history'],
      },
      days: { type: 'number', description: 'Number of days to look back (default 7)' },
    },
    required: ['metric'],
  },
};
