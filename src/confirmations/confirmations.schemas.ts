import { z } from 'zod';
import { API_INTENT_VALUES, API_PAYMENT_VALUES } from '../common/enums';

export const patchDraftSchema = z.object({
  intent: z.enum(API_INTENT_VALUES).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).optional(),
        name: z.string().min(1).max(160).optional(),
        quantity: z.number().positive().optional(),
        unit: z.string().min(1).max(40).optional(),
        unitPriceKobo: z.number().int().nonnegative().optional().nullable(),
        lineTotalKobo: z.number().int().nonnegative().optional().nullable(),
      }),
    )
    .optional(),
  totalKobo: z.number().int().nonnegative().optional().nullable(),
  paymentMethod: z.enum(API_PAYMENT_VALUES).optional().nullable(),
  counterparty: z.string().min(1).max(120).optional().nullable(),
  debtorId: z.string().min(1).optional().nullable(),
});
export type PatchDraftInput = z.infer<typeof patchDraftSchema>;

export const confirmDraftSchema = z.object({
  idempotencyKey: z.string().max(100).optional(),
});