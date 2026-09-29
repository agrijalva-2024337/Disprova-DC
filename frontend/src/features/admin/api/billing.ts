import { apiRequest } from './http.ts'
import type { Invoice, InvoiceEstado } from './types.ts'

/** El listado y la emisión son admin-only en el backend. */

/** Facturas de la más reciente a la más vieja, con su pedido y su cliente. */
export function listInvoices(estado?: InvoiceEstado) {
  const query = estado ? `?estado=${estado}` : ''
  return apiRequest<Invoice[]>(`/api/invoices${query}`)
}

/** Factura de un pedido. Responde 404 si el pedido todavía no tiene factura. */
export function getInvoiceForOrder(orderId: number) {
  return apiRequest<Invoice>(`/api/orders/${orderId}/invoice`)
}

/**
 * Emite la factura de un pedido entregado a mano. La serie es opcional: si no
 * se manda, el backend usa la de `FEL_SERIE`.
 *
 * Nota: sin certificador configurado la factura queda en
 * `pendiente_certificacion`, y eso NO es un error. Solo queda en `error` cuando
 * un proveedor real falla.
 */
export function createInvoiceForOrder(orderId: number, serie?: string) {
  return apiRequest<Invoice>(`/api/orders/${orderId}/invoice`, {
    method: 'POST',
    body: serie ? { serie } : {},
  })
}