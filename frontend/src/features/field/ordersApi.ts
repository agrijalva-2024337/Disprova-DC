import { apiRequest } from '../admin/api/http.ts'
import type { PriceList, Product } from '../admin/api/types.ts'

export type FieldOrderItem = {
  id: number
  productUnitId: number
  cantidad: string
  precioUnitario: string
  totalLinea: string
  productUnit: { id: number; nombre: string; product: { id: number; nombre: string; sku: string } }
  deliveryItems?: Array<{ cantidadEntregada: string }>
}

export type FieldOrder = {
  id: number
  numero: string
  clientId: number
  estado: string
  condicionPago: string
  total: string
  client?: { id: number; nombreComercial: string; priceListId: number }
  items: FieldOrderItem[]
}

export function getClient(id: number) {
  return apiRequest<{ id: number; nombreComercial: string; priceListId: number }>(`/api/clients/${id}`)
}

export function listProducts() {
  return apiRequest<Product[]>('/api/catalog/products')
}

export function getPriceList(id: number) {
  return apiRequest<PriceList>(`/api/catalog/price-lists/${id}`)
}

export function listOrders(clientId?: number) {
  const query = clientId ? `?clientId=${clientId}` : ''
  return apiRequest<FieldOrder[]>(`/api/orders${query}`)
}

export function listPendingDeliveries() {
  return apiRequest<FieldOrder[]>('/api/orders?pendientes=1')
}

export function createOrder(input: {
  clientId: number
  canal: 'campo'
  condicionPago: 'contado' | 'credito'
  /**
   * Se manda la MISMA clave en cada reintento del mismo pedido. Con mala señal
   * el vendedor aprieta "guardar" dos veces; sin la clave el backend abre dos
   * pedidos. El backend responde 200 con el pedido ya creado cuando la clave
   * se repite, así que el segundo toque no duplica nada.
   */
  idempotencyKey?: string
  items: Array<{ productUnitId: number; cantidad: string }>
}) {
  return apiRequest<FieldOrder>('/api/orders', { method: 'POST', body: input })
}

export function confirmOrder(id: number) {
  return apiRequest<FieldOrder>(`/api/orders/${id}/confirm`, { method: 'POST' })
}

export function deliverOrder(
  id: number,
  items: Array<{ orderItemId: number; cantidadEntregada: string }>,
) {
  return apiRequest<{ order: FieldOrder }>(`/api/orders/${id}/deliver`, {
    method: 'POST',
    body: { items },
  })
}

// --- Cobranza en ruta ---

/**
 * Un pago en efectivo exige una caja abierta: el backend responde 409
 * `CASH_SESSION_REQUIRED` si no la hay. Por eso el formulario de cobro pide
 * el monto y el método, y el backend decide a qué sesión imputarlo.
 */
export type FieldPayment = {
  id: number
  clientId: number
  monto: string
  metodo: 'efectivo' | 'transferencia' | 'cheque'
  referencia: string | null
  createdAt: string
}

export type FieldAccountMovement = {
  id: number
  tipo: 'cargo' | 'abono'
  monto: string
  saldoResultante: string
  fecha: string
}

export type FieldAccount = {
  saldoActual: string
  movements: FieldAccountMovement[]
}

export type FieldCollectionVisitInput = {
  clientId: number
  resultado: 'pago_completo' | 'pago_parcial' | 'compromiso' | 'sin_contacto'
  montoComprometido?: string | null
  fechaCompromiso?: string | null
  observaciones?: string | null
}

export function getAccount(clientId: number) {
  return apiRequest<FieldAccount>(`/api/clients/${clientId}/account`)
}

/** Registra el pago. Queda pendiente de aplicar a pedidos hasta que se use `applyPayment`. */
export function createPayment(input: {
  clientId: number
  monto: string
  metodo: 'efectivo' | 'transferencia' | 'cheque'
  referencia?: string | null
}) {
  return apiRequest<FieldPayment>('/api/payments', { method: 'POST', body: input })
}

export function createCollectionVisit(input: FieldCollectionVisitInput) {
  return apiRequest<unknown>('/api/collection-visits', { method: 'POST', body: input })
}
