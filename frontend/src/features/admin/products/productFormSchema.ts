import { z } from 'zod'

export const productUnitFormSchema = z.object({
  nombre: z.string().min(1, 'Indica el nombre de la presentación'),
  factor: z.string().min(1, 'Indica el factor'),
  codigoBarras: z.string().optional(),
  precioBase: z.string().min(1, 'Indica el precio base'),
})

export const productFormSchema = z.object({
  sku: z.string().min(1, 'El SKU es obligatorio'),
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  descripcion: z.string().optional(),
  categoryId: z.coerce.number().int().positive('Selecciona una categoría'),
  marca: z.string().optional(),
  unidadBase: z.string().min(1, 'La unidad base es obligatoria'),
  controlado: z.boolean(),
  activo: z.boolean(),
  units: z.array(productUnitFormSchema).min(1, 'Agrega al menos una presentación'),
})

export type ProductFormValues = z.infer<typeof productFormSchema>
