import { Worker, Job } from 'bullmq';
import { createBullMQConnection } from '../config/redis';
import prisma from '../config/database';
import { logger } from '../config/logger';
import { notificationQueue, aiAnalysisQueue } from '../queues/notification.queue';
import type { WebhookJobData } from '../queues/webhook.queue';
import { RunStatus, Conclusion } from '@prisma/client';
import { emitPipelineUpdate } from '../socket/socket.server';

/**
 * Webhook Worker
 *
 * Processes GitHub webhook events from the queue and translates them
 * into BuildPulse database records.
 *
 * WHY separate handlers per event type:
 * GitHub sends many event types (workflow_run, workflow_job, push,
 * deployment). Separating handlers keeps each function small and
 * independently testable. Adding a new event type = adding one function.
 *
 * Supported GitHub events:
 * - workflow_run: Pipeline run started/completed (main event)
 * - workflow_job:  Individual job within a run started/completed
 * - deployment:    Deployment created
 * - deployment_status: Deployment status changed
 * - ping:          GitHub webhook registration confirmation
 */
export const createWebhookWorker = () => {
  const worker = new Worker<WebhookJobData>(
    'webhooks',
    async (job: Job<WebhookJobData>) => {
      const { eventType, payload, repoId, deliveryId } = job.data;

      logger.info(`[WebhookWorker] Processing: event=${eventType} delivery=${deliveryId}`);

      switch (eventType) {
        case 'workflow_run':
          await handleWorkflowRun(payload, repoId);
          break;
        case 'workflow_job':
          await handleWorkflowJob(payload, repoId);
          break;
        case 'deployment':
          await handleDeployment(payload, repoId);
          break;
        case 'deployment_status':
          await handleDeploymentStatus(payload, repoId);
          break;
        case 'ping':
          logger.info(`[WebhookWorker] Ping received from GitHub for repo: ${payload?.repository?.full_name}`);
          break;
        default:
          logger.debug(`[WebhookWorker] Unhandled event type: ${eventType}`);
      }
    },
    {
      connection: createBullMQConnection(),
      concurrency: 5, // Process 5 jobs simultaneously
    }
  );

  worker.on('completed', (job) =>
    logger.info(`[WebhookWorker] Job ${job.id} completed`)
  );

  worker.on('failed', (job, err) =>
    logger.error(`[WebhookWorker] Job ${job?.id} failed`, { err: err.message })
  );

  worker.on('error', (err) =>
    logger.error('[WebhookWorker] Worker error', { err })
  );

  logger.info('[WebhookWorker] Started');
  return worker;
};

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * workflow_run: A GitHub Actions workflow run started or completed.
 *
 * This is the PRIMARY event that drives all pipeline data in BuildPulse.
 * GitHub sends this with action: 'requested' | 'in_progress' | 'completed'
 */
