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
  const [email, setEmail] = useState('admin@disprova.local')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { verIntro, setVerIntro } = useIntroInicial()

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: () => {
      navigate('/admin/productos', { replace: true })
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
    return <Navigate to="/admin/productos" replace />
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    loginMutation.mutate()
  }

  return (
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
