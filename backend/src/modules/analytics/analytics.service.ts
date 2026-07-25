import prisma from '../../config/database';
import { redis } from '../../config/redis';
import { logger } from '../../config/logger';
import { ForbiddenError } from '../../shared/errors/AppError';
import type { AnalyticsQueryDTO } from './analytics.schemas';

const CACHE_TTL = 300; // 5 minutes cache

export class AnalyticsService {
  /**
   * Helper to ensure user is member of repo, or get all user's repo IDs.
   */
  private async getAuthorizedRepoIds(userId: string, repositoryId?: string): Promise<string[]> {
    const userRepos = await prisma.repositoryMember.findMany({
      where: { userId },
      select: { repositoryId: true },
    });
    const repoIds = userRepos.map((r) => r.repositoryId);

    if (repositoryId) {
      if (!repoIds.includes(repositoryId)) {
        throw ForbiddenError('You do not have access to this repository');
      }
      return [repositoryId];
    }
    return repoIds;
  }

  /**
   * Helper to get/set Redis cache for analytics queries.
   */
  private async withCache<T>(cacheKey: string, queryFn: () => Promise<T>): Promise<T> {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug(`[AnalyticsCache] HIT for key: ${cacheKey}`);
        return JSON.parse(cached) as T;
      }
    } catch (err: any) {
      logger.warn(`[AnalyticsCache] Redis get failed: ${err.message}`);
    }

    const result = await queryFn();

    try {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
      logger.debug(`[AnalyticsCache] SET for key: ${cacheKey}`);
    } catch (err: any) {
      logger.warn(`[AnalyticsCache] Redis set failed: ${err.message}`);
    }

    return result;
  }

  /**
   * KPI overview stats: total runs, success rate, average duration, failed runs
   * compared to the previous period.
   */
  async getOverview(userId: string, query: AnalyticsQueryDTO) {
    const repoIds = await this.getAuthorizedRepoIds(userId, query.repositoryId);
    const days = query.days;
    const cacheKey = `analytics:overview:${userId}:${query.repositoryId || 'all'}:${days}`;

    return this.withCache(cacheKey, async () => {
      const now = new Date();
      const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const previousStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000);

      // Current period stats
      const [totalCurrent, successCurrent, failedCurrent, avgDurationCurrentResult] = await Promise.all([
        prisma.pipelineRun.count({
          where: {
            pipeline: { repositoryId: { in: repoIds } },
            createdAt: { gte: currentStart },
          },
        }),
        prisma.pipelineRun.count({
          where: {
            pipeline: { repositoryId: { in: repoIds } },
            createdAt: { gte: currentStart },
            conclusion: 'SUCCESS',
          },
        }),
        prisma.pipelineRun.count({
          where: {
            pipeline: { repositoryId: { in: repoIds } },
            createdAt: { gte: currentStart },
            conclusion: { in: ['FAILURE', 'TIMED_OUT'] },
          },
        }),
        prisma.pipelineRun.aggregate({
          where: {
            pipeline: { repositoryId: { in: repoIds } },
            createdAt: { gte: currentStart },
            durationMs: { not: null },
          },
          _avg: { durationMs: true },
        }),
      ]);

      // Previous period stats (for trend calculation)
      const [totalPrev, successPrev, failedPrev, avgDurationPrevResult] = await Promise.all([
        prisma.pipelineRun.count({
          where: {
            pipeline: { repositoryId: { in: repoIds } },
            createdAt: { gte: previousStart, lt: currentStart },
          },
        }),
        prisma.pipelineRun.count({
          where: {
            pipeline: { repositoryId: { in: repoIds } },
            createdAt: { gte: previousStart, lt: currentStart },
            conclusion: 'SUCCESS',
          },
        }),
        prisma.pipelineRun.count({
          where: {
            pipeline: { repositoryId: { in: repoIds } },
            createdAt: { gte: previousStart, lt: currentStart },
            conclusion: { in: ['FAILURE', 'TIMED_OUT'] },
          },
        }),
        prisma.pipelineRun.aggregate({
          where: {
            pipeline: { repositoryId: { in: repoIds } },
            createdAt: { gte: previousStart, lt: currentStart },
            durationMs: { not: null },
          },
          _avg: { durationMs: true },
        }),
      ]);

      const successRateCurrent = totalCurrent > 0 ? (successCurrent / totalCurrent) * 100 : 0;
      const successRatePrev = totalPrev > 0 ? (successPrev / totalPrev) * 100 : 0;

      const avgDurationCurrent = avgDurationCurrentResult._avg.durationMs ?? 0;
      const avgDurationPrev = avgDurationPrevResult._avg.durationMs ?? 0;

      // Helper to compute percentage changes
      const pctChange = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 100);
      };

      return {
        totalRuns: {
          value: totalCurrent,
          change: pctChange(totalCurrent, totalPrev),
        },
        successRate: {
          value: Math.round(successRateCurrent * 10) / 10,
          change: Math.round((successRateCurrent - successRatePrev) * 10) / 10, // absolute difference
        },
        avgDuration: {
          value: Math.round(avgDurationCurrent / 1000), // in seconds
          change: pctChange(avgDurationCurrent, avgDurationPrev),
        },
        failures: {
          value: failedCurrent,
          change: pctChange(failedCurrent, failedPrev),
        },
      };
    });
  }

  /**
   * Daily success rate time series for charts.
   */
  async getSuccessRate(userId: string, query: AnalyticsQueryDTO) {
    const repoIds = await this.getAuthorizedRepoIds(userId, query.repositoryId);
    const days = query.days;
    const cacheKey = `analytics:success:${userId}:${query.repositoryId || 'all'}:${days}`;

    return this.withCache(cacheKey, async () => {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Raw query to group by date in local DB timezone
      const data: any[] = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('day', pipeline_runs."createdAt") as date,
          COUNT(*)::integer as total,
          SUM(CASE WHEN conclusion = 'SUCCESS' THEN 1 ELSE 0 END)::integer as success
        FROM pipeline_runs
        INNER JOIN pipelines ON pipeline_runs."pipelineId" = pipelines.id
        WHERE pipelines."repositoryId" = ANY(${repoIds})
          AND pipeline_runs."createdAt" >= ${startDate}
        GROUP BY date
        ORDER BY date ASC
      `;

      return data.map((d) => {
        const total = d.total ?? 0;
        const success = d.success ?? 0;
        return {
          date: new Date(d.date).toISOString().split('T')[0],
          total,
          success,
          rate: total > 0 ? Math.round((success / total) * 1000) / 10 : 0,
        };
      });
    });
  }

  /**
   * Build duration trend. Returns daily average build durations.
   */
  async getDurationTrend(userId: string, query: AnalyticsQueryDTO) {
    const repoIds = await this.getAuthorizedRepoIds(userId, query.repositoryId);
    const days = query.days;
    const cacheKey = `analytics:duration:${userId}:${query.repositoryId || 'all'}:${days}`;

    return this.withCache(cacheKey, async () => {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const data: any[] = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('day', pipeline_runs."createdAt") as date,
          AVG("durationMs")::float as avg_duration
        FROM pipeline_runs
        INNER JOIN pipelines ON pipeline_runs."pipelineId" = pipelines.id
        WHERE pipelines."repositoryId" = ANY(${repoIds})
          AND pipeline_runs."createdAt" >= ${startDate}
          AND pipeline_runs."durationMs" IS NOT NULL
        GROUP BY date
        ORDER BY date ASC
      `;

      return data.map((d) => ({
        date: new Date(d.date).toISOString().split('T')[0],
        duration: Math.round((d.avg_duration ?? 0) / 1000), // in seconds
      }));
    });
  }

  /**
   * Deployment frequency over time.
   */
  async getDeployFrequency(userId: string, query: AnalyticsQueryDTO) {
    const repoIds = await this.getAuthorizedRepoIds(userId, query.repositoryId);
    const days = query.days;
    const cacheKey = `analytics:deploy:${userId}:${query.repositoryId || 'all'}:${days}`;

    return this.withCache(cacheKey, async () => {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const data: any[] = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('day', "deployedAt") as date,
          environment,
          COUNT(*)::integer as count
        FROM deployments
        WHERE "repositoryId" = ANY(${repoIds})
          AND "deployedAt" >= ${startDate}
        GROUP BY date, environment
        ORDER BY date ASC
      `;

      // Transform rows into timeseries objects: { date, production: X, staging: Y }
      const map: Record<string, any> = {};
      data.forEach((d) => {
        const dateStr = new Date(d.date).toISOString().split('T')[0];
        if (!map[dateStr]) {
          map[dateStr] = { date: dateStr, production: 0, staging: 0, preview: 0 };
        }
        map[dateStr][d.environment.toLowerCase()] = d.count;
      });

      return Object.values(map);
    });
  }

  /**
   * Developer activity leaderboard (who triggered most runs, and success vs failure counts).
   */
  async getLeaderboard(userId: string, query: AnalyticsQueryDTO) {
    const repoIds = await this.getAuthorizedRepoIds(userId, query.repositoryId);
    const days = query.days;
    const cacheKey = `analytics:leaderboard:${userId}:${query.repositoryId || 'all'}:${days}`;

    return this.withCache(cacheKey, async () => {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const data: any[] = await prisma.$queryRaw`
        SELECT 
          users.id,
          users.name,
          users.email,
          users."avatarUrl" as avatar_url,
          COUNT(pipeline_runs.id)::integer as total_runs,
          SUM(CASE WHEN pipeline_runs.conclusion = 'SUCCESS' THEN 1 ELSE 0 END)::integer as success_runs,
          SUM(CASE WHEN pipeline_runs.conclusion IN ('FAILURE', 'TIMED_OUT') THEN 1 ELSE 0 END)::integer as failed_runs
        FROM pipeline_runs
        INNER JOIN pipelines ON pipeline_runs."pipelineId" = pipelines.id
        INNER JOIN users ON pipeline_runs."triggeredById" = users.id
        WHERE pipelines."repositoryId" = ANY(${repoIds})
          AND pipeline_runs."createdAt" >= ${startDate}
        GROUP BY users.id, users.name, users.email, users."avatarUrl"
        ORDER BY total_runs DESC
        LIMIT 10
      `;

      return data.map((d) => ({
        id: d.id,
        name: d.name,
        email: d.email,
        avatarUrl: d.avatar_url,
        totalRuns: d.total_runs,
        successRuns: d.success_runs,
        failedRuns: d.failed_runs,
      }));
    });
  }
}

export const analyticsService = new AnalyticsService();
