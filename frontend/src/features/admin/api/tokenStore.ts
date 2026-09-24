type TokenListener = () => void

let accessToken: string | null = null
let refreshToken: string | null = null
const listeners = new Set<TokenListener>()

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

export const tokenStore = {
  getAccessToken() {
    return accessToken
  },
  getRefreshToken() {
    return refreshToken
  },
  setTokens(nextAccess: string | null, nextRefresh: string | null) {
    accessToken = nextAccess
    refreshToken = nextRefresh
    notify()
  },
  clear() {
    accessToken = null
    refreshToken = null
    notify()
  },
  subscribe(listener: TokenListener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function isAccessTokenExpiring(token: string, skewMs = 30_000): boolean {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) {
      return true
    }
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    if (!payload.exp) {
      return true
    }
    return payload.exp * 1000 <= Date.now() + skewMs
  } catch {
    return true
  }
}
