import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../admin/api/http.ts'
import { createRouteVisit, getTodayRoute, listZones } from '../admin/api/territory.ts'
import type { TodayRouteClient } from '../admin/api/types.ts'
import { FieldShell } from './FieldShell.tsx'
import { fechaLarga, nombreDia, proximaVisita, quetzales, rangoSemana } from './format.ts'

const MOTIVOS = ['Sin dinero', 'Ya tiene producto', 'Precio', 'No estaba el encargado']

/** Cuánto se lleva por 매출: sirve para el resumen de la jornada. */
function porCobrar(clientes: TodayRouteClient[]): number {
  return clientes
    .filter((cliente) => !cliente.visitadoHoy)
    .reduce((total, cliente) => total + Number(cliente.saldoActual), 0)
}

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
  const visitados = clients.filter((cliente) => cliente.visitadoHoy).length
  const pendiente = porCobrar(clients)

  return (
    <FieldShell
      titulo="Mi ruta de hoy"
      subtitulo={
        routeQuery.data ? (
          <span>
            {fechaLarga(routeQuery.data.fecha)}
            {routeQuery.data.zones.length > 0
              ? ` · ${routeQuery.data.zones.map((zona) => zona.nombre).join(', ')}`
              : ''}
          </span>
        ) : null
      }
    >
      {routeQuery.isLoading ? (
        <p className="rounded-card bg-surface px-4 py-4 text-sm text-muted">Cargando ruta…</p>
      ) : null}

      {routeQuery.isError ? (
        <p className="rounded-card border border-brand/25 bg-brand-soft px-4 py-4 text-sm text-brand-deep">
          {routeQuery.error instanceof ApiError
            ? routeQuery.error.message
            : 'No se pudo cargar la ruta'}
        </p>
      ) : null}

      {/* Resumen de la jornada: cuánto se ha recorrido y cuánto falta por cobrar. */}
      {routeQuery.data && clients.length > 0 ? (
        <section className="mb-4 overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted">
                Avance
              </p>
              <p className="mt-0.5 font-display text-lg font-semibold text-ink">
                {visitados} de {clients.length} Visitados
              </p>
            </div>
            <div className="text-right">
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted">
                Por cobrar
              </p>
              <p
                className={`mt-0.5 font-display text-lg font-semibold tabular-nums ${
                  pendiente > 0 ? 'text-brand' : 'text-ink'
                }`}
              >
                {quetzales(pendiente)}
              </p>
            </div>
          </div>
          <div
            className="h-1 w-full bg-line"
            role="progressbar"
            aria-valuenow={visitados}
            aria-valuemin={0}
            aria-valuemax={clients.length}
          >
            <div
              className="h-full bg-brand transition-[width] duration-300"
              style={{ width: `${clients.length > 0 ? (visitados / clients.length) * 100 : 0}%` }}
            />
          </div>
        </section>
      ) : null}

      {routeQuery.data && clients.length === 0 ? (
        <SinRutaHoy />
      ) : null}

      {/* En el teléfono una columna; en la computadora del mostrador, varias:
          el vendedor compara de un vistazo en vez de bajar por una lista. */}
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {clients.map((client, index) => (
          <li key={client.id}>
            {client.visitadoHoy ? (
              <article className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3.5 opacity-70">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/10 text-ink-soft"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[1.1rem] w-[1.1rem]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-semibold text-ink">
                    {client.nombreComercial}
                  </p>
                  <p className="text-xs text-muted">
                    Saldo {quetzales(client.saldoActual)} · Visitado
                  </p>
                </div>
              </article>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActionError(null)
                  setAskingMotivo(false)
                  setSelected(client)
                }}
                className="flex w-full items-center gap-3 rounded-card border border-line bg-surface px-4 py-3.5 text-left shadow-card transition-shadow active:shadow-lift"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-sm font-semibold text-brand-deep"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-semibold text-ink">
                    {client.nombreComercial}
                  </p>
                  <p className="text-xs text-muted">
                    Saldo {quetzales(client.saldoActual)}
                  </p>
                </div>
                {Number(client.saldoActual) > 0 ? (
                  <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-brand-deep">
                    Debe
                  </span>
                ) : null}
              </button>
            )}
          </li>
        ))}
      </ul>

      {selected ? (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-ink/45 backdrop-blur-[2px] sm:items-center sm:p-6"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl bg-surface px-4 pb-8 pt-5 sm:rounded-card sm:pb-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden="true" />

            <p className="font-display text-xl font-semibold text-ink">
              {selected.nombreComercial}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Saldo {quetzales(selected.saldoActual)}
            </p>

            {actionError ? (
              <p className="mt-3 rounded-[0.625rem] border border-brand/25 bg-brand-soft px-3.5 py-2.5 text-sm text-brand-deep">
                {actionError}
              </p>
            ) : null}

            {askingMotivo ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-ink-soft">¿Por qué no compró?</p>
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
                    className="h-14 w-full rounded-xl border border-line bg-parchment text-base font-medium text-ink transition-colors hover:border-brand/40 disabled:opacity-60"
                  >
                    {motivo}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAskingMotivo(false)}
                  className="h-12 w-full text-sm text-muted"
                >
                  Volver
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <Link
                  to={`/ruta/pedido/${selected.id}`}
                  className="flex h-14 w-full items-center justify-center rounded-xl bg-ink text-base font-semibold text-parchment"
                >
                  Hacer pedido
                </Link>
                <Link
                  to={`/ruta/cobro/${selected.id}`}
                  className="flex h-14 w-full items-center justify-center rounded-xl bg-brand text-base font-semibold text-white"
                >
                  Cobrar
                </Link>
                <button
                  type="button"
                  onClick={() => setAskingMotivo(true)}
                  className="h-14 w-full rounded-xl border border-gold/50 bg-gold-soft text-base font-medium text-ink"
                >
                  No compró
                </button>
                <button
                  type="button"
                  disabled={visitMutation.isPending}
                  onClick={() => visitMutation.mutate({ clientId: selected.id, resultado: 'cerrado' })}
                  className="h-14 w-full rounded-xl border border-line text-base font-medium text-ink-soft disabled:opacity-60"
                >
                  {visitMutation.isPending ? 'Guardando…' : 'Cerrar visita sin compra'}
                </button>
              </div>
            )}
            <button type="button" onClick={closeModal} className="h-12 w-full text-sm text-muted">
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </FieldShell>
  )

