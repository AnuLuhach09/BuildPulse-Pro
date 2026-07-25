import prisma from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError';
import {
  parsePagination,
  getPrismaSkipTake,
  paginate,
} from '../../shared/utils/paginate';
import type { PipelineQueryDTO } from './pipelines.schemas';

export class PipelinesService {
  /**
   * List pipeline runs with filtering and pagination.
   * Only returns runs for repositories the user is authorized to view.
   */
  async listRuns(userId: string, query: PipelineQueryDTO) {
    const pagination = parsePagination(query);

    // Get list of repository IDs the user is a member of
    const userRepos = await prisma.repositoryMember.findMany({
      where: { userId },
      select: { repositoryId: true },
    });
    const repoIds = userRepos.map((r) => r.repositoryId);

    // If repositoryId is specified in filter, ensure user is a member
    if (query.repositoryId && !repoIds.includes(query.repositoryId)) {
      throw ForbiddenError('You do not have access to this repository');
    }

    const where: any = {
      pipeline: {
        repositoryId: query.repositoryId
          ? query.repositoryId
          : { in: repoIds },
      },
      ...(query.status ? { status: query.status } : {}),
      ...(query.conclusion ? { conclusion: query.conclusion } : {}),
      ...(query.branch ? { branch: query.branch } : {}),
      ...(query.search
        ? {
            OR: [
              { commitMessage: { contains: query.search, mode: 'insensitive' } },
              { commitSha: { contains: query.search, mode: 'insensitive' } },
              { pipeline: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [runs, total] = await Promise.all([
      prisma.pipelineRun.findMany({
        where,
        ...getPrismaSkipTake(pagination),
        orderBy: { createdAt: 'desc' },
        include: {
          pipeline: {
            select: {
              id: true,
              name: true,
              path: true,
              repository: {
                select: {
                  id: true,
                  name: true,
                  fullName: true,
                },
              },
            },
          },
          triggeredBy: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.pipelineRun.count({ where }),
    ]);

    // Parse BigInt (githubRunId) to String for JSON serialization safety
    const sanitizedRuns = runs.map((run) => ({
      ...run,
      githubRunId: run.githubRunId.toString(),
    }));

    return paginate(sanitizedRuns, total, pagination);
  }

  /**
   * Get single pipeline run detail with jobs, steps, and AI analysis.
   */
  async getRunById(id: string, userId: string) {
    const run = await prisma.pipelineRun.findUnique({
      where: { id },
      include: {
        pipeline: {
          include: {
            repository: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
        jobs: {
          orderBy: { startedAt: 'asc' },
          include: {
            steps: {
              orderBy: { number: 'asc' },
            },
          },
        },
        aiAnalysis: true,
        triggeredBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!run) throw NotFoundError('Pipeline run');

    // Check user membership
    const isMember = run.pipeline.repository.members.length > 0;
    if (!isMember) {
      throw ForbiddenError('You do not have access to this pipeline run');
    }

    // Clean up repo members representation in returned payload
    const { pipeline, ...runDetails } = run;
    const { repository, ...pipelineDetails } = pipeline;
    const { members, ...repoDetails } = repository;

    return {
      ...runDetails,
      githubRunId: run.githubRunId.toString(),
      jobs: run.jobs.map((job) => ({
        ...job,
        githubJobId: job.githubJobId.toString(),
      })),
      pipeline: {
        ...pipelineDetails,
        repository: repoDetails,
      },
    };
  }

  /**
   * Get current build queue (running or queued pipelines) for authorized repos.
   */
  async getQueue(userId: string) {
    const userRepos = await prisma.repositoryMember.findMany({
      where: { userId },
      select: { repositoryId: true },
    });
    const repoIds = userRepos.map((r) => r.repositoryId);

    const activeRuns = await prisma.pipelineRun.findMany({
      where: {
        pipeline: { repositoryId: { in: repoIds } },
        status: { in: ['QUEUED', 'IN_PROGRESS'] },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        pipeline: {
          select: {
            name: true,
            repository: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    return activeRuns.map((run) => ({
      id: run.id,
      githubRunId: run.githubRunId.toString(),
      pipelineName: run.pipeline.name,
      repoFullName: run.pipeline.repository.fullName,
      branch: run.branch,
      commitSha: run.commitSha,
      commitMessage: run.commitMessage,
      status: run.status,
      createdAt: run.createdAt,
    }));
  }

  /**
   * Get logs for a pipeline run.
   */
  async getLogs(runId: string, userId: string) {
    // Check access first
    const run = await prisma.pipelineRun.findUnique({
      where: { id: runId },
      select: {
        pipeline: {
          select: {
            repository: {
              select: {
                members: {
                  where: { userId },
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!run) throw NotFoundError('Pipeline run');
    if (run.pipeline.repository.members.length === 0) {
      throw ForbiddenError('You do not have access to this pipeline run');
    }

    const logs = await prisma.buildLog.findMany({
      where: { pipelineRunId: runId },
      orderBy: { createdAt: 'asc' },
    });

    return logs;
  }

  /**
   * Simulate pushing a code-fix commit and re-triggering a failed pipeline run (Self-Healing Demo).
   */
  async simulateFix(runId: string, userId: string) {
    const run = await prisma.pipelineRun.findUnique({
      where: { id: runId },
      include: {
        pipeline: {
          include: {
            repository: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
        jobs: {
          include: { steps: true },
        },
        aiAnalysis: true,
      },
    });

    if (!run) throw NotFoundError('Pipeline run');
    const isMember = run.pipeline.repository.members.length > 0;
    if (!isMember) {
      throw ForbiddenError('You do not have access to this pipeline run');
    }

    // 1. Reset status to IN_PROGRESS, reset completing date, change commit info to simulate bot patch
    const originalSha = run.commitSha;
    const patchedSha = originalSha.slice(0, 4) + 'f1x'; // custom patch sha
    const patchedMsg = `🤖 buildpulse-bot: fix/ai-autopilot — ${run.commitMessage || 'fix build errors'}`;

    const updatedRun = await prisma.pipelineRun.update({
      where: { id: runId },
      data: {
        status: 'IN_PROGRESS',
        conclusion: null,
        commitSha: patchedSha,
        commitMessage: patchedMsg,
        startedAt: new Date(),
        completedAt: null,
        durationMs: null,
      },
      include: {
        pipeline: {
          select: {
            name: true,
            repository: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    // Reset Jobs & Steps
    for (const job of run.jobs) {
      await prisma.buildJob.update({
        where: { id: job.id },
        data: {
          status: 'IN_PROGRESS',
          conclusion: null,
          startedAt: new Date(),
          completedAt: null,
        },
      });

      for (const step of job.steps) {
        await prisma.buildStep.update({
          where: { id: step.id },
          data: {
            status: step.number <= 2 ? 'COMPLETED' : 'IN_PROGRESS',
            conclusion: step.number <= 2 ? 'SUCCESS' : null,
            startedAt: new Date(),
            completedAt: null,
          },
        });
      }
    }

    // Clear old logs and write initial simulation log
    await prisma.buildLog.deleteMany({ where: { pipelineRunId: runId } });
    await prisma.buildLog.create({
      data: {
        pipelineRunId: runId,
        content: `Checking patch validation for commit ${patchedSha}...\n` +
                 `🔄 Re-triggering BuildPulse AI Autopilot (Self-Healing module v1.0.0)\n` +
                 `⚡ Applying suggested code fix for files: ${run.aiAnalysis?.affectedFiles?.join(', ') || 'configs'}\n` +
                 `🚀 Spinning up self-hosted builder runner environment...\n`,
      },
    });

    // Notify client via websocket
    const { emitPipelineUpdate, emitToRoom } = require('../../socket/socket.server');
    const sanitizedRun = {
      ...updatedRun,
      githubRunId: updatedRun.githubRunId.toString(),
    };
    emitPipelineUpdate(updatedRun.pipeline.repository.id, sanitizedRun);
    emitToRoom(`run:${runId}`, 'pipeline:update', sanitizedRun);
    emitToRoom(`run:${runId}`, 'log:chunk', {
      runId,
      content: `⚡ AI Autopilot: Patch successfully applied to codebase. Commencing fresh CI verification run...\n`,
      createdAt: new Date(),
    });

    // 2. Queue simulated completion after 5 seconds in background
    setTimeout(async () => {
      try {
        const finalRun = await prisma.pipelineRun.update({
          where: { id: runId },
          data: {
            status: 'COMPLETED',
            conclusion: 'SUCCESS',
            completedAt: new Date(),
            durationMs: 5000,
          },
          include: {
            pipeline: {
              select: {
                name: true,
                repository: {
                  select: {
                    id: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        });

        // Set all jobs/steps to success
        const dbJobs = await prisma.buildJob.findMany({ where: { pipelineRunId: runId } });
        for (const job of dbJobs) {
          await prisma.buildJob.update({
            where: { id: job.id },
            data: {
              status: 'COMPLETED',
              conclusion: 'SUCCESS',
              completedAt: new Date(),
              durationMs: 5000,
            },
          });

          await prisma.buildStep.updateMany({
            where: { jobId: job.id },
            data: {
              status: 'COMPLETED',
              conclusion: 'SUCCESS',
              completedAt: new Date(),
            },
          });
        }

        // Add final logs
        await prisma.buildLog.create({
          data: {
            pipelineRunId: runId,
            content: `🧪 Running integration test validation...\n` +
                     `✅ All test assertions PASSED.\n` +
                     `🎉 Build validation SUCCESSFUL! Self-healing verification complete.\n` +
                     `🚀 Deployment payload prepared and forwarded to production environment.\n`,
          },
        });

        const finalSanitized = {
          ...finalRun,
          githubRunId: finalRun.githubRunId.toString(),
        };

        // Notify client via sockets
        emitPipelineUpdate(finalRun.pipeline.repository.id, finalSanitized);
        emitToRoom(`run:${runId}`, 'pipeline:update', finalSanitized);
        emitToRoom(`run:${runId}`, 'log:chunk', {
          runId,
          content: `🎉 Build verification PASSED. Self-healing resolution verified!\n`,
          createdAt: new Date(),
        });
      } catch (e) {
        console.error('[Simulation] Background completion failed', e);
      }
    }, 5000);

    return sanitizedRun;
  }
}

export const pipelinesService = new PipelinesService();