async function handleWorkflowRun(payload: any, repoId: string) {
  const run = payload.workflow_run;
  const workflow = payload.workflow;
  const action = payload.action as 'requested' | 'in_progress' | 'completed';

  if (!run) return;

  // Upsert the pipeline (workflow definition)
  const pipeline = await prisma.pipeline.upsert({
    where: {
      githubWorkflowId_repositoryId: {
        githubWorkflowId: run.workflow_id,
        repositoryId: repoId,
      },
    },
    update: { name: run.name, state: 'active' },
    create: {
      githubWorkflowId: run.workflow_id,
      name: run.name,
      path: workflow?.path ?? `.github/workflows/${run.name}`,
      repositoryId: repoId,
    },
  });

  // Map GitHub status/conclusion to our enums
  const status = mapRunStatus(run.status);
  const conclusion = run.conclusion ? mapConclusion(run.conclusion) : null;

  // Upsert the run record
  const pipelineRun = await prisma.pipelineRun.upsert({
    where: { githubRunId: BigInt(run.id) },
    update: {
      status,
      conclusion: conclusion ?? undefined,
      completedAt: run.updated_at ? new Date(run.updated_at) : undefined,
      durationMs: run.run_started_at && run.updated_at && conclusion
        ? new Date(run.updated_at).getTime() - new Date(run.run_started_at).getTime()
        : undefined,
    },
    create: {
      githubRunId: BigInt(run.id),
      pipelineId: pipeline.id,
      branch: run.head_branch ?? 'unknown',
      commitSha: run.head_sha,
      commitMessage: run.head_commit?.message?.split('\n')[0] ?? null,
      eventType: run.event ?? 'push',
      status,
      conclusion: conclusion ?? undefined,
      htmlUrl: run.html_url,
      startedAt: run.run_started_at ? new Date(run.run_started_at) : null,
      completedAt: run.updated_at && conclusion ? new Date(run.updated_at) : null,
      attemptNumber: run.run_attempt ?? 1,
    },
  });

  logger.info(`[WebhookWorker] workflow_run upserted: id=${pipelineRun.id} action=${action} conclusion=${conclusion}`);

  // Emit real-time update to socket subscribers
  emitPipelineUpdate(repoId, {
    ...pipelineRun,
    githubRunId: pipelineRun.githubRunId.toString(),
    pipeline: {
      id: pipeline.id,
      name: pipeline.name,
      path: pipeline.path,
    },
  });

  // If run completed — trigger downstream jobs
  if (action === 'completed' && conclusion) {
    // Fetch and store build logs
    let logContent = '';
    try {
      const { fetchWorkflowRunLogs } = await import('../shared/utils/github');
      const repo = await prisma.repository.findUnique({ where: { id: repoId } });
      if (repo) {
        logContent = await fetchWorkflowRunLogs(repo.fullName, run.id);
        await prisma.buildLog.create({
          data: {
            pipelineRunId: pipelineRun.id,
            content: logContent,
          },
        });
        
        // Stream the logs to socket subscribers
        const { emitLogChunk } = await import('../socket/socket.server');
        emitLogChunk(pipelineRun.id, logContent);
      }
    } catch (err: any) {
      logger.error(`[WebhookWorker] Failed to fetch/store logs: ${err.message}`);
    }

    // Trigger AI analysis only on failures
    if (conclusion === 'FAILURE' || conclusion === 'TIMED_OUT') {
      await aiAnalysisQueue.add(
        'analyze-failure',
        {
          pipelineRunId: pipelineRun.id,
          repositoryId: repoId,
          failureLogs: logContent, // Pass the fetched logs directly
          workflowName: run.name,
          branch: run.head_branch,
        },
        { delay: 2000 } // Small delay to let GitHub process logs
      );
      logger.info(`[WebhookWorker] AI analysis queued for failed run: ${pipelineRun.id}`);
    }

    // Trigger notifications
    const notifType = conclusion === 'SUCCESS' ? 'success'
      : conclusion === 'FAILURE' ? 'failure'
      : null;

    if (notifType) {
      await notificationQueue.add('notify', {
        type: notifType,
        repositoryId: repoId,
        pipelineRunId: pipelineRun.id,
        metadata: {
          branch: run.head_branch,
          commitSha: run.head_sha,
          workflowName: run.name,
          htmlUrl: run.html_url,
        },
      });
    }

    // Recompute health score asynchronously (non-blocking)
    prisma.repository
      .findUnique({ where: { id: repoId } })
      .then(async (repo) => {
        if (!repo) return;
        const { repositoriesService } = await import('../modules/repositories/repositories.service');
        await repositoriesService.computeHealthScore(repoId);
      })
      .catch((err) =>
        logger.error('[WebhookWorker] Health score update failed', { err })
      );
  }
}

/**
 * workflow_job: A job within a workflow run started or completed.
 * Tracks individual job status and steps for the timeline view.
 */
