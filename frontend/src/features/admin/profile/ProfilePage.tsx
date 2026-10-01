import { useMutation } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/http.ts'
import { updateMe } from '../api/profile.ts'
import { useAuth } from '../auth/AuthContext.tsx'
import { Alert } from '../ui/Status.tsx'

const MAX_BYTES = 180_000

export function ProfilePage() {
  const { user, applyUser } = useAuth()
  const [nombre, setNombre] = useState(user?.nombre ?? '')
  const [usuario, setUsuario] = useState(user?.usuario ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!user) {
      return
    }
    setNombre(user.nombre)
    setUsuario(user.usuario ?? '')
    setAvatarUrl(user.avatarUrl)
  }, [user])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateMe({
        nombre: nombre.trim(),
        usuario: usuario.trim(),
        avatarUrl,
      }),
    onSuccess: (perfil) => {
      applyUser(perfil)
      setError(null)
      setOk(true)
    },
    onError: (err) => {
      setOk(false)
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el perfil')
    },
  })

  function onFile(file: File | undefined) {
    setOk(false)
    if (!file) {
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Usa una imagen JPG, PNG o WebP')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('La imagen debe pesar menos de 180 KB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarUrl(typeof reader.result === 'string' ? reader.result : null)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setOk(false)
    setError(null)
    saveMutation.mutate()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-semibold">Tu perfil</h1>
      <p className="mt-1 text-sm text-slate-600">Foto, nombre y el usuario con el que entras.</p>
      <form onSubmit={onSubmit} className="ficha mt-6 grid gap-6 md:grid-cols-[180px_1fr]">
        <div className="flex flex-col items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-36 w-36 rounded-full object-cover" />
          ) : (
            <div className="flex h-36 w-36 items-center justify-center rounded-full bg-slate-100 font-display text-4xl">
              {(nombre || user?.email || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <label className="cursor-pointer rounded-full border border-slate-300 px-3 py-2 text-sm font-medium">
            Cambiar foto
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => onFile(event.target.files?.[0])}
            />
          </label>
          {avatarUrl ? (
            <button type="button" className="text-sm text-slate-600 underline" onClick={() => setAvatarUrl(null)}>
              Quitar foto
            </button>
          ) : null}
        </div>
        <div className="space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          {ok ? <Alert tone="success">Perfil actualizado.</Alert> : null}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nombre</span>
            <input value={nombre} onChange={(event) => setNombre(event.target.value)} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Usuario</span>
            <input
              value={usuario}
              onChange={(event) => setUsuario(event.target.value)}
              autoComplete="username"
              required
              minLength={3}
            />
            <span className="mt-1 block text-xs text-slate-500">Si ya existe, no se guarda.</span>
          </label>
          <p className="text-sm text-slate-500">Correo: {user?.email}</p>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="min-h-11 rounded-full bg-slate-900 px-5 text-sm font-medium text-white disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Guardando…' : 'Guardar perfil'}
          </button>
        </div>
      </form>
    </div>
  )
}
