import { z } from 'zod';

export const adjustmentSchema = z.object({
  productId: z.string().min(1),
  delta: z.number().finite(),
  allowNegative: z.boolean().optional().default(false),
  note: z.string().max(500).optional(),
});
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;

export const movementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});