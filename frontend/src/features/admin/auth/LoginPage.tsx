import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/http.ts'
import { BrandIntro, useIntroInicial } from '../ui/BrandIntro.tsx'
import { BrandLogo } from '../ui/BrandLogo.tsx'
import { Button } from '../ui/Button.tsx'
import { useAuth } from './AuthContext.tsx'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [identificador, setIdentificador] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { verIntro, setVerIntro } = useIntroInicial()

  const loginMutation = useMutation({
    mutationFn: () => login(identificador, password),
    onSuccess: () => {
      navigate('/admin', { replace: true })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 429) {
        // El backend ya manda un mensaje con el tiempo que falta, así que
        // se muestra tal cual en vez del genérico "Error 429".
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

    <>
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-parchment px-4 py-10">
        {/* Halo de marca detrás de la tarjeta: el mismo rojo del "GyG". */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07] blur-3xl"
          style={{ background: 'radial-gradient(circle, #A3221C 0%, transparent 68%)' }}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-sm animate-brand-reveal">
          <div className="mb-8 flex flex-col items-center text-center">
            <BrandLogo size="lg" />
            <span className="mt-4 h-px w-12 bg-gold/60" aria-hidden="true" />
            <p className="mt-4 text-sm text-muted">Ingreso al panel de administración</p>
          </div>

          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-card border border-line bg-surface p-6 shadow-lift"
          >
            {error ? (
              <p className="rounded-[0.625rem] border border-brand/25 bg-brand-soft px-3.5 py-2.5 text-sm text-brand-deep">
                {error}
              </p>
            ) : null}

            <label className="block text-sm">
              <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
                Correo
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-[0.625rem] border border-line bg-parchment px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-brand focus:bg-surface"
                required
                autoComplete="username"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
                Contraseña
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-[0.625rem] border border-line bg-parchment px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-brand focus:bg-surface"
                required
                autoComplete="current-password"
              />
            </label>

            <Button
              type="submit"
              variante="primario"
              disabled={loginMutation.isPending}
              className="w-full"
            >
              {loginMutation.isPending ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted">
            Disprova GyG · distribución
          </p>
        </div>
      </div>

      {verIntro ? <BrandIntro onFinish={() => setVerIntro(false)} /> : null}
    </>
  )
}
