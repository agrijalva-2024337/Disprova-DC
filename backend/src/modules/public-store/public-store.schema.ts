import { z } from 'zod';

export const clientIdParamSchema = z.object({
  clientId: z.coerce.number().int().positive(),
});

export const tokenIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createTokenSchema = z.object({
  /** Vigencia por defecto: 30 días. */
  expiresInDays: z.number().int().positive().max(365).optional(),
});

/**
 * Mismo contrato que `POST /api/orders` (sales.schema.createOrderSchema),
 * pero `clientId` y `canal` se omiten a propósito: acá los fija el token,
 * no el que llama. Se acepta `clientId` en el body solo para ignorarlo
 * explícitamente sin romper clientes que lo manden.
 */
export const publicOrderSchema = z.object({
  clientId: z.number().int().positive().optional(),
  canal: z.enum(['campo', 'web', 'whatsapp']).optional(),
  condicionPago: z.enum(['contado', 'credito']),
  idempotencyKey: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        productUnitId: z.number().int().positive(),
        cantidad: z.union([z.string(), z.number()]).refine(
          (value) => value !== '' && !Number.isNaN(Number(value)) && Number(value) > 0,
          'La cantidad debe ser mayor a cero',
        ),
      }),
    )
    .min(1),
});

export type CreateTokenInput = z.infer<typeof createTokenSchema>;
export type PublicOrderInput = z.infer<typeof publicOrderSchema>;