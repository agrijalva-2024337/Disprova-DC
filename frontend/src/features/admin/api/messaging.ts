import { apiRequest } from './http.ts'
import type {
  BroadcastLink,
  ClientLink,
  MessageLog,
  MessageTemplate,
  MessageTemplateInput,
} from './types.ts'

/** Listado: cualquiera autenticado. Alta, edición y desactivación: solo admin. */
export function listTemplates() {
  return apiRequest<MessageTemplate[]>('/api/messaging/templates')
}

export function createTemplate(input: MessageTemplateInput) {
  return apiRequest<MessageTemplate>('/api/messaging/templates', { method: 'POST', body: input })
}

export function updateTemplate(id: number, input: Partial<MessageTemplateInput>) {
  return apiRequest<MessageTemplate>(`/api/messaging/templates/${id}`, {
    method: 'PUT',
    body: input,
  })
}

/** No borra: la plantilla queda con `activo: false`. */
export function deactivateTemplate(id: number) {
  return apiRequest<MessageTemplate>(`/api/messaging/templates/${id}/deactivate`, {
    method: 'PATCH',
  })
}

/**
 * Arma el link de wa.me con el texto ya resuelto y deja un `MessageLog` en
 * estado `generado`. Funciona siempre, sin importar `WHATSAPP_PROVIDER`.
 * Acá `templateId` va como query param, no en el body.
 */
export function getClientLink(clientId: number, templateId: number) {
  return apiRequest<ClientLink>(
    `/api/messaging/clients/${clientId}/link?templateId=${templateId}`,
  )
}

/**
 * Envío automático. Solo admin, y solo si `WHATSAPP_PROVIDER=business_api`:
 * con el proveedor `wa_link` el backend responde 422
 * `WHATSAPP_SEND_NOT_CONFIGURED`, que es el comportamiento normal de hoy y la
 * UI lo muestra como aviso, no como error.
 */
export function sendToClient(clientId: number, templateId: number) {
  return apiRequest<MessageLog>(
    `/api/messaging/clients/${clientId}/send?templateId=${templateId}`,
    { method: 'POST' },
  )
}

/** Historial del cliente, del más reciente al más viejo. */
export function getClientHistory(clientId: number) {
  return apiRequest<MessageLog[]>(`/api/messaging/clients/${clientId}/history`)
}

/** Links de la zona activa de hoy. No envía nada: devuelve los links. */
export function getBroadcastToday(templateId: number) {
  return apiRequest<BroadcastLink[]>('/api/messaging/broadcast/today', {
    method: 'POST',
    body: { templateId },
  })
}