import { z } from 'zod'

/** Alta. La contraseña va y el backend exige al menos 8 caracteres. */
export const createUserSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().min(1, 'El email es obligatorio').email('El email no tiene forma válida'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  roleId: z.coerce.number().int().positive('Elegí un rol'),
})

/**
 * Edición. Sin `password` a propósito: `updateUserSchema` del backend no la
 * acepta, asi que un campo acá seria un control que no hace nada.
 */
export const updateUserSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().min(1, 'El email es obligatorio').email('El email no tiene forma válida'),
  roleId: z.coerce.number().int().positive('Elegí un rol'),
  activo: z.boolean(),
})

export type CreateUserFormValues = z.infer<typeof createUserSchema>
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>