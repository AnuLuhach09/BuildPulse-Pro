import { z } from 'zod';

export const UpdateNotificationPrefsSchema = z.object({
  emailEnabled: z.boolean(),
  slackEnabled: z.boolean(),
  slackWebhook: z.string().url('Must be a valid Slack webhook URL').nullable().optional(),
  onFailure: z.boolean(),
  onSuccess: z.boolean(),
  onDeploy: z.boolean(),
  onRecovery: z.boolean(),
});

export type UpdateNotificationPrefsDTO = z.infer<typeof UpdateNotificationPrefsSchema>;
