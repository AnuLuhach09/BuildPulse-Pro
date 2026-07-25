import axios from 'axios';
import crypto from 'crypto';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  AppError,
  NotFoundError,
  ConflictError,
} from '../../shared/errors/AppError';
import {
  parsePagination,
  getPrismaSkipTake,
  paginate,
} from '../../shared/utils/paginate';
import type { ConnectRepoDTO, RepoQueryDTO } from './repositories.schemas';

/**
 * GitHub REST API client (unauthenticated for public repos,
 * token-authenticated for private repos and webhook management)
 */
const githubApi = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(env.GITHUB_APP_TOKEN
      ? { Authorization: `Bearer ${env.GITHUB_APP_TOKEN}` }
      : {}),
  },
  timeout: 15_000,
});

/**
 * Repositories Service
 *
 * WHY we generate the webhook secret per-repo:
 * Each repository gets its own HMAC secret so that if one secret
 * is compromised, it only affects that single repo — not all repos.
 * This is the GitHub-recommended pattern.
 */
export class RepositoriesService {
  /**
   * Connect a GitHub repository to BuildPulse.
   * Steps:
   * 1. Fetch repo metadata from GitHub API
   * 2. Generate per-repo webhook secret
   * 3. Register a webhook on GitHub pointing to our /webhooks/github endpoint
   * 4. Persist the repository record with webhook details
   * 5. Add the connecting user as OWNER
   */
  async connect(dto: ConnectRepoDTO, userId: string) {
    // Check if already connected
    const existing = await prisma.repository.findUnique({
      where: { fullName: dto.fullName },
    });
    if (existing) throw ConflictError('Repository is already connected');

    // 1. Fetch repo metadata from GitHub
    let ghRepo: any;
    try {
      const res = await githubApi.get(`/repos/${dto.fullName}`);
      ghRepo = res.data;
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 404)
        throw NotFoundError(`GitHub repository "${dto.fullName}"`);
      if (status === 403)
        throw new AppError('GitHub API rate limit hit or private repo requires a token', 403, 'GITHUB_FORBIDDEN');
      throw new AppError('Failed to fetch repository from GitHub', 502, 'GITHUB_ERROR');
    }

    // 2. Generate a unique webhook secret for this repo
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // 3. Register webhook on GitHub (only if a token is configured)
    let webhookId: number | undefined;
    if (env.GITHUB_APP_TOKEN) {
      try {
        const webhookPayload = {
          name: 'web',
          active: true,
          events: ['workflow_run', 'workflow_job', 'push', 'deployment'],
          config: {
            url: `${env.FRONTEND_URL.replace(':3000', ':4000')}/api/v1/webhooks/github`,
            content_type: 'json',
            secret: webhookSecret,
            insecure_ssl: '0',
          },
        };
        const webhookRes = await githubApi.post(
          `/repos/${dto.fullName}/hooks`,
          webhookPayload
        );
        webhookId = webhookRes.data.id;
        logger.info(`[Repos] Webhook registered on GitHub: id=${webhookId}`);
      } catch (err: any) {
        // Non-fatal — user can manually configure the webhook
        logger.warn(`[Repos] Could not auto-register webhook: ${err.message}`);
      }
    }

    // 4. Persist repository
    const repository = await prisma.repository.create({
      data: {
        githubId: ghRepo.id,
        name: ghRepo.name,
        fullName: ghRepo.full_name,
        description: ghRepo.description ?? null,
        url: ghRepo.html_url,
        defaultBranch: ghRepo.default_branch ?? 'main',
        isPrivate: ghRepo.private,
        language: ghRepo.language ?? null,
        topics: ghRepo.topics ?? [],
        webhookId: webhookId ?? null,
        webhookSecret,
        healthScore: 0,
        // 5. Add owner
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
      include: { members: true },
    });

    logger.info(`[Repos] Connected: ${repository.fullName} by user=${userId}`);
    return this.sanitizeRepo(repository);
  }

