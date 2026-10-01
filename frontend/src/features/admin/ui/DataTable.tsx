import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'

/**
 * Tabla de datos con la piel de marca.
 *
 * No cambia el marcado que ya usan las pantallas: soloEnvuelve el <table> y
 * aplica encabezado, bordes y hover. El th y el td aceptan className para los
 * casos donde una columna particular necesita alineación distinta.
 */
export function DataTable({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`overflow-x-auto rounded-card border border-line bg-surface shadow-card ${className}`}
    >
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  )
}

export function Th({
  align = 'left',
  className = '',
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  const alineacion = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th
      {...rest}
      className={`px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted ${alineacion} ${className}`}
    />
  )
}

export function Td({
  align = 'left',
  className = '',
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  const alineacion = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return <td {...rest} className={`px-4 py-3 text-ink-soft ${alineacion} ${className}`} />
}

export function Tr({
  className = '',
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      {...rest}
      className={`border-t border-line/70 transition-colors hover:bg-brand-soft/40 ${className}`}
    />
  )
}

/** Fila para tablas sin resultados: una sola celda que avisa en vez de una grilla vacía. */
export function EmptyRow({ columnas, children }: { columnas: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={columnas} className="px-4 py-12 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  )
}