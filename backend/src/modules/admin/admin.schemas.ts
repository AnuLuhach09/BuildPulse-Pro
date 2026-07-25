import { z } from 'zod';

export const UpdateUserRoleSchema = z.object({
  role: z.enum(['ADMIN', 'DEVELOPER']),
});

export const UpdateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const AuditLogQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  userId: z.string().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
});

export const ExportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  repositoryId: z.string().optional(),
});

export type UpdateUserRoleDTO = z.infer<typeof UpdateUserRoleSchema>;
export type UpdateUserStatusDTO = z.infer<typeof UpdateUserStatusSchema>;
export type AuditLogQueryDTO = z.infer<typeof AuditLogQuerySchema>;
export type ExportQueryDTO = z.infer<typeof ExportQuerySchema>;
