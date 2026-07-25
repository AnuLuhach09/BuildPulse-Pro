import { z } from 'zod';

export const ConnectRepoSchema = z.object({
  fullName: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, 'Must be in format "owner/repo"')
    .min(3),
});

export const RepoQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type ConnectRepoDTO = z.infer<typeof ConnectRepoSchema>;
export type RepoQueryDTO = z.infer<typeof RepoQuerySchema>;
