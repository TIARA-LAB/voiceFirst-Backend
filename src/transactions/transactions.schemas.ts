import { z } from 'zod';
import { API_INTENT_VALUES, API_PAYMENT_VALUES } from '../common/enums';

export const itemSchema = z.object({
  productId: z.string().min(1).optional(),
  name: z.string().min(1).max(160).optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(40),
  unitPriceKobo: z.number().int().nonnegative().optional(),
  lineTotalKobo: z.number().int().nonnegative().optional(),
  costPriceKobo: z.number().int().nonnegative().optional(),
});
export type ItemInput = z.infer<typeof itemSchema>;

export const createTransactionSchema = z.object({
  type: z.enum(API_INTENT_VALUES),
  items: z.array(itemSchema).default([]),
  totalKobo: z.number().int().nonnegative().optional(),
  paymentMethod: z.enum(API_PAYMENT_VALUES).optional().nullable(),
  counterparty: z.string().min(1).max(120).optional().nullable(),
  debtorId: z.string().min(1).optional(),
  debtorName: z.string().min(1).max(120).optional(),
  debtorPhone: z.string().max(20).optional(),
  note: z.string().max(500).optional().nullable(),
  occurredAt: z.string().datetime().optional().nullable(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const transactionParamsSchema = z.object({
  id: z.string().min(1),
});

export const listTransactionsSchema = z.object({
  type: z.enum(API_INTENT_VALUES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  productId: z.string().min(1).optional(),
  q: z.string().max(160).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});
export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>;