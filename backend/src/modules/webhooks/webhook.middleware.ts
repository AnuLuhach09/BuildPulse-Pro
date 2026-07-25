import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../../config/database';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../config/logger';

/**
 * GitHub HMAC Webhook Signature Validator
 *
 * WHY HMAC-SHA256 and NOT just checking a secret header:
 * A simple shared secret in a header can be replayed by anyone who
 * captures the header. HMAC-SHA256 signs the ENTIRE request body
 * with the secret, so:
 * 1. Replaying a valid payload still requires knowing the secret
 * 2. Tampering with the body invalidates the signature
 * 3. Each repo has its OWN secret — breach of one doesn't affect others
 *
 * WHY `crypto.timingSafeEqual`:
 * A naive `===` string comparison leaks timing information
 * (it stops comparing at the first mismatch). timingSafeEqual always
 * takes the same amount of time regardless of where the mismatch is,
 * preventing timing-based signature oracle attacks.
 *
 * IMPORTANT: app.ts must parse this route with express.raw() BEFORE
 * express.json() — HMAC is computed on the raw bytes, not parsed JSON.
 */
export const verifyGithubWebhook = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const deliveryId = req.headers['x-github-delivery'] as string;
    const eventType = req.headers['x-github-event'] as string;

    if (!signature) {
      return next(new AppError('Missing X-Hub-Signature-256 header', 401, 'MISSING_SIGNATURE'));
    }

    // Raw body required — app.ts sets this up with express.raw()
    const rawBody = req.body as Buffer;
    if (!Buffer.isBuffer(rawBody)) {
      return next(new AppError('Raw body not available — check middleware order', 500, 'RAW_BODY_ERROR'));
    }

    // Extract repo info from payload to look up per-repo secret
    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return next(new AppError('Invalid JSON in webhook payload', 400, 'INVALID_PAYLOAD'));
    }

    const repoFullName: string = payload?.repository?.full_name;
    if (!repoFullName) {
      // Some events (e.g. ping) don't have repository — use global secret
      const isValid = verifySignature(rawBody, process.env.GITHUB_WEBHOOK_SECRET ?? '', signature);
      if (!isValid) return next(new AppError('Invalid webhook signature', 401, 'INVALID_SIGNATURE'));
      req.body = payload;
      return next();
    }

    // Look up per-repo webhook secret
    const repo = await prisma.repository.findUnique({
      where: { fullName: repoFullName },
      select: { id: true, webhookSecret: true },
    });

    if (!repo) {
      // Repo not connected — silently accept (200) so GitHub doesn't retry
      logger.warn(`[Webhook] Received event for unregistered repo: ${repoFullName}`);
      req.body = null; // Signal to handler to skip processing
      return next();
    }

    // Verify HMAC signature
    const isValid = verifySignature(rawBody, repo.webhookSecret, signature);
    if (!isValid) {
      logger.warn(`[Webhook] Invalid signature for repo: ${repoFullName} (deliveryId=${deliveryId})`);
      logger.warn(`Content-Type: ${req.headers['content-type']}`);
      logger.warn(`Content-Length: ${req.headers['content-length']}`);
      logger.warn(`Buffer Length: ${rawBody.length}`);
      return next(new AppError('Invalid webhook signature', 401, 'INVALID_SIGNATURE'));
    }

    // Attach parsed payload + metadata to request
    req.body = payload;
    (req as any).webhookMeta = { repoId: repo.id, eventType, deliveryId };

    logger.info(`[Webhook] ✅ Verified: event=${eventType} repo=${repoFullName} delivery=${deliveryId}`);
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * HMAC-SHA256 signature verification using timing-safe comparison.
 */
function verifySignature(body: Buffer, secret: string, header: string): boolean {
  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(header, 'utf8')
    );
  } catch {
    // Buffers of different lengths — signatures definitely don't match
    return false;
  }
}
