import { z } from 'zod';

const decimalValue = z.union([z.string(), z.number()]).refine(
  (value) => value !== '' && !Number.isNaN(Number(value)) && Number(value) > 0,
  'La cantidad debe ser mayor a cero',
);

export const LIMITE_POR_DEFECTO = 100;
export const LIMITE_MAXIMO = 500;

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listReturnsQuerySchema = z.object({
  estado: z.enum(['pendiente', 'aceptada', 'rechazada']).optional(),
  clientId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(LIMITE_MAXIMO).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type ListReturnsQuery = z.infer<typeof listReturnsQuerySchema>;

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
