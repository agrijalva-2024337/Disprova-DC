import { apiRequest } from './http.ts'

export type OrderEstado = 'borrador' | 'confirmado' | 'entregado_parcial' | 'entregado' | 'cancelado'
export type OrderCanal = 'campo' | 'web' | 'whatsapp'
export type CondicionPago = 'contado' | 'credito'

export type AdminOrderItem = {
  id: number
  productUnitId: number
  cantidad: string
  precioUnitario: string
  totalLinea: string
  productUnit: {
    id: number
    nombre: string
    product: { id: number; nombre: string; sku: string }
  }
  deliveryItems?: Array<{ cantidadEntregada: string }>
}

export type AdminOrder = {
  id: number
  numero: string
  clientId: number
  userId: number
  canal: OrderCanal
  estado: OrderEstado
  condicionPago: CondicionPago
  total: string
  createdAt: string
  client?: { id: number; nombreComercial: string }
  user?: { id: number; nombre: string }
  items: AdminOrderItem[]
}

export type OrderListFilters = {
  clientId?: number
  estado?: OrderEstado
  canal?: OrderCanal
}

export function listOrders(filters: OrderListFilters = {}) {
  const params = new URLSearchParams()
  if (filters.clientId) {
    params.set('clientId', String(filters.clientId))
  }
  if (filters.estado) {
    params.set('estado', filters.estado)
  }
  if (filters.canal) {
    params.set('canal', filters.canal)
  }
  const query = params.toString()
  return apiRequest<AdminOrder[]>(`/api/orders${query ? `?${query}` : ''}`)
}

export function getOrder(id: number) {
  return apiRequest<AdminOrder>(`/api/orders/${id}`)
}

export function confirmOrder(id: number) {
  return apiRequest<AdminOrder>(`/api/orders/${id}/confirm`, { method: 'POST' })
}

export function cancelOrder(id: number) {
  return apiRequest<AdminOrder>(`/api/orders/${id}/cancel`, { method: 'POST' })
}

export function cantidadEntregada(item: AdminOrderItem) {
  return (item.deliveryItems ?? []).reduce((sum, row) => sum + Number(row.cantidadEntregada), 0)
}
