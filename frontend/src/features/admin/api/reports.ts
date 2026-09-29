import { apiRequest } from './http.ts'
import type { AgingReportRow, CollectionsToday, SalesToday } from './types.ts'

/** Los tres reportes son admin-only: el backend responde 403 a cualquier otro rol. */

/** Vendido hoy, agrupado por vendedor y por condición de pago. */
export function getSalesToday() {
  return apiRequest<SalesToday>('/api/reports/sales-today')
}

/** Cobrado hoy, agrupado por vendedor. */
export function getCollectionsToday() {
  return apiRequest<CollectionsToday>('/api/reports/collections-today')
}

/** Antigüedad de saldos de todos los clientes, ya ordenada por deuda más vieja. */
export function getAgingReport() {
  return apiRequest<AgingReportRow[]>('/api/reports/aging')
}