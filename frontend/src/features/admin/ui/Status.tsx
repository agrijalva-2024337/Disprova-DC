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
