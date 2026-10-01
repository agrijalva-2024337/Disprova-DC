import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { Role } from '../api/types.ts'
import { Alert } from '../ui/Status.tsx'
import { createUserSchema, type CreateUserFormValues } from './userFormSchema.ts'

/** Alta de usuario. Acá sí va contraseña: es el único momento en que se manda. */
export function CreateUserForm({
  roles,
  onSubmit,
  isPending,
  error,
}: {
  roles: Role[]
  onSubmit: (values: CreateUserFormValues) => void
  isPending: boolean
  error: string | null
}) {
  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { nombre: '', email: '', password: '', roleId: 0 },
  })

  return (
    <form
      className="ficha mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={form.handleSubmit(onSubmit)}
    >
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
        <span className="mb-1 block font-medium">Contraseña</span>
        <input
          type="password"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          {...form.register('password')}
        />
        {form.formState.errors.password ? (
          <span className="text-xs text-red-700">{form.formState.errors.password.message}</span>
        ) : null}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Rol</span>
        <select
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          {...form.register('roleId')}
        >
          <option value={0}>Elegí un rol</option>
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

      <div className="sm:col-span-2">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <button
          type="submit"
          disabled={isPending}
          className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isPending ? 'Creando…' : 'Crear usuario'}
        </button>
      </div>
    </form>
  )
}
