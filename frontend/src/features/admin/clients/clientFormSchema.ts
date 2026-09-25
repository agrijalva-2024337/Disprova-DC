import { z } from 'zod'

const contactSchema = z.object({
  id: z.number().optional(),
  nombre: z.string().min(1, 'Indica el nombre del contacto'),
  telefono: z.string().min(1, 'Indica el teléfono'),
  esWhatsapp: z.boolean(),
  aceptaMensajes: z.boolean(),
  esPrincipal: z.boolean(),
})

export const clientFormSchema = z.object({
  nombreComercial: z.string().min(1, 'El nombre comercial es obligatorio'),
  nit: z.string().optional(),
  tipoNegocio: z.enum(['tienda', 'farmacia', 'mercado', 'otro']),
  zoneId: z.coerce.number().int().positive('Selecciona una zona'),
  ordenRuta: z.coerce.number().int('Indica el orden en la ruta'),
  direccion: z.string().min(1, 'La dirección es obligatoria'),
  priceListId: z.coerce.number().int().positive('Selecciona una lista de precios'),
  limiteCredito: z.string().min(1, 'Indica el límite de crédito'),
  plazoDias: z.coerce.number().int().min(0, 'El plazo no puede ser negativo'),
  activo: z.boolean(),
  contacts: z.array(contactSchema).min(1, 'Agrega al menos un contacto'),
})

export type ClientFormValues = z.infer<typeof clientFormSchema>
