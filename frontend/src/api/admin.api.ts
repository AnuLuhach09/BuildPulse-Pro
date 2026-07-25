import { apiClient } from './client';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  githubLogin?: string;
  role: 'ADMIN' | 'DEVELOPER';
  isActive: boolean;
  createdAt: string;
  _count?: {
    members: number; // connected repos count
  };
}

export interface AdminAuditLog {
  id: string;
  userId?: string;
  repositoryId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata: any;
  ipAddress?: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  repository?: {
    id: string;
    name: string;
    fullName: string;
  };
}

export const adminApi = {
  listUsers: async (params?: { page?: number; limit?: number }) => {
    const res = await apiClient.get('/admin/users', { params });
    return res.data;
  },

  updateUserRole: async (id: string, role: 'ADMIN' | 'DEVELOPER') => {
    const res = await apiClient.put(`/admin/users/${id}/role`, { role });
    return res.data.data;
  },

  updateUserStatus: async (id: string, isActive: boolean) => {
    const res = await apiClient.put(`/admin/users/${id}/status`, { isActive });
    return res.data.data;
  },

  listAuditLogs: async (params?: { page?: number; limit?: number; userId?: string; action?: string; entity?: string }) => {
    const res = await apiClient.get('/admin/audit-logs', { params });
    return res.data;
  },

  triggerExport: (endpoint: 'audit-logs' | 'pipelines', format: 'csv' | 'json', repositoryId?: string) => {
    const url = `${apiClient.defaults.baseURL}/admin/export/${endpoint}?format=${format}${repositoryId ? `&repositoryId=${repositoryId}` : ''}`;
    window.open(url, '_blank');
  },
};
