import { z } from 'zod';

export const idParamSchema = z.string().min(1);

export const createProductSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(500).optional(),
  defaultUnit: z.string().min(1).max(40),
  aliases: z.array(z.string().min(1).max(80)).default([]),
  sellingPriceKobo: z.number().int().nonnegative().optional(),
  costPriceKobo: z.number().int().nonnegative().optional().nullable(),
  openingStock: z.number().nonnegative().optional().default(0),
  lowStockThreshold: z.number().nonnegative().optional().nullable(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const patchProductSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(500).optional().nullable(),
  defaultUnit: z.string().min(1).max(40).optional(),
  aliases: z.array(z.string().min(1).max(80)).optional(),
  sellingPriceKobo: z.number().int().nonnegative().optional().nullable(),
  costPriceKobo: z.number().int().nonnegative().optional().nullable(),
  lowStockThreshold: z.number().nonnegative().optional().nullable(),
});
export type PatchProductInput = z.infer<typeof patchProductSchema>;

export const listProductsSchema = z.object({
  q: z.string().max(160).optional(),
  includeArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  lowStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});
export type ListProductsInput = z.infer<typeof listProductsSchema>;