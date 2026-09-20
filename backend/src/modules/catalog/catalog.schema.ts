import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const decimalValue = z.union([z.string(), z.number()]).refine(
  (value) => value !== '' && !Number.isNaN(Number(value)),
  'Número inválido',
);

const productUnitInputSchema = z.object({
  nombre: z.string().min(1),
  factor: decimalValue,
  codigoBarras: z.string().min(1).nullable().optional(),
  precioBase: decimalValue,
});

const productImageInputSchema = z.object({
  url: z.string().min(1),
  orden: z.number().int().optional(),
  esPrincipal: z.boolean().optional(),
});

export const createCategorySchema = z.object({
  nombre: z.string().min(1),
  parentId: z.number().int().positive().nullable().optional(),
  orden: z.number().int().optional(),
  activo: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createProductSchema = z.object({
  sku: z.string().min(1),
  nombre: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  categoryId: z.number().int().positive(),
  marca: z.string().nullable().optional(),
  unidadBase: z.string().min(1),
  controlado: z.boolean().optional(),
  activo: z.boolean().optional(),
  units: z.array(productUnitInputSchema).optional(),
  images: z.array(productImageInputSchema).optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  sku: z.string().min(1).optional(),
  nombre: z.string().min(1).optional(),
  categoryId: z.number().int().positive().optional(),
  unidadBase: z.string().min(1).optional(),
});

export const createPriceListSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  activo: z.boolean().optional(),
});

export const updatePriceListSchema = createPriceListSchema.partial();

export const createPriceListItemSchema = z.object({
  priceListId: z.number().int().positive(),
  productUnitId: z.number().int().positive(),
  precio: decimalValue,
  vigenteDesde: z.coerce.date(),
});

export const updatePriceListItemSchema = createPriceListItemSchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreatePriceListInput = z.infer<typeof createPriceListSchema>;
export type UpdatePriceListInput = z.infer<typeof updatePriceListSchema>;
export type CreatePriceListItemInput = z.infer<typeof createPriceListItemSchema>;
export type UpdatePriceListItemInput = z.infer<typeof updatePriceListItemSchema>;
