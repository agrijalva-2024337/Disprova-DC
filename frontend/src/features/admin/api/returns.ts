import { apiRequest } from './http.ts'
import type { CreateReturnInput, MerchandiseReturn, ReturnEstado } from './types.ts'

export type ReturnListFilters = {
  estado?: ReturnEstado
  clientId?: number
}

export type ReturnListRow = {
  id: number
  clientId: number
  orderId: number
  fecha: string
  motivo: string
  estado: ReturnEstado
  total: string
  createdAt: string
  client: { nombreComercial: string }
  order: { numero: string }
}

export type ReturnListResponse = {
  data: ReturnListRow[]
  meta: {
    total: number
    limit: number
    offset: number
    count: number
    hasMore: boolean
  }
}

export function listReturns(filtros: ReturnListFilters = {}) {
  const params = new URLSearchParams()
  if (filtros.estado) {
    params.set('estado', filtros.estado)
  }
  if (filtros.clientId) {
    params.set('clientId', String(filtros.clientId))
  }
  const query = params.toString()
  return apiRequest<ReturnListResponse>(`/api/returns${query ? `?${query}` : ''}`)
}

export function getReturn(id: number) {
  return apiRequest<MerchandiseReturn>(`/api/returns/${id}`)
}

/** Registra la devolución en estado `pendiente`. El total se calcula al aceptarla. */
export function createReturn(input: CreateReturnInput) {
  return apiRequest<MerchandiseReturn>('/api/returns', { method: 'POST', body: input })
}

/** Solo admin. Reingresa el stock, registra la merma y abona la cuenta. */
export function acceptReturn(id: number) {
  return apiRequest<MerchandiseReturn>(`/api/returns/${id}/accept`, { method: 'POST' })
}

/** Solo admin. No toca stock ni saldo. */
export function rejectReturn(id: number) {
  return apiRequest<MerchandiseReturn>(`/api/returns/${id}/reject`, { method: 'POST' })
}