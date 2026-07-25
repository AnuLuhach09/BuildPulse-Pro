import { apiClient } from './client';

export interface Repository {
  id: string;
  githubId: number;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  defaultBranch: string;
  isPrivate: boolean;
  healthScore: number;
  language?: string;
  topics: string[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    pipelines: number;
    deployments: number;
  };
}

export interface WebhookInstructions {
  webhookUrl: string;
  secret: string;
  events: string[];
  contentType: string;
  instructions: string[];
}

export const repositoriesApi = {
  list: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get('/repos', { params });
    return res.data;
  },

  connect: async (fullName: string): Promise<Repository> => {
    const res = await apiClient.post('/repos', { fullName });
    return res.data.data;
  },

  disconnect: async (id: string) => {
    const res = await apiClient.delete(`/repos/${id}`);
    return res.data.data;
  },

  getHealth: async (id: string): Promise<number> => {
    const res = await apiClient.get(`/repos/${id}/health`);
    return res.data.data.healthScore;
  },

  getWebhookInstructions: async (id: string): Promise<WebhookInstructions> => {
    const res = await apiClient.get(`/repos/${id}/webhook-instructions`);
    return res.data.data;
  },
};
