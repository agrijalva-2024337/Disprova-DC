import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { closeSession, getCurrentSession, openSession } from '../../admin/api/cash.ts'
import { ApiError } from '../../admin/api/http.ts'
import type { CashSession } from '../../admin/api/types.ts'

const money = (value: string | number) => Number(value).toFixed(2)

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
          </div>

          <button
            type="button"
            onClick={() => setArqueo(null)}
            className="h-14 w-full rounded-xl bg-slate-900 text-lg font-medium text-white"
          >
            Volver
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Disprova</p>
        <h1 className="text-2xl font-semibold">Mi caja</h1>
      </header>

      <main className="flex-1 space-y-3 px-4 py-4">
        {sessionQuery.isLoading ? (
          <p className="rounded-2xl bg-white px-4 py-4 text-base">Cargando caja…</p>
        ) : null}

        {otroError ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-base text-red-800">
            {otroError}
          </p>
        ) : null}

        {sinCaja ? (
          <form
            className="space-y-3 rounded-2xl bg-white px-4 py-4"
            onSubmit={(event) => {
              event.preventDefault()
              openMutation.mutate()
            }}
          >
            <h2 className="text-lg font-semibold">Abrir caja</h2>
            <p className="text-sm text-slate-600">
              Con la caja abierta podés registrar pagos en efectivo.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Fondo inicial</span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={fondoInicial}
                onChange={(event) => setFondoInicial(event.target.value)}
                className="h-14 w-full rounded-xl border border-slate-300 px-3 text-lg"
                placeholder="0.00"
              />
            </label>
            {openError ? <p className="text-sm text-red-700">{openError}</p> : null}
            <button
              type="submit"
              disabled={openMutation.isPending || fondoInicial.trim() === ''}
              className="h-14 w-full rounded-xl bg-slate-900 text-lg font-medium text-white disabled:opacity-60"
            >
              {openMutation.isPending ? 'Abriendo…' : 'Abrir caja'}
            </button>
          </form>
        ) : null}

        {session ? (
          <>
            <dl className="space-y-2 rounded-2xl bg-white px-4 py-4 text-base">
              <div className="flex justify-between">
                <dt className="text-slate-600">Fondo inicial</dt>
                <dd className="tabular-nums">Q{money(session.fondoInicial)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Total cobrado</dt>
                <dd className="tabular-nums text-green-700">+Q{money(session.totalCobrado)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Total gastos</dt>
                <dd className="tabular-nums text-red-700">−Q{money(session.totalGastos)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-xl font-semibold">
                <dt>Esperado en caja</dt>
                <dd className="tabular-nums">Q{money(esperado(session))}</dd>
              </div>
            </dl>

            {cerrando ? (
              <form
                className="space-y-3 rounded-2xl bg-white px-4 py-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  closeMutation.mutate(session.id)
                }}
              >
                <h2 className="text-lg font-semibold">Cerrar caja</h2>
                <p className="text-sm text-slate-600">
                  Contá el efectivo y anotá cuánto hay. Esperado: Q{money(esperado(session))}.
                </p>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Conteo final</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={conteoFinal}
                    onChange={(event) => setConteoFinal(event.target.value)}
                    className="h-14 w-full rounded-xl border border-slate-300 px-3 text-lg"
                    placeholder="0.00"
                  />
                </label>
                {closeError ? <p className="text-sm text-red-700">{closeError}</p> : null}
                <button
                  type="submit"
                  disabled={closeMutation.isPending || conteoFinal.trim() === ''}
                  className="h-14 w-full rounded-xl bg-amber-600 text-lg font-medium text-white disabled:opacity-60"
                >
                  {closeMutation.isPending ? 'Cerrando…' : 'Confirmar cierre'}
                </button>
                <button
                  type="button"
                  onClick={() => setCerrando(false)}
                  className="h-12 w-full text-base text-slate-600"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCerrando(true)}
                className="h-14 w-full rounded-xl bg-amber-600 text-lg font-medium text-white"
              >
                Cerrar caja
              </button>
            )}
          </>
        ) : null}
      </main>

      <nav className="border-t border-slate-200 bg-white px-4 py-3">
        <Link to="/ruta" className="block text-center text-sm text-slate-600">
          Volver a mi ruta
        </Link>
      </nav>
    </div>
  )
}