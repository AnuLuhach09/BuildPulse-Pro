import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import prisma from './config/database';
import { redis } from './config/redis';
import { createWebhookWorker } from './workers/webhook.worker';
import { createAIAnalysisWorker } from './workers/ai-analysis.worker';
import { createNotificationWorker } from './workers/notification.worker';
import { Worker } from 'bullmq';
import { initSocketServer } from './socket/socket.server';

/**
 * Server Entry Point
 *
 * WHY separate server.ts from app.ts:
 * app.ts creates the Express application (pure, testable).
 * server.ts handles the OS-level concerns: listening on a port,
 * handling OS signals for graceful shutdown, and starting background workers.
 *
 * GRACEFUL SHUTDOWN: When Kubernetes/Docker sends SIGTERM, we:
 * 1. Stop accepting new connections (server.close)
 * 2. Wait for in-flight requests to complete
 * 3. Close DB + Redis connections cleanly
 * This prevents data corruption and 502 errors during deployments.
 */
async function bootstrap(): Promise<void> {
  // Validate DB connection on startup
  try {
    await prisma.$connect();
    logger.info('✅ PostgreSQL connected');
  } catch (err) {
    logger.error('❌ PostgreSQL connection failed', { err });
    process.exit(1);
  }

  // Start BullMQ background workers
  const webhookWorker = createWebhookWorker();
  const aiAnalysisWorker = createAIAnalysisWorker();
  const notificationWorker = createNotificationWorker();

  const app = createApp();
  const server = http.createServer(app);

  // Initialize WebSockets
  initSocketServer(server);

  server.listen(env.PORT, () => {
    logger.info(`🚀 BuildPulse API running on port ${env.PORT}`);
    logger.info(`📖 Environment: ${env.NODE_ENV}`);
    logger.info(`🔗 API prefix: /api/${env.API_VERSION}`);
    logger.info(`❤️  Health check: http://localhost:${env.PORT}/health`);
  });

  // ── Graceful Shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`[Shutdown] ${signal} received — starting graceful shutdown`);

    // 1. Stop accepting new HTTP connections
    server.close(async () => {
      logger.info('[Shutdown] HTTP server closed');

      // Close BullMQ workers
      logger.info('[Shutdown] Closing BullMQ workers...');
      await webhookWorker.close();
      await aiAnalysisWorker.close();
      await notificationWorker.close();
      logger.info('[Shutdown] BullMQ workers closed');

      // 2. Close DB pool
      await prisma.$disconnect();
      logger.info('[Shutdown] Prisma disconnected');

      // 3. Close Redis
      await redis.quit();
      logger.info('[Shutdown] Redis disconnected');

      logger.info('[Shutdown] Graceful shutdown complete');
      process.exit(0);
    });

    // Force kill if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('[Shutdown] Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Unhandled promise rejections — log and exit
  process.on('unhandledRejection', (reason) => {
    logger.error('[Process] Unhandled Rejection', { reason });
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    logger.error('[Process] Uncaught Exception', { err });
    process.exit(1);
  });
}

bootstrap();
