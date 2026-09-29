import { z } from 'zod'

/**
 * El backend acepta monto como string o number y exige que sea mayor a cero
 * (`decimalValue` en collections.schema.ts). Acá se manda string para no perder
 * precisión con floats.
 */
export const paymentFormSchema = z.object({
  monto: z
    .string()
    .min(1, 'Indica el monto del pago')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
      message: 'El monto debe ser mayor a cero',
    }),
  metodo: z.enum(['efectivo', 'transferencia', 'cheque']),
  referencia: z.string().optional(),
})

export type PaymentFormValues = z.infer<typeof paymentFormSchema>
