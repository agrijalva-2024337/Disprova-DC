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
