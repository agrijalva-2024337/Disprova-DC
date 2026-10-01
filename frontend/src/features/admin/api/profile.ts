import { apiRequest } from './http.ts'
import type { AuthUser } from './types.ts'

export type ProfileInput = {
  nombre?: string
  usuario?: string
  avatarUrl?: string | null
}

export function getMe() {
  return apiRequest<AuthUser>('/api/auth/me')
}

export function updateMe(input: ProfileInput) {
  return apiRequest<AuthUser>('/api/auth/me', { method: 'PATCH', body: input })
}
