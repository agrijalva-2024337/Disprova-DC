import { apiRequest } from './http.ts'
import type {
  AccountStatement,
  AgingRow,
  ApplyPaymentInput,
  ClientAging,
  CollectionVisit,
  CollectionVisitInput,
  Payment,
  PaymentInput,
  PaymentWithApplications,
} from './types.ts'

/** Cuenta corriente del cliente. Los movimientos llegan del más antiguo al más nuevo. */
export function getAccount(clientId: number) {
  return apiRequest<AccountStatement>(`/api/clients/${clientId}/account`)
}

/** Antigüedad de la deuda de un cliente, en los buckets 0-15, 16-30, 31-60 y 60+. */
export function getAging(clientId: number) {
  return apiRequest<ClientAging>(`/api/clients/${clientId}/aging`)
}

/**
 * Antigüedad de todos los clientes con saldo. Vive en el módulo de reportes
 * porque el backend ya la devuelve ordenada poniendo primero la deuda más
 * vieja; no hay endpoint equivalente en cobranza.
 */
export function getAgingReport() {
  return apiRequest<AgingRow[]>('/api/reports/aging')
}

/**
 * El pago queda registrado pero no descuenta nada hasta que se aplique a
 * pedidos con `applyPayment`.
 */
export function createPayment(input: PaymentInput) {
  return apiRequest<Payment>('/api/payments', { method: 'POST', body: input })
}

/** Aplica un pago ya registrado a uno o varios pedidos del mismo cliente. */
export function applyPayment(paymentId: number, input: ApplyPaymentInput) {
  return apiRequest<PaymentWithApplications>(`/api/payments/${paymentId}/apply`, {
    method: 'POST',
    body: input,
  })
}

/** Visita de cobranza: sirve para dejar constancia aunque no se cobre nada. */
export function createCollectionVisit(input: CollectionVisitInput) {
  return apiRequest<CollectionVisit>('/api/collection-visits', {
    method: 'POST',
    body: input,
  })
}