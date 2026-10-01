export function Alert({
  tone,
  children,
}: {
  tone: 'error' | 'info' | 'success'
  children: string
}) {
  // Los tonos usan la paleta de marca en vez de los colores genéricos: el
  // error es el rojo de "GyG", no un rojo genérico que desentone con el logo.
  const classes =
    tone === 'error'
      ? 'border-brand/25 bg-brand-soft text-brand-deep'
      : tone === 'success'
        ? 'border-gold/30 bg-gold-soft text-ink'
        : 'border-line bg-parchment text-ink-soft'

  return (
    <p className={`rounded-[0.625rem] border px-3.5 py-2.5 text-sm ${classes}`}>{children}</p>
  )
}

const estadoLabel: Record<string, string> = {
  borrador: 'Borrador',
  confirmado: 'Confirmado',
  entregado_parcial: 'Entrega parcial',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const estadoClass: Record<string, string> = {
  borrador: 'bg-parchment text-muted ring-1 ring-inset ring-line',
  confirmado: 'bg-gold-soft text-ink ring-1 ring-inset ring-gold/30',
  entregado_parcial: 'bg-brand-soft text-brand-deep ring-1 ring-inset ring-brand/25',
  entregado: 'bg-ink text-parchment ring-1 ring-inset ring-ink',
  cancelado: 'bg-brand text-white ring-1 ring-inset ring-brand-deep',
}

export function OrderStatus({ estado }: { estado: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] ${
        estadoClass[estado] ?? estadoClass.borrador
      }`}
    >
      {estadoLabel[estado] ?? estado}
    </span>
  )
}

export function QueryStatus({
  isLoading,
  errorMessage,
  loadingText = 'Cargando…',
}: {
  isLoading: boolean
  errorMessage?: string | null
  loadingText?: string
}) {
  if (isLoading) {
    return <Alert tone="info">{loadingText}</Alert>
  }
  if (errorMessage) {
    return <Alert tone="error">{errorMessage}</Alert>
  }
  return null
}
