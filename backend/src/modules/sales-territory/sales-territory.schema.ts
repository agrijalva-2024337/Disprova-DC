import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const contactParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  contactId: z.coerce.number().int().positive(),
});

const decimalValue = z.union([z.string(), z.number()]).refine(
  (value) => value !== '' && !Number.isNaN(Number(value)),
  'Número inválido',
);

const tipoNegocioSchema = z.enum(['tienda', 'farmacia', 'mercado', 'otro']);
const resultadoVisitaSchema = z.enum(['pedido', 'no_compro', 'cerrado']);

const diaSemanaSchema = z.number().int().min(1).max(7);

export const createZoneSchema = z.object({
  nombre: z.string().min(1),
  semanaMes: z.number().int().min(1).max(4),
  diasSemana: z.array(diaSemanaSchema).min(1),
  vendedorUserId: z.number().int().positive().nullable().optional(),
  activo: z.boolean().optional(),
});

export const updateZoneSchema = createZoneSchema.partial();

export const createClientSchema = z.object({
  nombreComercial: z.string().min(1),
  nit: z.string().min(1).nullable().optional(),
  tipoNegocio: tipoNegocioSchema,
  zoneId: z.number().int().positive(),
  ordenRuta: z.number().int(),
  direccion: z.string().min(1),
  lat: decimalValue.nullable().optional(),
  lng: decimalValue.nullable().optional(),
  priceListId: z.number().int().positive(),
  limiteCredito: decimalValue.optional(),
  plazoDias: z.number().int().min(0).optional(),
  activo: z.boolean().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const createContactSchema = z.object({
  nombre: z.string().min(1),
  telefono: z.string().min(1),
  esWhatsapp: z.boolean(),
  aceptaMensajes: z.boolean().optional(),
  esPrincipal: z.boolean().optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const createRouteVisitSchema = z.object({
  clientId: z.number().int().positive(),
  resultado: resultadoVisitaSchema,
  motivo: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  lat: decimalValue.nullable().optional(),
  lng: decimalValue.nullable().optional(),
  fecha: z.coerce.date().optional(),
});

export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateRouteVisitInput = z.infer<typeof createRouteVisitSchema>;
