import { z } from 'zod';

const decimalValue = z.union([z.string(), z.number()]).refine(
  (value) => value !== '' && !Number.isNaN(Number(value)),
  'Número inválido',
);

export const openCashSessionSchema = z.object({
  fondoInicial: decimalValue,
});

export const closeCashSessionSchema = z.object({
  conteoFinal: decimalValue,
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listCashSessionsQuerySchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;
