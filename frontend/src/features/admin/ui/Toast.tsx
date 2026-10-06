import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type Aviso = { id: number; tono: 'ok' | 'error'; texto: string }

type Avisos = {
  ok: (texto: string) => void
  error: (texto: string) => void
}

const ToastContext = createContext<Avisos | null>(null)

export function useToast() {
  const avisos = useContext(ToastContext)
  if (!avisos) {
    throw new Error('useToast tiene que usarse dentro de ToastProvider')
  }
  return avisos
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const publicar = useCallback((tono: Aviso['tono'], texto: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setAvisos((actual) => [...actual, { id, tono, texto }])
    window.setTimeout(() => {
      setAvisos((actual) => actual.filter((aviso) => aviso.id !== id))
    }, 4000)
  }, [])

  const valor = useMemo<Avisos>(
    () => ({
      ok: (texto) => publicar('ok', texto),
      error: (texto) => publicar('error', texto),
    }),
    [publicar],
  )

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[80] flex w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:translate-x-0"
        aria-live="polite"
      >
        {avisos.map((aviso) => (
          <p
            key={aviso.id}
            role="status"
            className={`pointer-events-auto rounded-2xl px-4 py-3 text-sm shadow-lg ${
              aviso.tono === 'ok' ? 'bg-slate-900 text-white' : 'bg-red-800 text-white'
            }`}
          >
            {aviso.texto}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
