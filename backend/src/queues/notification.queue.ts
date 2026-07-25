import { Queue } from 'bullmq';
import { createBullMQConnection } from '../config/redis';

export const notificationQueue = new Queue('notifications', {
  connection: createBullMQConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 50 },
  },
});

export const aiAnalysisQueue = new Queue('ai-analysis', {
  connection: createBullMQConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export type NotificationJobData = {
  type: 'failure' | 'success' | 'deploy' | 'recovery';
  userId?: string;
  repositoryId: string;
  pipelineRunId: string;
  metadata?: Record<string, any>;
};

export type AIAnalysisJobData = {
  pipelineRunId: string;
  repositoryId: string;
  failureLogs: string;
  workflowName: string;
  branch: string;
};
