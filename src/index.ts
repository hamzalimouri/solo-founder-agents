import Fastify from 'fastify';
import { Bot, webhookCallback } from 'grammy';
import { config } from './config.js';
import { db } from './db/client.js';
import { registerCommands } from './bot/commands.js';
import { registerMessageHandler } from './bot/handler.js';
import { registerCallbacks } from './bot/callbacks.js';
import { taskRunner } from './queue/runner.js';
import { cleanOldRecords } from './db/queries.js';
import { logger } from './utils/logger.js';

async function main() {
  // Validate required env vars
  const missing = ['TELEGRAM_BOT_TOKEN', 'ANTHROPIC_API_KEY'].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error('missing_env_vars', { missing });
    process.exit(1);
  }

  // Init Fastify
  const fastify = Fastify({ logger: false });

  // Init Telegram bot
  const bot = new Bot(config.telegramBotToken);

  // Register bot handlers
  registerCommands(bot);
  registerMessageHandler(bot);
  registerCallbacks(bot);

  // Give task runner access to bot
  taskRunner.setBotInstance(bot);

  // Webhook handler
  fastify.post('/webhook/telegram', {
    config: { rawBody: true },
  }, async (req, reply) => {
    // Verify secret token
    const secret = (req.headers as Record<string, string>)['x-telegram-bot-api-secret-token'];
    if (config.webhookSecret && secret !== config.webhookSecret) {
      return reply.code(403).send('Forbidden');
    }
    const handler = webhookCallback(bot, 'fastify');
    return handler(req, reply);
  });

  // Health check
  fastify.get('/health', async () => ({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    agents: 3,
    db: db ? 'connected' : 'error',
    env: config.nodeEnv,
  }));

  // n8n webhook (optional incoming events)
  fastify.post('/webhook/n8n', async (req, reply) => {
    logger.info('n8n_webhook', { body: req.body });
    return reply.send({ ok: true });
  });

  // Start server
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  logger.info('server_started', { port: config.port });

  // Register Telegram webhook
  if (config.webhookUrl) {
    const webhookUrl = `${config.webhookUrl}/webhook/telegram`;
    await bot.api.setWebhook(webhookUrl, {
      secret_token: config.webhookSecret || undefined,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    });
    logger.info('webhook_registered', { url: webhookUrl });
  } else {
    logger.warn('no_webhook_url', { msg: 'WEBHOOK_URL not set — bot will not receive messages' });
  }

  // Start background task runner
  taskRunner.start(2000);

  // Clean old DB records once per day
  cleanOldRecords();
  setInterval(cleanOldRecords, 24 * 60 * 60 * 1000);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('shutdown_signal');
    taskRunner.stop();
    await fastify.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
