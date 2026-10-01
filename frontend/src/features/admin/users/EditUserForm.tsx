import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { AuthUser, Role } from '../api/types.ts'
import { Alert } from '../ui/Status.tsx'
import { updateUserSchema, type UpdateUserFormValues } from './userFormSchema.ts'

/**
 * Edición de usuario. NO tiene campo de contraseña a propósito: el backend no
 * la acepta en el PUT y el service no hashea nada ahi, asi que un campo seria
 * un control que no hace nada. Se deja la nota para que quede claro que es
 * una limitacion conocida y no un olvido.
 */
export function EditUserForm({
  usuario,
  roles,
  onSubmit,
  onCancel,
  isPending,
  error,
}: {
  usuario: AuthUser
  roles: Role[]
  onSubmit: (values: UpdateUserFormValues) => void
  onCancel: () => void
  isPending: boolean
  error: string | null
}) {
  const form = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      nombre: usuario.nombre,
      email: usuario.email,
      roleId: usuario.roleId,
      activo: usuario.activo,
    },
  })

  return (
    <form className="ficha grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Nombre</span>
        <input
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          {...form.register('nombre')}
        />
        {form.formState.errors.nombre ? (
          <span className="text-xs text-red-700">{form.formState.errors.nombre.message}</span>
        ) : null}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input
          type="email"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          {...form.register('email')}
        />
        {form.formState.errors.email ? (
          <span className="text-xs text-red-700">{form.formState.errors.email.message}</span>
        ) : null}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Rol</span>
        <select
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          {...form.register('roleId')}
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.nombre}
            </option>
          ))}
        </select>
        {form.formState.errors.roleId ? (
          <span className="text-xs text-red-700">{form.formState.errors.roleId.message}</span>
        ) : null}
      </label>

      <label className="flex items-end gap-2 text-sm">
        <input type="checkbox" {...form.register('activo')} />
        Activo
      </label>

      <div className="sm:col-span-2">
        <Alert tone="info">
          No se puede cambiar la contraseña desde acá: el backend no la acepta en la edición. Ese
          flujo todavía no está soportado.
        </Alert>
        {error ? (
          <div className="mt-2">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>
  )
}
