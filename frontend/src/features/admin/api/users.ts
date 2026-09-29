import { apiRequest } from './http.ts'
import type { AuthUser, CreateUserInput, Role, UpdateUserInput } from './types.ts'

/** Todo el módulo es admin-only en el backend: cualquier otro rol recibe 403. */

/**
 * `GET /api/users` devuelve el mismo DTO que el login (`toDto` en
 * users.service), así que se reusa `AuthUser`. El `passwordHash` nunca sale.
 *
 * Ojo: no hay `GET /api/users/:id`. Para editar se usan los datos que ya
 * vienen en la lista.
 */
export function listUsers(activo?: boolean) {
  const query = activo === undefined ? '' : `?activo=${activo}`
  return apiRequest<AuthUser[]>(`/api/users${query}`)
}

export function createUser(input: CreateUserInput) {
  return apiRequest<AuthUser>('/api/users', { method: 'POST', body: input })
}

/** Actualiza nombre, email, rol y activo. La contraseña no se puede tocar acá. */
export function updateUser(id: number, input: UpdateUserInput) {
  return apiRequest<AuthUser>(`/api/users/${id}`, { method: 'PUT', body: input })
}

export function listRoles() {
  return apiRequest<Role[]>('/api/roles')
}