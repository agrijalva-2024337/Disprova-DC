import { z } from 'zod';

export const listOrdersQuerySchema = z.object({
  clientId: z.coerce.number().int().positive().optional(),
  pendientes: z.enum(['1', 'true']).optional(),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const decimalValue = z.union([z.string(), z.number()]).refine(
  (value) => value !== '' && !Number.isNaN(Number(value)) && Number(value) > 0,
  'La cantidad debe ser mayor a cero',
);

const decimalOrZero = z.union([z.string(), z.number()]).refine(
  (value) => value !== '' && !Number.isNaN(Number(value)) && Number(value) >= 0,
  'La cantidad no puede ser negativa',
);

export const createOrderSchema = z.object({
  clientId: z.number().int().positive(),
  canal: z.enum(['campo', 'web', 'whatsapp']),
  condicionPago: z.enum(['contado', 'credito']),
  items: z
    .array(
      z.object({
        productUnitId: z.number().int().positive(),
        cantidad: decimalValue,
      }),
    )
    .min(1),
});

export const deliverOrderSchema = z.object({
  recibidoPor: z.string().min(1).nullable().optional(),
  observaciones: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.number().int().positive(),
        cantidadEntregada: decimalOrZero,
        batchId: z.number().int().positive().nullable().optional(),
      }),
    )
    .min(1),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type DeliverOrderInput = z.infer<typeof deliverOrderSchema>;
