import type Anthropic from '@anthropic-ai/sdk';

export interface BusinessContext {
  name: string;
  description: string;
  audience: string;
  url: string;
}

export type ToolDefinition = Anthropic.Tool;

export interface AgentDefinition {
  key: string;
  name: string;
  emoji: string;
  description: string;
  triggers: string[];
  model: 'sonnet' | 'opus' | 'haiku';
  tools: ToolDefinition[];
  maxTokens: number;
  isAsync: (message: string) => boolean;
  buildSystemPrompt: (context: BusinessContext) => string;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string | Anthropic.MessageParam['content'];
  timestamp?: string;
}

export interface ExecutionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  toolCallNames: string[];
  durationMs: number;
}