  /**
   * List all repositories the user is a member of.
   */
  async list(userId: string, query: RepoQueryDTO) {
    const pagination = parsePagination(query);
    const where = {
      members: { some: { userId } },
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { fullName: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [repos, total] = await Promise.all([
      prisma.repository.findMany({
        where,
        ...getPrismaSkipTake(pagination),
        orderBy: { updatedAt: 'desc' },
        include: {
          members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          _count: { select: { pipelines: true, deployments: true } },
        },
      }),
      prisma.repository.count({ where }),
    ]);

    return paginate(repos.map(this.sanitizeRepo), total, pagination);
  }

  /**
   * Get a single repository by ID (must be member).
   */
  async getById(id: string, userId: string) {
    const repo = await prisma.repository.findFirst({
      where: { id, members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } } },
        _count: { select: { pipelines: true, deployments: true } },
      },
    });
    if (!repo) throw NotFoundError('Repository');
    return this.sanitizeRepo(repo);
  }

  /**
   * Disconnect a repository (must be OWNER).
   * Deletes the webhook from GitHub and removes all data.
   */
  async disconnect(id: string, userId: string) {
    const repo = await prisma.repository.findFirst({
      where: {
        id,
        members: { some: { userId, role: 'OWNER' } },
      },
    });
    if (!repo) throw NotFoundError('Repository or insufficient permissions');

    // Remove webhook from GitHub if it was auto-registered
    if (repo.webhookId && env.GITHUB_APP_TOKEN) {
      try {
        await githubApi.delete(`/repos/${repo.fullName}/hooks/${repo.webhookId}`);
        logger.info(`[Repos] Removed GitHub webhook: ${repo.webhookId}`);
      } catch {
        logger.warn(`[Repos] Could not remove GitHub webhook (may already be gone)`);
      }
    }

    await prisma.repository.delete({ where: { id } });
    return { message: `Repository "${repo.fullName}" disconnected` };
  }

  /**
   * Calculate and update the health score for a repository.
   *
   * Health Score Algorithm (0–100):
   * - Success rate (last 30 days): 60 points max
   * - Build frequency (active repo): 20 points max
   * - Mean time to recovery (MTTR): 10 points max
   * - Has recent deployments: 10 points max
   *
   * WHY this weighting: Success rate is the primary health signal.
   * Frequency catches repos that appear healthy just because they have
   * no builds (low activity gets partial credit, not full).
   */
  async computeHealthScore(repositoryId: string): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalRuns, successRuns, recentDeployment] = await Promise.all([
      prisma.pipelineRun.count({
        where: {
          pipeline: { repositoryId },
          createdAt: { gte: thirtyDaysAgo },
          conclusion: { not: null },
        },
      }),
      prisma.pipelineRun.count({
        where: {
          pipeline: { repositoryId },
          createdAt: { gte: thirtyDaysAgo },
          conclusion: 'SUCCESS',
        },
      }),
      prisma.deployment.findFirst({
        where: { repositoryId, deployedAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    // Success rate component (60 pts)
    const successRate = totalRuns > 0 ? successRuns / totalRuns : 0.5; // 50% baseline if no data
    const successScore = successRate * 60;

    // Frequency component (20 pts) — 10+ runs/month = full score
    const frequencyScore = Math.min(20, (totalRuns / 10) * 20);

    // Deployment component (10 pts)
    const deployScore = recentDeployment ? 10 : 0;

    // MTTR component (10 pts) — simplified: if success rate > 80%, give full points
    const mttrScore = successRate >= 0.8 ? 10 : successRate * 10;

    const score = Math.round(successScore + frequencyScore + deployScore + mttrScore);
    const bounded = Math.max(0, Math.min(100, score));

    await prisma.repository.update({
      where: { id: repositoryId },
      data: { healthScore: bounded, updatedAt: new Date() },
    });

    return bounded;
  }

  /**
   * Get manual webhook registration instructions for a repo.
   * Used when GITHUB_APP_TOKEN is not set.
   */
  async getWebhookInstructions(id: string, userId: string) {
    const repo = await prisma.repository.findFirst({
      where: { id, members: { some: { userId } } },
    });
    if (!repo) throw NotFoundError('Repository');

    return {
      webhookUrl: `${env.FRONTEND_URL.replace(':3000', ':4000')}/api/v1/webhooks/github`,
      secret: repo.webhookSecret,
      events: ['workflow_run', 'workflow_job', 'push', 'deployment'],
      contentType: 'application/json',
      instructions: [
        `Go to https://github.com/${repo.fullName}/settings/hooks`,
        'Click "Add webhook"',
        'Paste the Payload URL above',
        'Set Content type to "application/json"',
        'Paste the Secret above',
        'Select: workflow_run, workflow_job, push, deployment events',
        'Click "Add webhook"',
      ],
    };
  }

  // Strip webhookSecret from all API responses (never expose to client)
  private sanitizeRepo(repo: any) {
    const { webhookSecret: _, ...safe } = repo;
    return safe;
  }
}

export const repositoriesService = new RepositoriesService();
