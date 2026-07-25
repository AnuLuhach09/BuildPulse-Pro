import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { createBullMQConnection } from '../config/redis';
import prisma from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import type { NotificationJobData } from '../queues/notification.queue';

/**
 * Notification Worker
 *
 * Handles Slack webhook and email (Nodemailer) notifications for:
 * - Build failures
 * - Build successes (if opted in)
 * - Deployment events
 * - Recovery (failure → success transition)
 *
 * WHY check preferences per-user:
 * Multiple users can be members of a repo with different notification
 * preferences (some want all events, some only failures).
 * We fan out to each user with their own settings.
 */
export const createNotificationWorker = () => {
  const transporter = createEmailTransporter();

  const worker = new Worker<NotificationJobData>(
    'notifications',
    async (job: Job<NotificationJobData>) => {
      const { type, repositoryId, pipelineRunId, metadata } = job.data;

      // Get all members of the repo with their notification prefs
      const members = await prisma.repositoryMember.findMany({
        where: { repositoryId },
        include: {
          user: {
            include: { notifications: true },
          },
        },
      });

      const repo = await prisma.repository.findUnique({ where: { id: repositoryId } });
      if (!repo) return;

      const run = await prisma.pipelineRun.findUnique({
        where: { id: pipelineRunId },
        include: { aiAnalysis: true },
      });

      for (const member of members) {
        const prefs = member.user.notifications;
        if (!prefs) continue;

        const shouldNotify =
          (type === 'failure' && prefs.onFailure) ||
          (type === 'success' && prefs.onSuccess) ||
          (type === 'deploy' && prefs.onDeploy) ||
          (type === 'recovery' && prefs.onRecovery);

        if (!shouldNotify) continue;

        const notifContext = {
          type,
          repo: repo.fullName,
          branch: run?.branch ?? metadata?.branch ?? 'unknown',
          commitSha: (run?.commitSha ?? metadata?.commitSha ?? '').slice(0, 7),
          workflowName: metadata?.workflowName ?? 'Unknown workflow',
          htmlUrl: run?.htmlUrl ?? metadata?.htmlUrl ?? '',
          aiSuggestion: run?.aiAnalysis?.suggestedFix ?? null,
        };

        // Email notification
        if (prefs.emailEnabled && member.user.email && transporter) {
          await sendEmail(transporter, member.user.email, notifContext).catch((err) =>
            logger.error('[NotifWorker] Email failed', { err })
          );
        }

        // Slack notification
        if (prefs.slackEnabled && prefs.slackWebhook) {
          await sendSlack(prefs.slackWebhook, notifContext).catch((err) =>
            logger.error('[NotifWorker] Slack failed', { err })
          );
        }
      }

      // Global Slack webhook (if configured)
      if (env.SLACK_DEFAULT_WEBHOOK_URL && (type === 'failure' || type === 'deploy')) {
        const notifContext = {
          type, repo: repo.fullName,
          branch: run?.branch ?? metadata?.branch ?? 'unknown',
          commitSha: (run?.commitSha ?? '').slice(0, 7),
          workflowName: metadata?.workflowName ?? '',
          htmlUrl: run?.htmlUrl ?? '',
          aiSuggestion: run?.aiAnalysis?.suggestedFix ?? null,
        };
        await sendSlack(env.SLACK_DEFAULT_WEBHOOK_URL, notifContext).catch(() => {});
      }

      logger.info(`[NotifWorker] Notifications sent: type=${type} repo=${repo.fullName}`);
    },
    {
      connection: createBullMQConnection(),
      concurrency: 3,
    }
  );

  worker.on('failed', (job, err) =>
    logger.error(`[NotifWorker] Job ${job?.id} failed`, { err: err.message })
  );

  logger.info('[NotifWorker] Started');
  return worker;
};

// =============================================================================
// EMAIL
// =============================================================================

function createEmailTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    logger.warn('[NotifWorker] SMTP not configured — email notifications disabled');
    return null;
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

async function sendEmail(transporter: any, to: string, ctx: any) {
  const icon = ctx.type === 'failure' ? '❌' : ctx.type === 'success' ? '✅' : '🚀';
  const subject = `${icon} BuildPulse: ${ctx.workflowName} ${ctx.type} on ${ctx.repo}`;

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #4f46e5; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 18px;">⚡ BuildPulse Pro</h1>
      </div>
      <div style="background: #111118; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #232334;">
        <h2 style="color: white; margin-top: 0;">${icon} ${ctx.workflowName} ${ctx.type}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="color: #5a5a7a; padding: 4px 0; width: 120px;">Repository</td><td style="color: white;">${ctx.repo}</td></tr>
          <tr><td style="color: #5a5a7a; padding: 4px 0;">Branch</td><td style="color: white;">${ctx.branch}</td></tr>
          <tr><td style="color: #5a5a7a; padding: 4px 0;">Commit</td><td style="color: #818cf8; font-family: monospace;">${ctx.commitSha}</td></tr>
        </table>
        ${ctx.aiSuggestion ? `
          <div style="background: #1a1a27; border-left: 3px solid #4f46e5; padding: 12px; margin-top: 16px; border-radius: 4px;">
            <p style="color: #a5b4fc; font-size: 12px; margin: 0 0 6px; font-weight: 600;">🤖 AI SUGGESTED FIX</p>
            <p style="color: #e0e7ff; margin: 0; font-size: 14px;">${ctx.aiSuggestion}</p>
          </div>
        ` : ''}
        <a href="${ctx.htmlUrl}" style="display: inline-block; margin-top: 16px; background: #4f46e5; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px;">View Build →</a>
      </div>
    </div>`;

  await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });
  logger.info(`[NotifWorker] Email sent to ${to}`);
}

// =============================================================================
// SLACK
// =============================================================================

async function sendSlack(webhookUrl: string, ctx: any) {
  const color = ctx.type === 'failure' ? '#ef4444'
    : ctx.type === 'success' ? '#22c55e'
    : '#6366f1';

  const icon = ctx.type === 'failure' ? ':x:' : ctx.type === 'success' ? ':white_check_mark:' : ':rocket:';

  const blocks: any[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${icon} *${ctx.workflowName}* ${ctx.type} on \`${ctx.repo}\``,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Branch:*\n\`${ctx.branch}\`` },
        { type: 'mrkdwn', text: `*Commit:*\n\`${ctx.commitSha}\`` },
      ],
    },
  ];

  if (ctx.aiSuggestion) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🤖 AI Suggested Fix:*\n${ctx.aiSuggestion}`,
      },
    });
  }

  blocks.push({
    type: 'actions',
    elements: [{
      type: 'button',
      text: { type: 'plain_text', text: 'View Build' },
      url: ctx.htmlUrl,
      style: 'primary',
    }],
  });

  await axios.post(webhookUrl, {
    attachments: [{ color, blocks }],
  });

  logger.info('[NotifWorker] Slack message sent');
}
