import { z } from 'zod'

const decimalText = z
  .string()
  .trim()
  .min(1, 'Indica un número')
  .refine((value) => /^\d+(\.\d+)?$/.test(value), 'Usa un número válido, por ejemplo 1 o 12.50')

export const productUnitFormSchema = z.object({
  nombre: z.string().min(1, 'Indica el nombre de la presentación'),
  factor: decimalText,
  codigoBarras: z.string().optional(),
  precioBase: decimalText,
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
