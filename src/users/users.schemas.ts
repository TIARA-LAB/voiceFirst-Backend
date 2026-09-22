import { z } from 'zod';

export const deletionRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});