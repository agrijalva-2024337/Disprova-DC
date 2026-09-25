import { apiRequest } from './http.ts'
import type {
  Client,
  ClientContact,
  ClientContactInput,
  ClientInput,
  RouteVisitInput,
  TodayRoute,
  Zone,
  ZoneInput,
} from './types.ts'

export function listZones() {
  return apiRequest<Zone[]>('/api/zones')
}

export function createZone(input: ZoneInput) {
  return apiRequest<Zone>('/api/zones', { method: 'POST', body: input })
}

export function updateZone(id: number, input: ZoneInput) {
  return apiRequest<Zone>(`/api/zones/${id}`, { method: 'PUT', body: input })
}

export function listClients() {
  return apiRequest<Client[]>('/api/clients')
}

export function getClient(id: number) {
  return apiRequest<Client>(`/api/clients/${id}`)
}

export function createClient(input: ClientInput) {
  return apiRequest<Client>('/api/clients', { method: 'POST', body: input })
}

export function updateClient(id: number, input: ClientInput) {
  return apiRequest<Client>(`/api/clients/${id}`, { method: 'PUT', body: input })
}

export function listContacts(clientId: number) {
  return apiRequest<ClientContact[]>(`/api/clients/${clientId}/contacts`)
}

export function createContact(clientId: number, input: ClientContactInput) {
  return apiRequest<ClientContact>(`/api/clients/${clientId}/contacts`, {
    method: 'POST',
    body: input,
  })
}

export function updateContact(clientId: number, contactId: number, input: ClientContactInput) {
  return apiRequest<ClientContact>(`/api/clients/${clientId}/contacts/${contactId}`, {
    method: 'PUT',
    body: input,
  })
}

export function deleteContact(clientId: number, contactId: number) {
  return apiRequest<void>(`/api/clients/${clientId}/contacts/${contactId}`, { method: 'DELETE' })
}

export function getTodayRoute() {
  return apiRequest<TodayRoute>('/api/route-visits/today')
}

export function createRouteVisit(input: RouteVisitInput) {
  return apiRequest<{ id: number }>('/api/route-visits', { method: 'POST', body: input })
}
