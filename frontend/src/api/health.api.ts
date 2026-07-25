import { apiClient } from './client';

export interface SystemHealth {
  status: string;
  timestamp: string;
  version: string;
  environment: string;
  services: {
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
    ai: 'configured' | 'not_configured';
  };
}

export const healthApi = {
  getSystemHealth: async (): Promise<SystemHealth> => {
    const res = await apiClient.get('/health');
    return res.data;
  },
};
