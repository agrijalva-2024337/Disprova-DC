import { apiRequest } from './http.ts'
import type { CreateReturnInput, MerchandiseReturn } from './types.ts'

/**
 * Devoluciones: el backend solo expone crear, aceptar y rechazar. No hay
 * ningún GET de listado ni de detalle, asi que no hay función para listar acá:
 * inventarla seria romper en runtime. Queda pendiente el endpoint de backend
 * (ver el aviso de DISP-032).
 */

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