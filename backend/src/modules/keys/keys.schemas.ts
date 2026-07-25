import { z } from 'zod';

export const CreateApiKeySchema = z.object({
  name: z.string().min(2).max(50),
  expiresInDays: z.coerce.number().min(1).max(365).optional().nullable(),
});

export type CreateApiKeyDTO = z.infer<typeof CreateApiKeySchema>;
