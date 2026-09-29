import { apiRequest } from './http.ts'
import type { AuthUser, CashSession, CashSessionFilters } from './types.ts'

/**
 * Caja abierta del usuario. El backend responde 404 cuando no tiene ninguna, así
 * que "no hay caja" es un ApiError con status 404, no un `null`.
 */
export function getCurrentSession() {
  return apiRequest<CashSession>('/api/cash-sessions/current')
}

export function openSession(fondoInicial: string) {
  return apiRequest<CashSession>('/api/cash-sessions', {
    method: 'POST',
    body: { fondoInicial },
  })
}

/** El backend calcula el esperado y la diferencia, y los devuelve ya cerrados. */
export function closeSession(id: number, conteoFinal: string) {
  return apiRequest<CashSession>(`/api/cash-sessions/${id}/close`, {
    method: 'POST',
    body: { conteoFinal },
  })
}

/** Solo admin: el backend rechaza con 403 cualquier otro rol. */
export function listSessions(filters: CashSessionFilters = {}) {
  const params = new URLSearchParams()
  if (filters.userId) {
    params.set('userId', String(filters.userId))
  }
  if (filters.desde) {
    params.set('desde', filters.desde)
  }
  if (filters.hasta) {
    params.set('hasta', filters.hasta)
  }
  const query = params.toString()
  return apiRequest<CashSession[]>(`/api/cash-sessions${query ? `?${query}` : ''}`)
}

/**
 * Usuarios para el filtro de "caja por vendedor". El listado de cajas solo
 * devuelve el `userId`, así que hace falta el nombre para que la tabla se lea.
 * Es admin-only, igual que `listSessions`.
 */
export function listSessionOwners() {
  return apiRequest<AuthUser[]>('/api/users')
}