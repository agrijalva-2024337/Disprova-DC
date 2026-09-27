import { z } from 'zod';

export const orderIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const invoicesQuerySchema = z.object({
  estado: z.enum(['pendiente_certificacion', 'certificada', 'error']).optional(),
});

export const createInvoiceSchema = z.object({
  /** Serie de facturación. Por defecto la de `FEL_SERIE`. */
  serie: z.string().min(1).optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;