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

export const createWarehouseSchema = z.object({
  nombre: z.string().min(1),
  tipo: z.enum(['bodega', 'vehiculo']),
  responsableUserId: z.number().int().positive().nullable().optional(),
});

export const createBatchSchema = z.object({
  productId: z.number().int().positive(),
  lote: z.string().min(1),
  fechaVencimiento: z.coerce.date(),
  costo: decimalValue,
});

const positiveDecimal = z.union([z.string(), z.number()]).refine(
  (value) => value !== '' && !Number.isNaN(Number(value)) && Number(value) > 0,
  'La cantidad debe ser mayor a cero',
);

export const entradaSchema = z.object({
  productId: z.number().int().positive(),
  cantidad: positiveDecimal,
  batchId: z.number().int().positive().nullable().optional(),
});

export type TransferInput = z.infer<typeof transferSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type EntradaInput = z.infer<typeof entradaSchema>;
