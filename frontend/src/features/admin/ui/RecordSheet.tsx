import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function RecordSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded-full border border-slate-300 px-3 text-sm">
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function RowMoves({
  onView,
  editTo,
  onEdit,
  onDisable,
  disableLabel = 'Deshabilitar',
}: {
  onView: () => void
  editTo?: string
  onEdit?: () => void
  onDisable?: () => void
  disableLabel?: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onView} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium">
        Ver
      </button>
      {editTo ? (
        <Link to={editTo} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium">
          Editar
        </Link>
      ) : null}
      {onEdit ? (
        <button type="button" onClick={onEdit} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium">
          Editar
        </button>
      ) : null}
      {onDisable ? (
        <button type="button" onClick={onDisable} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium">
          {disableLabel}
        </button>
      ) : null}
    </div>
  )
}
