import { z } from 'zod';

export const LIMITE_POR_DEFECTO = 100;
export const LIMITE_MAXIMO = 500;

export const auditLogQuerySchema = z.object({
  entity: z.string().trim().min(1).optional(),
  entityId: z.string().trim().min(1).optional(),
  userId: z.coerce.number().int().positive().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(LIMITE_MAXIMO).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;