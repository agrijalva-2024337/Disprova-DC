import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../admin/api/http.ts'
import { createRouteVisit, getTodayRoute } from '../admin/api/territory.ts'
import type { TodayRouteClient } from '../admin/api/types.ts'

const MOTIVOS = ['Sin dinero', 'Ya tiene producto', 'Precio', 'No estaba el encargado']

export function TodayRoutePage() {
  const queryClient = useQueryClient()
  const routeQuery = useQuery({ queryKey: ['route-today'], queryFn: getTodayRoute })
  const [selected, setSelected] = useState<TodayRouteClient | null>(null)
  const [askingMotivo, setAskingMotivo] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const visitMutation = useMutation({
    mutationFn: createRouteVisit,
    onSuccess: async () => {
      setSelected(null)
      setAskingMotivo(false)
      setActionError(null)
      await queryClient.invalidateQueries({ queryKey: ['route-today'] })
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo registrar la visita')
    },
  })

  function closeModal() {
    setSelected(null)
    setAskingMotivo(false)
    setActionError(null)
  }

  const clients = routeQuery.data?.clients ?? []

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Disprova</p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Mi ruta de hoy</h1>
          <Link to="/ruta/entregas" className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white">
            Entregas
          </Link>
        </div>
        {routeQuery.data ? (
          <p className="text-sm text-slate-600">
            {routeQuery.data.zones[0]?.nombre ?? 'Sin zona para hoy'}
          </p>
        ) : null}
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 py-4">
        {routeQuery.isLoading ? <p className="rounded-xl bg-white px-4 py-4 text-base">Cargando ruta…</p> : null}
        {routeQuery.isError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-base text-red-800">
            {routeQuery.error instanceof ApiError ? routeQuery.error.message : 'No se pudo cargar la ruta'}
          </p>
        ) : null}
        {!routeQuery.isLoading && !routeQuery.isError && clients.length === 0 ? (
          <p className="rounded-xl bg-white px-4 py-6 text-center text-base text-slate-600">
            No hay clientes en la ruta de hoy.
          </p>
        ) : null}
        {clients.map((client) =>
          client.visitadoHoy ? (
            <article key={client.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 opacity-70">
              <p className="text-lg font-semibold">{client.nombreComercial}</p>
              <p className="mt-1 text-base text-slate-600">Saldo {client.saldoActual}</p>
              <p className="mt-2 text-sm font-medium text-green-800">Visitado</p>
            </article>
          ) : (
            <button
              key={client.id}
              type="button"
              onClick={() => {
                setActionError(null)
                setAskingMotivo(false)
                setSelected(client)
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-left shadow-sm active:bg-slate-50"
            >
              <p className="text-lg font-semibold">{client.nombreComercial}</p>
              <p className="mt-1 text-base text-slate-600">Saldo {client.saldoActual}</p>
              <p className="mt-2 text-sm font-medium text-slate-500">Sin visitar</p>
            </button>
          ),
        )}
      </main>

      {selected ? (
        <div className="fixed inset-0 z-20 flex items-end bg-slate-900/40">
          <div className="w-full space-y-3 rounded-t-2xl bg-white px-4 pb-6 pt-4">
            <p className="text-lg font-semibold">{selected.nombreComercial}</p>
            {actionError ? <p className="text-sm text-red-700">{actionError}</p> : null}
            {askingMotivo ? (
              <div className="space-y-3">
                <p className="text-base text-slate-600">¿Por qué no compró?</p>
                {MOTIVOS.map((motivo) => (
                  <button
                    key={motivo}
                    type="button"
                    disabled={visitMutation.isPending}
                    onClick={() =>
                      visitMutation.mutate({
                        clientId: selected.id,
                        resultado: 'no_compro',
                        motivo,
                      })
                    }
                    className="h-14 w-full rounded-xl bg-slate-900 text-lg font-medium text-white disabled:opacity-60"
                  >
                    {motivo}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <Link
                  to={`/ruta/pedido/${selected.id}`}
                  className="flex h-14 w-full items-center justify-center rounded-xl bg-slate-900 text-lg font-medium text-white"
                >
                  Pedido
                </Link>
                <button
                  type="button"
                  onClick={() => setAskingMotivo(true)}
                  className="h-14 w-full rounded-xl bg-amber-600 text-lg font-medium text-white"
                >
                  No compró
                </button>
                <button
                  type="button"
                  disabled={visitMutation.isPending}
                  onClick={() => visitMutation.mutate({ clientId: selected.id, resultado: 'cerrado' })}
                  className="h-14 w-full rounded-xl bg-slate-600 text-lg font-medium text-white disabled:opacity-60"
                >
                  {visitMutation.isPending ? 'Guardando…' : 'Cerrado'}
                </button>
              </div>
            )}
            <button type="button" onClick={closeModal} className="h-12 w-full text-base text-slate-600">
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
