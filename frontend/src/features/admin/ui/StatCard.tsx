import type { ReactNode } from 'react'

/**
 * Tarjeta de indicador del panel.
 *
 * El número va en la serif de marca y con cifras tabulares: las cifras de
 * dinero tienen que alinearse entre tarjetas para poder comparse de un golpe.
 */
export function StatCard({
  label,
  value,
  detalle,
  tono = 'neutro',
  icono,
}: {
  label: string
  value: string
  detalle?: ReactNode
  tono?: 'neutro' | 'alerta' | 'destacado'
  icono?: ReactNode
}) {
  const acentos = {
    neutro: { valor: 'text-ink', filete: 'bg-line' },
    alerta: { valor: 'text-brand', filete: 'bg-brand' },
    destacado: { valor: 'text-gold', filete: 'bg-gold' },
  }[tono]

  return (
    <div className="group relative overflow-hidden rounded-card border border-line bg-surface p-5 shadow-card transition-shadow duration-200 hover:shadow-lift">
      <span
        className={`absolute inset-x-0 top-0 h-[3px] ${acentos.filete} opacity-70 transition-opacity duration-200 group-hover:opacity-100`}
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
          {label}
        </p>
        {icono ? <span className="text-brand/70">{icono}</span> : null}
      </div>
      <p className={`mt-2 font-display text-3xl font-semibold tabular-nums ${acentos.valor}`}>
        {value}
      </p>
      {detalle ? <p className="mt-1 text-xs text-muted">{detalle}</p> : null}
    </div>
  )
}

/** Encabezado de pantalla: título en serif y una línea que explica el contexto. */
export function PageHeader({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string
  descripcion?: string
  acciones?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{titulo}</h1>
        {descripcion ? <p className="mt-1 text-sm text-muted">{descripcion}</p> : null}
      </div>
      {acciones ? <div className="flex items-center gap-2">{acciones}</div> : null}
    </header>
  )
}

/** Etiqueta de sección dentro de una pantalla. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-base font-semibold text-ink">
      <span className="h-3.5 w-[3px] rounded-full bg-brand" aria-hidden="true" />
      {children}
    </h2>
  )
}