import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import { Bot, webhookCallback } from 'grammy';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import { db } from './db/client.js';
import { registerCommands } from './bot/commands.js';
import { registerMessageHandler } from './bot/handler.js';
import { registerCallbacks } from './bot/callbacks.js';
import { registerApiRoutes } from './api/routes.js';
import { taskRunner } from './queue/runner.js';
import { cleanOldRecords } from './db/queries.js';
import { logger } from './utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const missing = ['TELEGRAM_BOT_TOKEN', 'ANTHROPIC_API_KEY'].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error('missing_env_vars', { missing });
    process.exit(1);
  }

  const fastify = Fastify({ logger: false });

  // CORS for dashboard dev mode
  await fastify.register(fastifyCors, {
    origin: config.nodeEnv === 'development' ? true : false,
    credentials: true,
  });

  const bot = new Bot(config.telegramBotToken);

  registerCommands(bot);
  registerMessageHandler(bot);
  registerCallbacks(bot);
  taskRunner.setBotInstance(bot);

  // Telegram webhook
  fastify.post('/webhook/telegram', async (req, reply) => {
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

  // Optional n8n webhook
  fastify.post('/webhook/n8n', async (req, reply) => {
    logger.info('n8n_webhook', { body: req.body });
    return reply.send({ ok: true });
  });

  // Register all /api/* routes
  await registerApiRoutes(fastify);

  // Serve built React app (production only)
  if (config.nodeEnv === 'production') {
    const clientDir = join(__dirname, 'client');
    await fastify.register(fastifyStatic, {
      root: clientDir,
      prefix: '/',
      decorateReply: false,
    });

    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/webhook/') || request.url === '/health') {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html', clientDir);
    });
  }

  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  logger.info('server_started', { port: config.port });

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

  taskRunner.start(2000);
  cleanOldRecords();
  setInterval(cleanOldRecords, 24 * 60 * 60 * 1000);

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
