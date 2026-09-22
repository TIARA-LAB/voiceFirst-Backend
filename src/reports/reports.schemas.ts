import { z } from 'zod';

export const dailySummaryQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
});

export const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export const profitLossQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
});

export type DailySummaryQuery = z.infer<typeof dailySummaryQuerySchema>;
export type TrendQuery = z.infer<typeof trendQuerySchema>;
export type ProfitLossQuery = z.infer<typeof profitLossQuerySchema>;