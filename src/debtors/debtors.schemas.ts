import { z } from 'zod';

export const listDebtorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'SETTLED']).optional(),
});

export const createDebtorSchema = z.object({
  name: z.string().trim().min(1).max(150),
  phone: z.string().trim().max(20).nullable().optional(),
});

export const updateDebtorSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  status: z.enum(['ACTIVE', 'SETTLED']).optional(),
});

export type CreateDebtorBody = z.infer<typeof createDebtorSchema>;
export type UpdateDebtorBody = z.infer<typeof updateDebtorSchema>;
export type ListDebtorsQuery = z.infer<typeof listDebtorsQuerySchema>;