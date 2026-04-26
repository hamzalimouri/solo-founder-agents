import Anthropic from '@anthropic-ai/sdk';
import { engineerAgent } from './engineer.js';
import { researchAgent } from './research.js';
import { contentAgent } from './content.js';
import { config } from '../config.js';
import type { AgentDefinition } from './types.js';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

export const agentRegistry = new Map<string, AgentDefinition>([
  ['engineer', engineerAgent],
  ['research', researchAgent],
  ['content', contentAgent],
]);

export function getAgent(key: string): AgentDefinition | undefined {
  return agentRegistry.get(key);
}

export function listAgents(): AgentDefinition[] {
  return Array.from(agentRegistry.values());
}

export async function routeMessage(message: string): Promise<string> {
  const lower = message.toLowerCase();

  // 1. Explicit commands
  if (lower.startsWith('/eng ') || lower === '/eng') return 'engineer';
  if (lower.startsWith('/res ') || lower === '/res') return 'research';
  if (lower.startsWith('/con ') || lower === '/con') return 'content';

  // 2. Keyword scoring
  const scores: Record<string, number> = {};
  for (const [key, agent] of agentRegistry) {
    scores[key] = agent.triggers.filter((t) => lower.includes(t)).length;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] > 0) return sorted[0][0];

  // 3. LLM classification with Haiku (cheap)
  try {
    const resp = await anthropic.messages.create({
      model: config.models.haiku,
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: `Which agent should handle this message: "engineer" (coding/tech), "research" (analysis/market), or "content" (writing/marketing)?\n\nMessage: "${message.slice(0, 300)}"\n\nReply with ONLY the agent key word.`,
        },
      ],
    });

    const key = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text.trim().toLowerCase())
      .join('')
      .replace(/[^a-z]/g, '');

    if (agentRegistry.has(key)) return key;
  } catch {
    // Fall through to default
  }

  // 4. Default to content (most general)
  return 'content';
}

export function stripAgentCommand(message: string): string {
  return message.replace(/^\/(eng|res|con)\s*/i, '').trim();
}