/**
 * Qué mostrar cuando hoy no hay visita programada.
 *
 * Antes decía "Sin zona para hoy" y ahí moría la información: el vendedor no
 * tenía forma de saber si era un error, si ya había pasado su zona, o cuándo le
 * toca. El calendario divide el mes en cuatro semanas y cada zona visita en una
 * de ellas, así que se explica exactamente eso y se dice cuándo vuelve.
 */
function SinRutaHoy() {
  const routeQuery = useQuery({ queryKey: ['route-today'], queryFn: getTodayRoute })
  const zonesQuery = useQuery({ queryKey: ['zones'], queryFn: listZones })
  const hoy = routeQuery.data
  const activas = (zonesQuery.data ?? []).filter((zona) => zona.activo)

  return (
    <section className="space-y-4">
      <div className="rounded-card border border-line bg-surface p-5 text-center shadow-card">
        <p className="font-display text-lg font-semibold text-ink">Hoy no hay visita programada</p>
        {hoy ? (
          <p className="mt-1.5 text-sm text-muted">
            El calendario marca el <span className="font-medium text-ink">{nombreDia(hoy.diaSemana)}</span> como
            semana <span className="font-medium text-ink">{hoy.semanaMes}</span> del mes (días{' '}
            {rangoSemana(hoy.semanaMes)}), y ninguna zona activa cae en ese día.
          </p>
        ) : null}
      </div>

      {activas.length > 0 ? (
        <div className="rounded-card border border-line bg-surface shadow-card">
          <p className="border-b border-line px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted">
            Zonas activas
          </p>
          <ul className="divide-y divide-line/70">
            {activas.map((zona) => (
              <li key={zona.id} className="px-4 py-3">
                <p className="text-sm font-semibold text-ink">{zona.nombre}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Semana {zona.semanaMes} (días {rangoSemana(zona.semanaMes)}) ·{' '}
                  {zona.diasSemana.map(nombreDia).join(', ')}
                </p>
                <p className="mt-1 text-xs font-medium text-brand">
                  Próxima visita: {proximaVisita(zona) ?? 'sin próxima visita programada'}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-card border border-gold/40 bg-gold-soft p-4 text-sm text-ink">
          <p className="font-semibold">No hay ninguna zona activa.</p>
          <p className="mt-1">
            Sin zonas el sistema no puede armar la ruta. Pídele al administrador que configure
            las zonas en <span className="font-medium">Zonas → Nueva zona</span>.
          </p>
        </div>
      )}
    </section>
  )
}
}
