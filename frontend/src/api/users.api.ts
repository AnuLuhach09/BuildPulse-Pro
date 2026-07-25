import { apiClient } from './client';

export interface NotificationPrefs {
  id: string;
  userId: string;
  emailEnabled: boolean;
  slackEnabled: boolean;
  slackWebhook: string | null;
  onFailure: boolean;
  onSuccess: boolean;
  onDeploy: boolean;
  onRecovery: boolean;
  createdAt: string;
  updatedAt: string;
}

export const usersApi = {
  getNotifications: async (): Promise<NotificationPrefs> => {
    const res = await apiClient.get('/users/notifications');
    return res.data.data;
  },

  updateNotifications: async (data: Omit<NotificationPrefs, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<NotificationPrefs> => {
    const res = await apiClient.put('/users/notifications', data);
    return res.data.data;
  },
};
