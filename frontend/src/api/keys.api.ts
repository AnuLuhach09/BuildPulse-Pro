import { apiClient } from './client';

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  maskedKey: string;
  rawKey?: string; // only present immediately after creation
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const keysApi = {
  list: async (): Promise<ApiKey[]> => {
    const res = await apiClient.get('/keys');
    return res.data.data;
  },

  create: async (data: { name: string; expiresInDays?: number }): Promise<ApiKey> => {
    const res = await apiClient.post('/keys', data);
    return res.data.data;
  },

  revoke: async (id: string) => {
    const res = await apiClient.delete(`/keys/${id}`);
    return res.data.data;
  },
};
