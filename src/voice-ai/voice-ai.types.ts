import { z } from 'zod';

export const IntentValues = ['sale', 'purchase', 'expense', 'stock_in', 'debt', 'payment'] as const;
export const PaymentMethodValues = ['cash', 'transfer', 'pos', 'credit', 'partial', 'unknown'] as const;

export const ParsedItemSchema = z.object({
  name: z.string().nullable(),
  quantity: z.number().positive().nullable(),
  unit: z.string().nullable(),
  unitPriceKobo: z.number().int().nonnegative().nullable(),
  lineTotalKobo: z.number().int().nonnegative().nullable(),
  matchedProductId: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

export const ParsedTransactionSchema = z.object({
  intent: z.enum(IntentValues),
  items: z.array(ParsedItemSchema),
  totalKobo: z.number().int().nonnegative().nullable(),
  paymentMethod: z.enum(PaymentMethodValues).nullable(),
  counterparty: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.string()),
  ambiguities: z.array(z.string()),
});

export type Intent = (typeof IntentValues)[number];
export type PaymentMethod = (typeof PaymentMethodValues)[number];
export type ParsedItem = z.infer<typeof ParsedItemSchema>;
export type ParsedTransaction = z.infer<typeof ParsedTransactionSchema>;