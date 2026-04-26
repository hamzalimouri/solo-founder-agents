import { Bot } from 'grammy';
import {
  enqueuePendingTask, getNextPendingTask,
  updatePendingTaskStatus, incrementTaskRetries,
  getConversation, upsertConversation, insertTaskLog,
} from '../db/queries.js';
import { getAgent } from '../agents/registry.js';
import { executeAgent } from '../agents/executor.js';
import { getUserByTelegramId } from '../db/queries.js';
import { trackSpend } from '../utils/cost.js';
import { formatAgentResponse, splitMessage } from '../bot/format.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import type { AgentMessage, BusinessContext } from '../agents/types.js';

const MAX_RETRIES = 3;

class TaskRunner {
  private bot: Bot | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  setBotInstance(bot: Bot) {
    this.bot = bot;
  }

  start(intervalMs = 2000) {
    this.interval = setInterval(() => this.processPending(), intervalMs);
    // Process any pending tasks left over from before restart
    void this.processPending();
    logger.info('task_runner_started', { intervalMs });
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    logger.info('task_runner_stopped');
  }

  async enqueue(data: { userId: string; chatId: number; agentKey: string; message: string }) {
    const task = enqueuePendingTask({
      userId: data.userId,
      telegramChatId: data.chatId,
      agentKey: data.agentKey,
      message: data.message,
    });
    logger.info('task_enqueued', { taskId: task?.id, agentKey: data.agentKey });
    return task;
  }

  private async processPending() {
    if (this.processing || !this.bot) return;
    this.processing = true;

    try {
      const task = getNextPendingTask();
      if (!task) return;

      logger.info('task_processing', { taskId: task.id, agentKey: task.agentKey });
      updatePendingTaskStatus(task.id, 'running');

      const user = db.select().from(users).where(eq(users.id, task.userId)).get();
      if (!user) {
        updatePendingTaskStatus(task.id, 'failed', 'User not found');
        return;
      }

      const agent = getAgent(task.agentKey);
      if (!agent) {
        updatePendingTaskStatus(task.id, 'failed', 'Agent not found');
        return;
      }

      const context: BusinessContext = {
        name: user.businessName ?? 'your business',
        description: user.businessDesc ?? '',
        audience: user.targetAudience ?? '',
        url: user.productUrl ?? '',
      };

      const conv = getConversation(user.id, task.agentKey);
      const history: AgentMessage[] = conv ? JSON.parse(conv.messages) : [];

      const result = await executeAgent(agent, history, task.message, context, user.id);

      // Update conversation
      const newHistory: AgentMessage[] = [
        ...history,
        { role: 'user' as const, content: task.message, timestamp: new Date().toISOString() },
        { role: 'assistant' as const, content: result.text, timestamp: new Date().toISOString() },
      ].slice(-config.maxConversationLength);
      upsertConversation(user.id, task.agentKey, newHistory);

      // Track cost
      trackSpend(user.id, config.models[agent.model], result.inputTokens, result.outputTokens);

      insertTaskLog({
        userId: user.id,
        agentKey: task.agentKey,
        userMessage: task.message,
        agentResponse: result.text,
        model: config.models[agent.model],
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
        durationMs: result.durationMs,
        toolCalls: result.toolCallNames,
        status: 'success',
      });

      const formatted = formatAgentResponse(
        agent.emoji, agent.name, result.text,
        result.inputTokens + result.outputTokens, result.costUsd,
      );

      const chunks = splitMessage(formatted);
      for (const chunk of chunks) {
        await this.bot.api.sendMessage(task.telegramChatId, chunk, { parse_mode: 'Markdown' });
      }

      updatePendingTaskStatus(task.id, 'done', result.text.slice(0, 500));
      logger.info('task_completed', { taskId: task.id });

    } catch (err) {
      const task = getNextPendingTask();
      if (task) {
        const retries = (task.retries ?? 0) + 1;
        if (retries >= MAX_RETRIES) {
          updatePendingTaskStatus(task.id, 'failed', String(err));
          logger.error('task_failed_permanent', { taskId: task.id, err: String(err) });
          if (this.bot) {
            await this.bot.api.sendMessage(
              task.telegramChatId,
              '❌ Background task failed after 3 retries. Please try again.',
            ).catch(() => {});
          }
        } else {
          incrementTaskRetries(task.id);
          updatePendingTaskStatus(task.id, 'pending');
          logger.warn('task_retrying', { taskId: task.id, retries });
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

export const taskRunner = new TaskRunner();
