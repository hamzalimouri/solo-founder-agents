import Anthropic from '@anthropic-ai/sdk';
import { config, getModelId, calculateCost } from '../config.js';
import { executeTool } from '../tools/executor.js';
import { logger } from '../utils/logger.js';
import type { AgentDefinition, AgentMessage, ExecutionResult, BusinessContext } from './types.js';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

export async function executeAgent(
  agent: AgentDefinition,
  history: AgentMessage[],
  newMessage: string,
  context: BusinessContext,
  userId: string,
): Promise<ExecutionResult> {
  const start = Date.now();
  const systemPrompt = agent.buildSystemPrompt(context);
  const modelId = getModelId(agent.model);

  // Build messages array for API
  const apiMessages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as Anthropic.MessageParam['content'],
    })),
    { role: 'user', content: newMessage },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolCallNames: string[] = [];

  // Build tools array — filter out web_search (handled via type field)
  const tools = agent.tools.filter((t) => t.name !== 'web_search') as Anthropic.Tool[];
  const hasWebSearch = agent.tools.some((t) => t.name === 'web_search');

  const createParams: Anthropic.MessageCreateParamsNonStreaming = {
    model: modelId,
    max_tokens: agent.maxTokens,
    system: systemPrompt,
    messages: apiMessages,
    ...(tools.length > 0 && { tools }),
    ...(hasWebSearch && {
      tools: [
        { type: 'web_search_20250305', name: 'web_search' } as unknown as Anthropic.Tool,
        ...tools,
      ],
    }),
  };

  let response = await anthropic.messages.create(createParams);
  totalInputTokens += response.usage.input_tokens;
  totalOutputTokens += response.usage.output_tokens;

  // Tool use loop
  while (response.stop_reason === 'tool_use') {
    const toolBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolBlocks) {
      toolCallNames.push(block.name);
      const result = await executeTool(
        block.name,
        block.input as Record<string, unknown>,
        { userId, agentKey: agent.key },
      );
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    apiMessages.push({ role: 'assistant', content: response.content });
    apiMessages.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      ...createParams,
      messages: apiMessages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const costUsd = calculateCost(modelId, totalInputTokens, totalOutputTokens);

  logger.info('agent_execution', {
    agentKey: agent.key,
    model: modelId,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    costUsd,
    durationMs: Date.now() - start,
    tools: toolCallNames,
  });

  return {
    text,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    costUsd,
    toolCallNames,
    durationMs: Date.now() - start,
  };
}
