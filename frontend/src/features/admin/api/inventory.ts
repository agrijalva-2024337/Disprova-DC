import { apiRequest } from './http.ts'

export type InventoryWarehouse = {
  id: number
  nombre: string
  tipo: 'bodega' | 'vehiculo'
  activo: boolean
}

export type StockBatch = {
  id: number
  lote: string
  fechaVencimiento: string | null
}

export type StockRow = {
  id: number
  productId: number
  warehouseId: number
  batchId: number | null
  cantidad: string
  cantidadReservada: string
  disponible: string
  product: { id: number; sku: string; nombre: string; controlado: boolean }
  warehouse: { id: number; nombre: string }
  batch: StockBatch | null
}

export type InventoryMovement = {
  id: number
  productId: number
  warehouseId: number
  batchId: number | null
  tipo: string
  cantidad: string
  referenciaTipo: string | null
  referenciaId: string | null
  createdAt: string
  warehouse: { id: number; nombre: string }
  batch: StockBatch | null
}

export function listWarehouses() {
  return apiRequest<InventoryWarehouse[]>('/api/inventory/warehouses')
}

export function listStock(filters: { warehouseId?: number; productId?: number }) {
  const params = new URLSearchParams()
  if (filters.warehouseId) params.set('warehouseId', String(filters.warehouseId))
  if (filters.productId) params.set('productId', String(filters.productId))
  const query = params.toString()
  return apiRequest<StockRow[]>(`/api/inventory/stock${query ? `?${query}` : ''}`)
}

export function listMovements(productId: number) {
  return apiRequest<InventoryMovement[]>(`/api/inventory/movements?productId=${productId}`)
}

export function transferStock(input: {
  productId: number
  warehouseIdOrigen: number
  warehouseIdDestino: number
  batchId?: number | null
  cantidad: string
}) {
  return apiRequest<{ referenciaId: string }>('/api/inventory/movements/traslado', {
    method: 'POST',
    body: input,
  })
}

export function adjustStock(input: {
  productId: number
  warehouseId: number
  batchId?: number | null
  cantidad: string
  motivo: string
}) {
  return apiRequest<{ id: number }>('/api/inventory/movements/ajuste', {
    method: 'POST',
    body: input,
  })
}
