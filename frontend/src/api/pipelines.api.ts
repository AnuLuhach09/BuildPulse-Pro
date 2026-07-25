import { apiClient } from './client';

export interface PipelineRun {
  id: string;
  githubRunId: string;
  pipelineId: string;
  triggeredById?: string;
  branch: string;
  commitSha: string;
  commitMessage?: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'WAITING';
  conclusion?: 'SUCCESS' | 'FAILURE' | 'CANCELLED' | 'SKIPPED' | 'TIMED_OUT' | 'NEUTRAL' | 'ACTION_REQUIRED';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  htmlUrl: string;
  attemptNumber: number;
  createdAt: string;
  pipeline: {
    id: string;
    name: string;
    path: string;
    repository: {
      id: string;
      name: string;
      fullName: string;
    };
  };
  triggeredBy?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
}

export interface BuildStep {
  id: string;
  name: string;
  number: number;
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'WAITING';
  conclusion?: 'SUCCESS' | 'FAILURE' | 'CANCELLED' | 'SKIPPED' | 'TIMED_OUT';
  startedAt?: string;
  completedAt?: string;
}

export interface BuildJob {
  id: string;
  githubJobId: string;
  name: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'WAITING';
  conclusion?: 'SUCCESS' | 'FAILURE' | 'CANCELLED' | 'SKIPPED' | 'TIMED_OUT';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  steps: BuildStep[];
}

export interface AIAnalysis {
  id: string;
  failureReason: string;
  suggestedFix: string;
  affectedFiles: string[];
  confidence: number;
  createdAt: string;
}

export interface PipelineRunDetail extends Omit<PipelineRun, 'pipeline'> {
  pipeline: {
    id: string;
    name: string;
    path: string;
    repository: {
      id: string;
      name: string;
      fullName: string;
    };
  };
  jobs: BuildJob[];
  aiAnalysis?: AIAnalysis;
}

export const pipelinesApi = {
  listRuns: async (params: {
    page?: number;
    limit?: number;
    repositoryId?: string;
    status?: string;
    conclusion?: string;
    search?: string;
  }) => {
    const res = await apiClient.get('/pipelines', { params });
    return res.data;
  },

  getRunById: async (id: string): Promise<PipelineRunDetail> => {
    const res = await apiClient.get(`/pipelines/${id}`);
    return res.data.data;
  },

  getQueue: async () => {
    const res = await apiClient.get('/pipelines/queue');
    return res.data.data;
  },

  getLogs: async (id: string) => {
    const res = await apiClient.get(`/pipelines/${id}/logs`);
    return res.data.data;
  },

  simulateFix: async (id: string): Promise<PipelineRunDetail> => {
    const res = await apiClient.post(`/pipelines/${id}/simulate-fix`);
    return res.data.data;
  },
};
