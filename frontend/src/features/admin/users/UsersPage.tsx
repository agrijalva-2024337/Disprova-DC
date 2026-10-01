import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createUser, listRoles, listUsers, updateUser } from '../api/users.ts'
import { ApiError } from '../api/http.ts'
import { useAuth } from '../auth/AuthContext.tsx'
import { Alert, QueryStatus } from '../ui/Status.tsx'
import { RecordSheet, RowMoves } from '../ui/RecordSheet.tsx'
import type { AuthUser } from '../api/types.ts'
import { AddButton, ModuleHead, SearchBox } from '../ui/ListTools.tsx'
import { CreateUserForm } from './CreateUserForm.tsx'
import { EditUserForm } from './EditUserForm.tsx'
import type { CreateUserFormValues, UpdateUserFormValues } from './userFormSchema.ts'

export function UsersPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState<AuthUser | null>(null)
  const [visto, setVisto] = useState<AuthUser | null>(null)
  const [alta, setAlta] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [rolFiltro, setRolFiltro] = useState('')

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => listUsers() })
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: listRoles })
  const roles = rolesQuery.data ?? []

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      setAlta(false)
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: UpdateUserFormValues }) =>
      updateUser(id, {
        nombre: values.nombre,
        email: values.email,
        roleId: values.roleId,
        activo: values.activo,
      }),
    onSuccess: async () => {
      setEditando(null)
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  // El módulo es admin-only. Ojo: tras recargar la página AuthContext todavía no
  // tiene `user` (solo el token), así que un null NO significa "no es admin":
  // se bloquea solo cuando sabemos con certeza que no lo es. El backend igual
  // responde 403 a quien no sea admin.
  if (user && !isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <Alert tone="error">Solo un administrador puede administrar usuarios y roles.</Alert>
      </div>
    )
  }

  const createError = createMutation.isError
    ? createMutation.error instanceof ApiError
      ? createMutation.error.message
      : 'No se pudo crear el usuario'
    : null
  const updateError = updateMutation.isError
    ? updateMutation.error instanceof ApiError
      ? updateMutation.error.message
      : 'No se pudo guardar el usuario'
    : null

  return (
    <div className="space-y-6">
      <ModuleHead
        title="Usuarios"
        text="Quién entra al sistema y con qué permisos."
        action={<AddButton onClick={() => setAlta((value) => !value)}>Agregar usuario</AddButton>}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre, usuario o correo" />
        <select
          value={rolFiltro}
          onChange={(event) => setRolFiltro(event.target.value)}
          className="min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm"
        >
          <option value="">Todos los roles</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.nombre}
            </option>
          ))}
        </select>
      </div>

      {alta ? (
      <section className="ficha max-w-xl">
        <h2 className="text-sm font-semibold">Nuevo usuario</h2>
        <CreateUserForm
          roles={roles}
          onSubmit={(values: CreateUserFormValues) => createMutation.mutate(values)}
          isPending={createMutation.isPending}
          error={createError}
        />
      </section>
      ) : null}

      <QueryStatus
        isLoading={usersQuery.isLoading || rolesQuery.isLoading}
        errorMessage={
          usersQuery.isError || rolesQuery.isError ? 'No se pudieron cargar los usuarios' : null
        }
      />

      {editando ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">Editar {editando.nombre}</h2>
          <div className="mt-4">
            <EditUserForm
              key={editando.id}
              usuario={editando}
              roles={roles}
              onSubmit={(values) => updateMutation.mutate({ id: editando.id, values })}
              onCancel={() => setEditando(null)}
              isPending={updateMutation.isPending}
              error={updateError}
            />
          </div>
        </section>
      ) : null}

      {!usersQuery.isLoading && !usersQuery.isError ? (
        <div className="registros">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Rol</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(usersQuery.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    No hay usuarios para mostrar.
                  </td>
                </tr>
              ) : (
                (usersQuery.data ?? [])
                  .filter((row) => {
                    const term = busqueda.trim().toLowerCase()
                    const coincide =
                      !term ||
                      row.nombre.toLowerCase().includes(term) ||
                      row.email.toLowerCase().includes(term) ||
                      (row.usuario ?? '').toLowerCase().includes(term)
                    return coincide && (!rolFiltro || row.roleId === Number(rolFiltro))
                  })
                  .map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-slate-100"
                    onDoubleClick={() => setVisto(row)}
                  >
                    <td className="px-3 py-2 font-medium">{row.nombre}</td>
                    <td className="px-3 py-2">{row.email}</td>
                    <td className="px-3 py-2">{row.rol}</td>
                    <td className="px-3 py-2">
                      {row.activo ? (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                          Activo
                        </span>
                      ) : (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <RowMoves
                        onView={() => setVisto(row)}
                        onEdit={() => setEditando(row)}
                        onDisable={
                          row.activo
                            ? () =>
                                updateMutation.mutate({
                                  id: row.id,
                                  values: {
                                    nombre: row.nombre,
                                    email: row.email,
                                    roleId: row.roleId,
                                    activo: false,
                                  },
                                })
                            : undefined
                        }
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
      {visto ? (
        <RecordSheet title={visto.nombre} onClose={() => setVisto(null)}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Correo</dt>
              <dd>{visto.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Usuario</dt>
              <dd>{visto.usuario || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Rol</dt>
              <dd>{visto.rol}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Estado</dt>
              <dd>{visto.activo ? 'Activo' : 'Inactivo'}</dd>
            </div>
          </dl>
        </RecordSheet>
      ) : null}
    </div>
  )
}
