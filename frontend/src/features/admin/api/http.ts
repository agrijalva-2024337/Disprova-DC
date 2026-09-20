import { isAccessTokenExpiring, tokenStore } from './tokenStore.ts'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type RequestOptions = {
  method?: string
  body?: unknown
  skipAuth?: boolean
}

let refreshInFlight: Promise<boolean> | null = null

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: { message?: string } }
    return data.error?.message ?? `Error ${response.status}`
  } catch {
    return `Error ${response.status}`
  }
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = tokenStore.getRefreshToken()
  if (!refreshToken) {
    tokenStore.clear()
    return false
  }

  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) {
    tokenStore.clear()
    return false
  }

  const data = (await response.json()) as {
    accessToken: string
    refreshToken: string
  }
  tokenStore.setTokens(data.accessToken, data.refreshToken)
  return true
}

async function ensureAccessToken(): Promise<string | null> {
  const access = tokenStore.getAccessToken()
  const refresh = tokenStore.getRefreshToken()
  if (!refresh) {
    return access
  }
  if (access && !isAccessTokenExpiring(access)) {
    return access
  }
  if (!refreshInFlight) {
    refreshInFlight = refreshSession().finally(() => {
      refreshInFlight = null
    })
  }
  const ok = await refreshInFlight
  return ok ? tokenStore.getAccessToken() : null
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (!options.skipAuth) {
    const token = await ensureAccessToken()
    if (!token) {
      throw new ApiError('No autenticado', 401)
    }
    headers.Authorization = `Bearer ${token}`
  }

  const doFetch = () =>
    fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })

  let response = await doFetch()

  if (response.status === 401 && !options.skipAuth) {
    if (!refreshInFlight) {
      refreshInFlight = refreshSession().finally(() => {
        refreshInFlight = null
      })
    }
    const refreshed = await refreshInFlight
    const nextToken = tokenStore.getAccessToken()
    if (!refreshed || !nextToken) {
      throw new ApiError('No autenticado', 401)
    }
    headers.Authorization = `Bearer ${nextToken}`
    response = await doFetch()
  }

  if (response.status === 204) {
    return undefined as T
  }

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status)
  }

  return (await response.json()) as T
}
