import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/http.ts'
import { useAuth } from './AuthContext.tsx'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@disprova.local')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: () => {
      navigate('/admin/productos', { replace: true })
    },
    onError: (err) => {
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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Disprova GyG</h1>
          <p className="text-sm text-slate-600">Ingreso al panel de administración</p>
        </div>
        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Correo</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            required
            autoComplete="username"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            required
            autoComplete="current-password"
          />
        </label>
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loginMutation.isPending ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
