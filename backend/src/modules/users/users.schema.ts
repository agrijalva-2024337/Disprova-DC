import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * Alta de usuario. El email único y la contraseña hasheada los resuelve el
 * service: Zod valida la forma, la unicidad es una consulta a la base.
 */
export const createUserSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  roleId: z.number().int().positive(),
  activo: z.boolean().optional(),
});

/**
 * Edición de usuario. La contraseña NO se cambia acá: si hay que
 * resettingla es otro flujo, no un campo más de este formulario.
 */
export const updateUserSchema = z.object({
  nombre: z.string().min(1).optional(),
  email: z.string().email().optional(),
  roleId: z.number().int().positive().optional(),
  activo: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;