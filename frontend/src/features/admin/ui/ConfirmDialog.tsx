import { useEffect, useId, useRef, type ReactNode } from 'react'

const ENFOCABLES =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Pregunta corta antes de deshabilitar, desactivar o anular.
 * También la usa el modal cuando hay cambios sin guardar.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  pending = false,
  tone = 'peligro',
  onConfirm,
  onClose,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  pending?: boolean
  tone?: 'peligro' | 'neutro'
  onConfirm: () => void
  onClose: () => void
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const quienAbrio = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    quienAbrio.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const primero = panelRef.current?.querySelector<HTMLElement>(ENFOCABLES)
    ;(primero ?? panelRef.current)?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      if (items.length === 0) return
      const primeroItem = items[0]
      const ultimo = items[items.length - 1]
      if (event.shiftKey && document.activeElement === primeroItem) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault()
        primeroItem.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      quienAbrio.current?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl outline-none sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="font-display text-xl font-semibold">
          {title}
        </h2>
        <div className="mt-3 text-sm text-slate-600">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full border border-slate-300 px-4 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`min-h-11 rounded-full px-4 text-sm font-medium text-white disabled:opacity-60 ${
              tone === 'peligro' ? 'bg-red-800 hover:bg-red-900' : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {pending ? 'Guardando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
