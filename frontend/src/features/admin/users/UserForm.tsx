import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { AuthUser, Role } from '../api/types.ts'
import { Alert } from '../ui/Status.tsx'
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserFormValues,
  type UpdateUserFormValues,
} from './userFormSchema.ts'

/**
 * Alta y edición en el mismo formulario.
 * La contraseña solo se pide al crear: el backend no la acepta en la edición.
 */
export function UserForm({
  mode,
  usuario,
  roles,
  formId,
  onSubmit,
  error,
  onDirtyChange,
}: {
  mode: 'crear' | 'editar'
  usuario?: AuthUser
  roles: Role[]
  formId: string
  onSubmit: (values: CreateUserFormValues | UpdateUserFormValues) => void
  error: string | null
  onDirtyChange: (dirty: boolean) => void
}) {
  if (mode === 'crear') {
    return (
      <CrearUsuario
        roles={roles}
        formId={formId}
        onSubmit={onSubmit}
        error={error}
        onDirtyChange={onDirtyChange}
      />
    )
  }

  if (!usuario) return null

  return (
    <EditarUsuario
      usuario={usuario}
      roles={roles}
      formId={formId}
      onSubmit={onSubmit}
      error={error}
      onDirtyChange={onDirtyChange}
    />
  )
}

function CrearUsuario({
  roles,
  formId,
  onSubmit,
  error,
  onDirtyChange,
}: {
  roles: Role[]
  formId: string
  onSubmit: (values: CreateUserFormValues | UpdateUserFormValues) => void
  error: string | null
  onDirtyChange: (dirty: boolean) => void
}) {
  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { nombre: '', email: '', password: '', roleId: 0 },
  })

  useEffect(() => {
    onDirtyChange(form.formState.isDirty)
  }, [form.formState.isDirty, onDirtyChange])

  return (
    <form id={formId} className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
      <CampoNombre error={form.formState.errors.nombre?.message} registro={form.register('nombre')} />
      <CampoEmail error={form.formState.errors.email?.message} registro={form.register('email')} />
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
      <CampoRol roles={roles} error={form.formState.errors.roleId?.message} registro={form.register('roleId')} crear />
      {error ? (
        <div className="sm:col-span-2">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
    </form>
  )
}

function EditarUsuario({
  usuario,
  roles,
  formId,
  onSubmit,
  error,
  onDirtyChange,
}: {
  usuario: AuthUser
  roles: Role[]
  formId: string
  onSubmit: (values: CreateUserFormValues | UpdateUserFormValues) => void
  error: string | null
  onDirtyChange: (dirty: boolean) => void
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

  useEffect(() => {
    onDirtyChange(form.formState.isDirty)
  }, [form.formState.isDirty, onDirtyChange])

  return (
    <form id={formId} className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
      <CampoNombre error={form.formState.errors.nombre?.message} registro={form.register('nombre')} />
      <CampoEmail error={form.formState.errors.email?.message} registro={form.register('email')} />
      <label className="flex items-end gap-2 text-sm">
        <input type="checkbox" {...form.register('activo')} />
        Activo
      </label>
      <CampoRol roles={roles} error={form.formState.errors.roleId?.message} registro={form.register('roleId')} />
      <div className="sm:col-span-2">
        <Alert tone="info">
          No se puede cambiar la contraseña desde acá: el backend no la acepta en la edición.
        </Alert>
        {error ? (
          <div className="mt-2">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
      </div>
    </form>
  )
}

function CampoNombre({
  registro,
  error,
}: {
  registro: ReturnType<ReturnType<typeof useForm<CreateUserFormValues>>['register']>
  error?: string
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">Nombre</span>
      <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...registro} />
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </label>
  )
}

function CampoEmail({
  registro,
  error,
}: {
  registro: ReturnType<ReturnType<typeof useForm<CreateUserFormValues>>['register']>
  error?: string
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">Email</span>
      <input type="email" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...registro} />
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </label>
  )
}

function CampoRol({
  roles,
  registro,
  error,
  crear = false,
}: {
  roles: Role[]
  registro: ReturnType<ReturnType<typeof useForm<CreateUserFormValues>>['register']>
  error?: string
  crear?: boolean
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">Rol</span>
      <select className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...registro}>
        {crear ? <option value={0}>Elegí un rol</option> : null}
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.nombre}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </label>
  )
}
