import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/http.ts'
import { useAuth } from './AuthContext.tsx'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [identificador, setIdentificador] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loginMutation = useMutation({
    mutationFn: () => login(identificador, password),
    onSuccess: () => {
      navigate('/admin', { replace: true })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 429) {
        setError(err.message)
        return
      }
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión')
    },
  })

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    loginMutation.mutate()
  }

  return (
    <div className="grid min-h-screen bg-slate-50 font-body lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-slate-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -left-16 top-10 h-56 w-56 rounded-full bg-[var(--store-accent)]/80 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-amber-400/30 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/70">Distribución</p>
          <h1 className="mt-4 max-w-md font-display text-6xl font-semibold leading-none">Disprova GyG</h1>
          <div className="mt-6 h-1 w-16 bg-[var(--store-accent)]" />
        </div>
        <p className="relative max-w-sm text-lg text-white/80">
          Ruta, pedidos y catálogo en un solo lugar. Entra con tu usuario.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <form onSubmit={onSubmit} className="w-full max-w-md space-y-5">
          <div className="lg:hidden">
            <h1 className="font-display text-4xl font-semibold">Disprova GyG</h1>
            <div className="mt-3 h-1 w-12 bg-[var(--store-accent)]" />
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Acceso</p>
            <h2 className="mt-1 font-display text-3xl font-semibold">Hola de nuevo</h2>
          </div>
          {error ? (
            <p className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm">{error}</p>
          ) : null}
          <label className="block text-sm">
            <span className="mb-2 block font-medium">Usuario o correo</span>
            <input
              value={identificador}
              onChange={(event) => setIdentificador(event.target.value)}
              autoComplete="username"
              className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block font-medium">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="min-h-12 w-full rounded-2xl bg-slate-900 text-base font-medium text-white disabled:opacity-60"
          >
            {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="text-sm text-slate-500">La demo entra con el usuario admin.</p>
        </form>
      </section>
    </div>
  )
}
