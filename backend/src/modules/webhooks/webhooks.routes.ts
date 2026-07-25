import { Router } from 'express';
import { webhooksController } from './webhooks.controller';
import { verifyGithubWebhook } from './webhook.middleware';
import { webhookRateLimiter } from '../../shared/middleware/rateLimiter';

const router = Router();

/**
 * GitHub Webhook Listener Route
 *
 * NOTE: verifyGithubWebhook is placed before parsing json in main app.ts.
 * We configured app.use('/api/webhooks/github', express.raw({ type: 'application/json' }))
 * in app.ts to ensure verifyGithubWebhook receives raw buffer.
 */
router.post(
  '/github',
  webhookRateLimiter,
  verifyGithubWebhook,
  webhooksController.handleGithub
);

export default router;
