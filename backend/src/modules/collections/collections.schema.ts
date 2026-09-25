import { z } from 'zod';

const decimalValue = z.union([z.string(), z.number()]).refine(
  (value) => value !== '' && !Number.isNaN(Number(value)) && Number(value) > 0,
  'El monto debe ser mayor a cero',
);

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createPaymentSchema = z.object({
  clientId: z.number().int().positive(),
  monto: decimalValue,
  metodo: z.enum(['efectivo', 'transferencia', 'cheque']),
  referencia: z.string().min(1).nullable().optional(),
});

export const applyPaymentSchema = z.object({
  applications: z
    .array(
      z.object({
        orderId: z.number().int().positive(),
        monto: decimalValue,
      }),
    )
    .min(1),
});

export const createCollectionVisitSchema = z.object({
  clientId: z.number().int().positive(),
  resultado: z.enum(['pago_completo', 'pago_parcial', 'compromiso', 'sin_contacto']),
  montoComprometido: decimalValue.nullable().optional(),
  fechaCompromiso: z.coerce.date().nullable().optional(),
  observaciones: z.string().nullable().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ApplyPaymentInput = z.infer<typeof applyPaymentSchema>;
export type CreateCollectionVisitInput = z.infer<typeof createCollectionVisitSchema>;
