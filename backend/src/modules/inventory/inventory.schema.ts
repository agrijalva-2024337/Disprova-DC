import { z } from 'zod';

const decimalValue = z.union([z.string(), z.number()]).refine(
  (value) => value !== '' && !Number.isNaN(Number(value)),
  'Número inválido',
);

export const stockQuerySchema = z.object({
  warehouseId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive().optional(),
  disponible: z.enum(['1', 'true']).optional(),
});

export const movementQuerySchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

export const transferSchema = z.object({
  productId: z.number().int().positive(),
  warehouseIdOrigen: z.number().int().positive(),
  warehouseIdDestino: z.number().int().positive(),
  batchId: z.number().int().positive().nullable().optional(),
  cantidad: decimalValue,
});

export const adjustmentSchema = z.object({
  productId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  batchId: z.number().int().positive().nullable().optional(),
  cantidad: decimalValue,
  motivo: z.string().min(1),
});

export type TransferInput = z.infer<typeof transferSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
