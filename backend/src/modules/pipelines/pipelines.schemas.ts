import { z } from 'zod';
import { RunStatus, Conclusion } from '@prisma/client';

export const PipelineQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  repositoryId: z.string().optional(),
  status: z.nativeEnum(RunStatus).optional(),
  conclusion: z.nativeEnum(Conclusion).optional(),
  branch: z.string().optional(),
  search: z.string().optional(), // For commit message or workflow name
});

export type PipelineQueryDTO = z.infer<typeof PipelineQuerySchema>;
