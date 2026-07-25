import { Queue } from 'bullmq';
import { createBullMQConnection } from '../config/redis';
import { logger } from '../config/logger';

/**
 * Webhook Queue
 *
 * WHY a queue instead of processing inline:
 * GitHub expects a response within 10 seconds or it marks the delivery
 * as failed and retries (up to 3 times). If our pipeline processing
 * (DB writes, AI analysis triggers, notifications) takes > 10s under
 * load, we'd get duplicate event deliveries.
 *
 * By immediately enqueuing and returning 202 Accepted, we:
 * 1. Always respond to GitHub in < 100ms
 * 2. Process events durably (survive crashes — BullMQ persists to Redis)
 * 3. Can retry failed processing without re-requesting from GitHub
 * 4. Can scale workers independently from the API server
 */
export const webhookQueue = new Queue('webhooks', {
  connection: createBullMQConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: { count: 500 }, // Keep last 500 completed jobs
    removeOnFail: { count: 100 },     // Keep last 100 failed jobs
  },
});

webhookQueue.on('error', (err) =>
  logger.error('[WebhookQueue] Queue error', { err })
);

export type WebhookJobData = {
  eventType: string;
  deliveryId: string;
  repoId: string;
  payload: Record<string, any>;
  receivedAt: string;
};
