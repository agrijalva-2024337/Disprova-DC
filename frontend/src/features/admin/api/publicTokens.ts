import { apiRequest } from './http.ts'
import type { ClientAccessToken } from './types.ts'

/**
 * Tokens del catálogo público.
 *
 * El backend expone UNA sola ruta de este módulo:
 * `POST /api/tokens/clients/:clientId` (admin). No hay ninguna más: no existe
 * un GET para listar los enlaces de un cliente, ni un DELETE ni un revoke.
 * Por eso acá solo hay `createToken`; inventar `listTokens` o `revokeToken`
 * rompería en runtime.
 *
 * `pathCatalogo` viene relativo (`/catalogo/<token>`), así que la URL completa
 * se arma acá con `window.location.origin`.
 */
export function createToken(clientId: number, expiresInDays?: number) {
  return apiRequest<ClientAccessToken>(`/api/tokens/clients/${clientId}`, {
    method: 'POST',
    body: { expiresInDays },
  })
}