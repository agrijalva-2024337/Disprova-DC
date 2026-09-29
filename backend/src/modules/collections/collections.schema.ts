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
export const abrirSaldosInicialesSchema = z.object({
  /**
   * Identifica el corte del negocio, por ejemplo 'corte-2026-09-29'. El índice
   * único parcial sobre account_movements impide cargar el mismo corte dos
   * veces: una doble carga duplicaría toda la deuda de la cartera.
   */
  corte: z.string().min(1),
  items: z
    .array(
      z.object({
        clientId: z.number().int().positive(),
        monto: decimalValue,
      }),
    )
    .min(1),
  /**
   * `simulacion` devuelve el cuadre sin escribir nada. Es el modo por defecto
   * en la práctica: el administrador compara el resultado con la libreta y
   * recién entonces manda `commit`.
   */
  modo: z.enum(['simulacion', 'commit']).default('simulacion'),
});

export type CreateCollectionVisitInput = z.infer<typeof createCollectionVisitSchema>;
export type AbrirSaldosInicialesInput = z.infer<typeof abrirSaldosInicialesSchema>;
