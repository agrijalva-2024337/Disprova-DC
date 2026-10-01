import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { closeSession, getCurrentSession, openSession } from '../../admin/api/cash.ts'
import { ApiError } from '../../admin/api/http.ts'
import type { CashSession } from '../../admin/api/types.ts'
import { FieldShell } from '../FieldShell.tsx'
import { quetzales } from '../format.ts'

/**
 * El esperado lo calcula el frontend con los tres números que sí devuelve la
 * sesión. El backend lo vuelve a calcular al cerrar y es el que manda: acá es
 * solo para que el vendedor vea contra qué está contando.
 */
function esperado(session: CashSession) {
  return Number(session.fondoInicial) + Number(session.totalCobrado) - Number(session.totalGastos)
}

export function CashSessionPage() {
  const queryClient = useQueryClient()
  const [fondoInicial, setFondoInicial] = useState('')
  const [conteoFinal, setConteoFinal] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [arqueo, setArqueo] = useState<CashSession | null>(null)

  // 404 = todavía no abrió caja. No es un error que haya que reintentar.
  const sessionQuery = useQuery({
    queryKey: ['cash-current'],
    queryFn: getCurrentSession,
    retry: false,
  })

  const openMutation = useMutation({
    mutationFn: () => openSession(fondoInicial),
    onSuccess: async () => {
      setFondoInicial('')
      await queryClient.invalidateQueries({ queryKey: ['cash-current'] })
    },
  })

  const closeMutation = useMutation({
    mutationFn: (id: number) => closeSession(id, conteoFinal),
    onSuccess: async (closed) => {
      setArqueo(closed)
      setCerrando(false)
      setConteoFinal('')
      await queryClient.invalidateQueries({ queryKey: ['cash-current'] })
    },
  })

  const session = sessionQuery.data
  const sinCaja =
    sessionQuery.isError &&
    sessionQuery.error instanceof ApiError &&
    sessionQuery.error.status === 404
  const otroError =
    sessionQuery.isError && !sinCaja
      ? sessionQuery.error instanceof Error
        ? sessionQuery.error.message
        : 'No se pudo consultar la caja'
      : null
  const openError =
    openMutation.isError && openMutation.error instanceof Error
      ? openMutation.error.message
      : null
  const closeError =
    closeMutation.isError && closeMutation.error instanceof Error
      ? closeMutation.error.message
      : null


  // El arqueo se muestra antes de volver a la pantalla principal: es el número
  // con el que se justifica un descuadre.
  if (arqueo) {
    const diferencia = Number(arqueo.diferencia ?? 0)
    const clase = diferencia === 0
      ? 'border-gold/30 bg-gold-soft'
      : diferencia > 0
        ? 'border-line bg-surface'
        : 'border-brand/25 bg-brand-soft'
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col bg-slate-100 text-slate-900">
        <header className="border-b border-slate-200 bg-white px-4 py-4">
          <h1 className="text-2xl font-semibold">Caja cerrada</h1>
          <p className="text-sm text-slate-600">Sesión #{arqueo.id}</p>
        </header>
        <main className="flex-1 space-y-3 px-4 py-4">
          <dl className="space-y-2 rounded-2xl bg-white px-4 py-4 text-base">
            <div className="flex justify-between">
              <dt className="text-slate-600">Fondo inicial</dt>
              <dd className="tabular-nums">Q{money(arqueo.fondoInicial)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Total cobrado</dt>
              <dd className="tabular-nums">Q{money(arqueo.totalCobrado)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Total gastos</dt>
              <dd className="tabular-nums">−Q{money(arqueo.totalGastos)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold">
              <dt>Esperado</dt>
              <dd className="tabular-nums">Q{money(esperado(arqueo))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Contado</dt>
              <dd className="tabular-nums">Q{money(arqueo.conteoFinal ?? 0)}</dd>
            </div>
          </dl>


          <div
            className={`rounded-2xl px-4 py-4 ${
              diferencia === 0
                ? 'border border-green-200 bg-green-50'
                : diferencia > 0
                  ? 'border border-amber-300 bg-amber-50'
                  : 'border border-red-300 bg-red-50'
            }`}
          >
            <p className="text-sm font-medium uppercase tracking-wide text-slate-600">Diferencia</p>
            <p
              className={`mt-1 text-3xl font-semibold tabular-nums ${
                diferencia === 0
                  ? 'text-green-800'
                  : diferencia > 0
                    ? 'text-amber-800'
                    : 'text-red-800'
              }`}
            >
              {diferencia > 0 ? '+' : ''}Q{money(diferencia)}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {diferencia === 0
                ? 'La caja cuadró exacto.'
                : diferencia > 0
                  ? 'Sobró dinero en la caja.'
                  : 'Faltó dinero en la caja.'}
            </p>
=======
      <FieldShell titulo="Caja cerrada" subtitulo={`Sesión #${arqueo.id}`}>
        <dl className="space-y-2 rounded-card border border-line bg-surface px-4 py-4 text-sm shadow-card">
          <Fila etiqueta="Fondo inicial" valor={quetzales(arqueo.fondoInicial)} />
          <Fila etiqueta="Total cobrado" valor={quetzales(arqueo.totalCobrado)} />
          <Fila etiqueta="Total gastos" valor={quetzales(arqueo.totalGastos)} />
          <div className="flex justify-between border-t border-line pt-2 font-semibold text-ink">
            <dt>Esperado</dt>
            <dd className="tabular-nums">{quetzales(esperado(arqueo))}</dd>

          </div>
          <Fila etiqueta="Contado" valor={quetzales(arqueo.conteoFinal ?? 0)} />
        </dl>

        <div className={`mt-3 rounded-card border px-4 py-4 ${clase}`}>
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted">
            Diferencia
          </p>
          <p className="mt-0.5 font-display text-3xl font-semibold tabular-nums text-ink">
            {diferencia > 0 ? '+' : ''}
            {quetzales(diferencia)}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {diferencia === 0
              ? 'La caja cuadró exacto.'
              : diferencia > 0
                ? 'Sobró dinero en la caja.'
                : 'Faltó dinero en la caja.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setArqueo(null)}
          className="mt-4 h-14 w-full rounded-[0.625rem] bg-brand text-lg font-semibold text-white transition-colors hover:bg-brand-deep"
        >
          Volver
        </button>
      </FieldShell>
    )
  }

  return (

    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Disprova</p>
        <h1 className="text-2xl font-semibold">Mi caja</h1>
      </header>

    <FieldShell
      titulo="Mi caja"
      subtitulo={
        session
          ? `Esperado en caja: ${quetzales(esperado(session))}`
          : 'Abrila para poder cobrar en efectivo'
      }
    >
      {sessionQuery.isLoading ? (
        <p className="rounded-card bg-surface px-4 py-4 text-sm text-muted">Cargando caja…</p>
      ) : null}


      {otroError ? (
        <p className="rounded-card border border-brand/25 bg-brand-soft px-4 py-4 text-sm text-brand-deep">
          {otroError}
        </p>
      ) : null}

      {sinCaja ? (
        <form
          className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card"
          onSubmit={(event) => {
            event.preventDefault()
            openMutation.mutate()
          }}
        >
          <h2 className="font-display text-lg font-semibold text-ink">Abrir caja</h2>
          <p className="text-sm text-muted">
            Con la caja abierta podés registrar pagos en efectivo.
          </p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-soft">Fondo inicial</span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={fondoInicial}
              onChange={(event) => setFondoInicial(event.target.value)}
              className="h-14 w-full rounded-[0.625rem] border border-line bg-parchment px-3 text-lg text-ink outline-none focus:border-brand"
              placeholder="0.00"
            />
          </label>
          {openError ? (
            <p className="rounded-[0.625rem] border border-brand/25 bg-brand-soft px-3 py-2 text-sm text-brand-deep">
              {openError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={openMutation.isPending || fondoInicial.trim() === ''}
            className="h-14 w-full rounded-[0.625rem] bg-brand text-lg font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
          >
            {openMutation.isPending ? 'Abriendo…' : 'Abrir caja'}
          </button>
        </form>
      ) : null}


      {session ? (
        <>
          <dl className="space-y-2 rounded-card border border-line bg-surface px-4 py-4 text-sm shadow-card">
            <Fila etiqueta="Fondo inicial" valor={quetzales(session.fondoInicial)} />
            <Fila etiqueta="Total cobrado" valor={quetzales(session.totalCobrado)} tono="text-ink" />
            <Fila etiqueta="Total gastos" valor={quetzales(session.totalGastos)} tono="text-brand" />
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-ink">
              <dt>Esperado en caja</dt>
              <dd className="tabular-nums">{quetzales(esperado(session))}</dd>
            </div>
          </dl>

          {cerrando ? (
            <form
              className="mt-3 space-y-3 rounded-card border border-line bg-surface p-4 shadow-card"
              onSubmit={(event) => {
                event.preventDefault()
                closeMutation.mutate(session.id)
              }}
            >
              <h2 className="font-display text-lg font-semibold text-ink">Cerrar caja</h2>
              <p className="text-sm text-muted">
                Contá el efectivo y anotá cuánto hay. Esperado: {quetzales(esperado(session))}.
              </p>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink-soft">Conteo final</span>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={conteoFinal}
                  onChange={(event) => setConteoFinal(event.target.value)}
                  className="h-14 w-full rounded-[0.625rem] border border-line bg-parchment px-3 text-lg text-ink outline-none focus:border-brand"
                  placeholder="0.00"
                />
              </label>
              {closeError ? (
                <p className="rounded-[0.625rem] border border-brand/25 bg-brand-soft px-3 py-2 text-sm text-brand-deep">
                  {closeError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={closeMutation.isPending || conteoFinal.trim() === ''}
                className="h-14 w-full rounded-[0.625rem] bg-ink text-lg font-semibold text-parchment transition-colors hover:bg-ink-soft disabled:opacity-60"
              >
                {closeMutation.isPending ? 'Cerrando…' : 'Confirmar cierre'}
              </button>
              <button
                type="button"
                onClick={() => setCerrando(false)}
                className="h-12 w-full text-base text-muted"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCerrando(true)}
              className="mt-3 h-14 w-full rounded-[0.625rem] border border-gold/50 bg-gold-soft text-lg font-semibold text-ink transition-colors hover:bg-gold/25"
            >
              Cerrar caja
            </button>
          )}
        </>
      ) : null}
    </FieldShell>
  )
}

function Fila({
  etiqueta,
  valor,
  tono = 'text-ink-soft',
}: {
  etiqueta: string
  valor: string
  tono?: string
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{etiqueta}</dt>
      <dd className={`tabular-nums ${tono}`}>{valor}</dd>
    </div>
  )
}

