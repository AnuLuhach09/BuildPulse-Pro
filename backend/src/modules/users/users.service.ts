import prisma from '../../config/database';

export class UsersService {
  /**
   * Get notification preferences for a user.
   * If not created yet, initialize with default values.
   */
  async getNotificationPrefs(userId: string) {
    let prefs = await prisma.notificationPref.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await prisma.notificationPref.create({
        data: {
          userId,
          emailEnabled: true,
          slackEnabled: false,
          slackWebhook: null,
          onFailure: true,
          onSuccess: false,
          onDeploy: true,
          onRecovery: true,
        },
      });
    }

    return prefs;
  }

  /**
   * Update notification preferences.
   */
  async updateNotificationPrefs(userId: string, data: any) {
    return prisma.notificationPref.upsert({
      where: { userId },
      update: {
        emailEnabled: data.emailEnabled,
        slackEnabled: data.slackEnabled,
        slackWebhook: data.slackWebhook || null,
        onFailure: data.onFailure,
        onSuccess: data.onSuccess,
        onDeploy: data.onDeploy,
        onRecovery: data.onRecovery,
      },
      create: {
        userId,
        emailEnabled: data.emailEnabled,
        slackEnabled: data.slackEnabled,
        slackWebhook: data.slackWebhook || null,
        onFailure: data.onFailure,
        onSuccess: data.onSuccess,
        onDeploy: data.onDeploy,
        onRecovery: data.onRecovery,
      },
    });
  }
}

export const usersService = new UsersService();
