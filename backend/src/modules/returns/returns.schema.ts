import { z } from 'zod';

const decimalValue = z.union([z.string(), z.number()]).refine(
  (value) => value !== '' && !Number.isNaN(Number(value)) && Number(value) > 0,
  'La cantidad debe ser mayor a cero',
);

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createReturnSchema = z.object({
  clientId: z.number().int().positive(),
  orderId: z.number().int().positive(),
  motivo: z.string().min(1),
  items: z
    .array(
      z.object({
        orderItemId: z.number().int().positive(),
        cantidad: decimalValue,
        batchId: z.number().int().positive().nullable().optional(),
        destino: z.enum(['reingreso', 'merma']),
      }),
    )
    .min(1),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
