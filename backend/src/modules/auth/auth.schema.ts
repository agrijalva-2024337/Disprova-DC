import { z } from 'zod';

const usuarioSchema = z
  .string()
  .trim()
  .min(3, 'El usuario necesita al menos 3 caracteres')
  .max(32)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Usa letras, números, punto, guion o guion bajo');

export const loginSchema = z
  .object({
    email: z.string().email().optional(),
    usuario: z.string().trim().min(1).max(32).optional(),
    password: z.string().min(1),
  })
  .refine((value) => Boolean(value.email || value.usuario), {
    message: 'Indica correo o usuario',
    path: ['usuario'],
  });

const avatarSchema = z
  .string()
  .max(350_000, 'La imagen es demasiado grande')
  .refine(
    (value) =>
      value.startsWith('data:image/jpeg') ||
      value.startsWith('data:image/png') ||
      value.startsWith('data:image/webp'),
    'La imagen debe ser JPG, PNG o WebP',
  );

export const updateProfileSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120).optional(),
    usuario: usuarioSchema.optional(),
    avatarUrl: avatarSchema.nullable().optional(),
  })
  .refine((value) => value.nombre !== undefined || value.usuario !== undefined || value.avatarUrl !== undefined, {
    message: 'No hay cambios',
  });

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
