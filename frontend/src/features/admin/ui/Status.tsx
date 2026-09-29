export function Alert({
  tone,
  children,
}: {
  tone: 'error' | 'info' | 'success'
  children: string
}) {
  const classes =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : tone === 'success'
        ? 'border-green-200 bg-green-50 text-green-800'
        : 'border-slate-200 bg-slate-50 text-slate-700'

  return <p className={`rounded border px-3 py-2 text-sm ${classes}`}>{children}</p>
}

const estadoLabel: Record<string, string> = {
  borrador: 'Borrador',
  confirmado: 'Confirmado',
  entregado_parcial: 'Entrega parcial',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const estadoClass: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  confirmado: 'bg-blue-100 text-blue-800',
  entregado_parcial: 'bg-amber-100 text-amber-800',
  entregado: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-800',
}

export function OrderStatus({ estado }: { estado: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${estadoClass[estado] ?? 'bg-slate-100 text-slate-700'}`}>
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
