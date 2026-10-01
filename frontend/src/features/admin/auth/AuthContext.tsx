import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { login as loginRequest } from '../api/catalog.ts'
import { getMe } from '../api/profile.ts'
import { tokenStore } from '../api/tokenStore.ts'
import type { AuthUser } from '../api/types.ts'

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (identificador: string, password: string) => Promise<void>
  applyUser: (user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [hasToken, setHasToken] = useState(() => Boolean(tokenStore.getAccessToken()))

  useEffect(() => {
    return tokenStore.subscribe(() => {
      setHasToken(Boolean(tokenStore.getAccessToken()))
      if (!tokenStore.getAccessToken()) {
        setUser(null)
      }
    })
  }, [])

  useEffect(() => {
    if (!hasToken || user) {
      return
    }
    let cancelado = false
    getMe()
      .then((perfil) => {
        if (!cancelado) {
          setUser(perfil)
        }
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [hasToken, user])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: hasToken,
      async login(identificador: string, password: string) {
        const result = await loginRequest(identificador, password)
        tokenStore.setTokens(result.accessToken, result.refreshToken)
        setUser(result.user)
      },
      applyUser(next: AuthUser) {
        setUser(next)
      },
      logout() {
        tokenStore.clear()
        setUser(null)
      },
    }),
    [hasToken, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
