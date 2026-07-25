import { z } from 'zod';

export const AnalyticsQuerySchema = z.object({
  repositoryId: z.string().optional(),
  days: z.coerce.number().min(1).max(90).default(30),
});

export type AnalyticsQueryDTO = z.infer<typeof AnalyticsQuerySchema>;
