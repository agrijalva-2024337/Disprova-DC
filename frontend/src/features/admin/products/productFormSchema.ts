import { z } from 'zod'

const decimalText = z
  .string()
  .trim()
  .min(1, 'Indica un número')
  .refine((value) => /^\d+(\.\d+)?$/.test(value), 'Usa un número válido, por ejemplo 1 o 12.50')

export const productUnitFormSchema = z.object({
  // El id identifica la presentación que ya existe. Sin él, el backend no
  // puede distinguir "editá esta" de "creá una nueva" y tendría que borrar
  // todas, lo que rompe los precios y los pedidos que las apuntan.
  id: z.number().int().positive().optional(),
  nombre: z.string().min(1, 'Indica el nombre de la presentación'),
  factor: decimalText,
  codigoBarras: z.string().optional(),
  precioBase: decimalText,
})

/**
 * Imagen del producto. `id` es null cuando es nueva (recién subida, todavía
 * sin guardar). `preview` no viaja al backend: es solo para mostrarla en
 * pantalla mientras se elige.
 */
export const productImageFormSchema = z.object({
  id: z.number().int().positive().nullable(),
  url: z.string().min(1, 'La imagen no se pudo leer'),
  esPrincipal: z.boolean(),
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
  images: z.array(productImageFormSchema),
})

export type ProductFormValues = z.infer<typeof productFormSchema>
