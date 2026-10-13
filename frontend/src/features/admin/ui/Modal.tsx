import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from './ConfirmDialog.tsx'

const ENFOCABLES =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const anchos = {
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-3xl',
} as const

/**
 * Formulario del panel, encima de la tabla.
 * En el teléfono sube desde abajo; en escritorio queda centrado.
 */
export function Modal({
  title,
  size = 'md',
  onClose,
  dirty = false,
  saving = false,
  saveLabel = 'Guardar',
  formId,
  children,
}: {
  title: string
  size?: keyof typeof anchos
  onClose: () => void
  dirty?: boolean
  saving?: boolean
  saveLabel?: string
  formId: string
  children: ReactNode
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const quienAbrio = useRef<HTMLElement | null>(null)
  const [confirmarCierre, setConfirmarCierre] = useState(false)
  const dirtyRef = useRef(dirty)
  const savingRef = useRef(saving)
  const onCloseRef = useRef(onClose)
  const confirmarRef = useRef(false)

  useEffect(() => {
    dirtyRef.current = dirty
    savingRef.current = saving
    onCloseRef.current = onClose
    confirmarRef.current = confirmarCierre
  })

  function pedirCierre() {
    if (savingRef.current) return
    if (dirtyRef.current) {
      setConfirmarCierre(true)
      return
    }
    onCloseRef.current()
  }

  useEffect(() => {
    quienAbrio.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const primero = panelRef.current?.querySelector<HTMLElement>(ENFOCABLES)
    ;(primero ?? panelRef.current)?.focus()

    function onKey(event: KeyboardEvent) {
      if (confirmarRef.current) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (savingRef.current) return
        if (dirtyRef.current) setConfirmarCierre(true)
        else onCloseRef.current()
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6"
      onClick={pedirCierre}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl outline-none sm:rounded-3xl ${anchos[size]}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="font-display text-2xl font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={pedirCierre}
            aria-label="Cerrar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300 text-lg"
          >
            ×
          </button>
        </div>
        <div className="modal-campos min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={pedirCierre}
            className="min-h-11 rounded-full border border-slate-300 px-4 text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className="min-h-11 rounded-full bg-slate-900 px-5 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Guardando…' : saveLabel}
          </button>
        </div>
      </div>
      {confirmarCierre ? (
        <ConfirmDialog
          title="Cambios sin guardar"
          confirmLabel="Cerrar sin guardar"
          tone="neutro"
          onConfirm={onClose}
          onClose={() => setConfirmarCierre(false)}
        >
          Si cerrás ahora, lo que escribiste se pierde.
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