async function handleWorkflowJob(payload: any, repoId: string) {
  const job = payload.workflow_job;
  const action = payload.action;

  if (!job) return;

  // Find the parent pipeline run
  const pipelineRun = await prisma.pipelineRun.findUnique({
    where: { githubRunId: BigInt(job.run_id) },
  });

  if (!pipelineRun) {
    logger.debug(`[WebhookWorker] Parent run not found for job: ${job.id}`);
    return;
  }

  const status = mapRunStatus(job.status);
  const conclusion = job.conclusion ? mapConclusion(job.conclusion) : null;

  await prisma.buildJob.upsert({
    where: { githubJobId: BigInt(job.id) },
    update: {
      status,
      conclusion: conclusion ?? undefined,
      completedAt: job.completed_at ? new Date(job.completed_at) : undefined,
      durationMs:
        job.started_at && job.completed_at && conclusion
          ? new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
          : undefined,
    },
    create: {
      githubJobId: BigInt(job.id),
      pipelineRunId: pipelineRun.id,
      name: job.name,
      runnerId: job.runner_id ?? null,
      runnerName: job.runner_name ?? null,
      status,
      conclusion: conclusion ?? undefined,
      startedAt: job.started_at ? new Date(job.started_at) : null,
      completedAt: job.completed_at ? new Date(job.completed_at) : null,
    },
  });

  // Upsert steps if available
  if (job.steps?.length) {
    const buildJob = await prisma.buildJob.findUnique({
      where: { githubJobId: BigInt(job.id) },
    });
    if (!buildJob) return;

    // Delete and re-insert steps (simpler than upsert for ordered list)
    if (action === 'completed') {
      await prisma.buildStep.deleteMany({ where: { jobId: buildJob.id } });
      await prisma.buildStep.createMany({
        data: job.steps.map((step: any) => ({
          jobId: buildJob.id,
          name: step.name,
          number: step.number,
          status: mapRunStatus(step.status),
          conclusion: step.conclusion ? mapConclusion(step.conclusion) : null,
          startedAt: step.started_at ? new Date(step.started_at) : null,
          completedAt: step.completed_at ? new Date(step.completed_at) : null,
        })),
      });
    }
  }

  logger.info(`[WebhookWorker] workflow_job processed: ${job.name} (${action})`);
}

/**
 * deployment: A deployment was created on GitHub.
 */
async function handleDeployment(payload: any, repoId: string) {
  const dep = payload.deployment;
  if (!dep) return;

  await prisma.deployment.create({
    data: {
      repositoryId: repoId,
      environment: dep.environment ?? 'production',
      status: 'PENDING',
      version: dep.ref,
      commitSha: dep.sha,
      commitMessage: dep.description ?? null,
      deployedBy: payload.sender?.login ?? null,
      metadata: { githubDeploymentId: dep.id },
    },
  });
  logger.info(`[WebhookWorker] Deployment created: env=${dep.environment}`);
}

/**
 * deployment_status: Status changed for an existing deployment.
 */
async function handleDeploymentStatus(payload: any, repoId: string) {
  const status = payload.deployment_status;
  const dep = payload.deployment;
  if (!status || !dep) return;

  const deploymentStatus = mapDeploymentStatus(status.state);

  await prisma.deployment.updateMany({
    where: {
      repositoryId: repoId,
      metadata: { path: ['githubDeploymentId'], equals: dep.id },
    },
    data: {
      status: deploymentStatus,
      completedAt: status.state !== 'pending' ? new Date() : undefined,
    },
  });
  logger.info(`[WebhookWorker] Deployment status: ${status.state}`);
}

// =============================================================================
// ENUM MAPPERS
// =============================================================================

function mapRunStatus(status: string): RunStatus {
  switch (status) {
    case 'queued': return 'QUEUED';
    case 'in_progress': return 'IN_PROGRESS';
    case 'completed': return 'COMPLETED';
    case 'waiting': return 'WAITING';
    default: return 'QUEUED';
  }
}

function mapConclusion(conclusion: string): Conclusion {
  switch (conclusion) {
    case 'success': return 'SUCCESS';
    case 'failure': return 'FAILURE';
    case 'cancelled': return 'CANCELLED';
    case 'skipped': return 'SKIPPED';
    case 'timed_out': return 'TIMED_OUT';
    case 'neutral': return 'NEUTRAL';
    case 'action_required': return 'ACTION_REQUIRED';
    default: return 'NEUTRAL';
  }
}

function mapDeploymentStatus(state: string) {
  switch (state) {
    case 'success': return 'ACTIVE' as const;
    case 'failure': case 'error': return 'FAILED' as const;
    case 'inactive': return 'INACTIVE' as const;
    case 'destroyed': return 'DESTROYED' as const;
    default: return 'PENDING' as const;
  }
}
