import { Request, Response } from 'express';
import { webhookQueue } from '../../queues/webhook.queue';
import { asyncHandler } from '../../shared/middleware/validateRequest';
import { logger } from '../../config/logger';

/**
 * Webhooks Controller
 *
 * RESPONSIBILITY: Receives verified webhook requests, pushes them directly
 * to the BullMQ webhook queue, and returns an immediate response.
 *
 * WHY 202 Accepted: This tells GitHub that we received the event and
 * intend to process it, but the actual work will happen asynchronously.
 * This ensures we conform to GitHub's requirement to respond in < 10 seconds.
 */
export const webhooksController = {
  handleGithub: asyncHandler(async (req: Request, res: Response) => {
    // If verifyGithubWebhook middleware set body to null, it means the repo
    // is not connected to our system. We silently return 200 OK so GitHub
    // does not flag it as an error or keep retrying.
    if (req.body === null) {
      res.status(200).json({
        success: true,
        message: 'Webhook received but repository is not connected. Ignored.',
      });
      return;
    }

    const { repoId, eventType, deliveryId } = (req as any).webhookMeta;

    // Enqueue the payload for background processing
    await webhookQueue.add('process-webhook', {
      eventType,
      deliveryId,
      repoId,
      payload: req.body,
      receivedAt: new Date().toISOString(),
    });

    logger.debug(`[Webhooks] Enqueued GitHub event: ${eventType}, delivery: ${deliveryId}`);

    res.status(202).json({
      success: true,
      message: 'Webhook payload queued successfully',
      deliveryId,
    });
  }),
};
