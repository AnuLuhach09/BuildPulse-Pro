import { apiClient } from './client';

export interface KPICard {
  value: number;
  change: number; // Percentage change (or absolute for successRate)
}

export interface OverviewStats {
  totalRuns: KPICard;
  successRate: KPICard;
  avgDuration: KPICard;
  failures: KPICard;
}

export interface SuccessRateData {
  date: string;
  total: number;
  success: number;
  rate: number;
}

export interface DurationTrendData {
  date: string;
  duration: number; // in seconds
}

export interface DeployFrequencyData {
  date: string;
  production: number;
  staging: number;
  preview: number;
}

export interface LeaderboardUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
}

export const analyticsApi = {
  getOverview: async (params?: { repositoryId?: string; days?: number }): Promise<OverviewStats> => {
    const res = await apiClient.get('/analytics/overview', { params });
    return res.data.data;
  },

  getSuccessRate: async (params?: { repositoryId?: string; days?: number }): Promise<SuccessRateData[]> => {
    const res = await apiClient.get('/analytics/success-rate', { params });
    return res.data.data;
  },

  getDurationTrend: async (params?: { repositoryId?: string; days?: number }): Promise<DurationTrendData[]> => {
    const res = await apiClient.get('/analytics/duration-trend', { params });
    return res.data.data;
  },

  getDeployFrequency: async (params?: { repositoryId?: string; days?: number }): Promise<DeployFrequencyData[]> => {
    const res = await apiClient.get('/analytics/deploy-frequency', { params });
    return res.data.data;
  },

  getLeaderboard: async (params?: { repositoryId?: string; days?: number }): Promise<LeaderboardUser[]> => {
    const res = await apiClient.get('/analytics/leaderboard', { params });
    return res.data.data;
  },
};
