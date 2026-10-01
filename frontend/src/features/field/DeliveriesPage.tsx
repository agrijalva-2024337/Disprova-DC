import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ApiError } from '../admin/api/http.ts'
import { FieldShell } from './FieldShell.tsx'
import { quetzales } from './format.ts'
import { listPendingDeliveries } from './ordersApi.ts'

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  confirmado: 'Confirmado',
  entregado_parcial: 'Entrega parcial',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export function DeliveriesPage() {
  const query = useQuery({ queryKey: ['pending-deliveries'], queryFn: listPendingDeliveries })
  const orders = query.data ?? []
  const total = orders.reduce((suma, order) => suma + Number(order.total), 0)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col bg-slate-100">
      <header className="bg-white px-4 py-4">
        <Link to="/ruta" className="text-base text-slate-600">
          ← Ruta
        </Link>
        <h1 className="text-2xl font-semibold">Entregas de hoy</h1>
      </header>
      <div className="space-y-3 px-4 py-4">
        {query.isLoading ? <p className="rounded-xl bg-white px-4 py-4">Cargando…</p> : null}
        {query.isError ? (
          <p className="rounded-xl bg-red-50 px-4 py-4 text-red-800">
            {query.error instanceof ApiError ? query.error.message : 'No se pudieron cargar las entregas'}
          </p>
        ) : null}
        {!query.isLoading && orders.length === 0 ? (
          <p className="rounded-xl bg-white px-4 py-6 text-center">No hay pedidos pendientes de entregar.</p>
        ) : null}
        {orders.map((order) => (
          <Link key={order.id} to={`/ruta/entregas/${order.id}`} className="block rounded-2xl bg-white px-4 py-5">
            <p className="text-lg font-semibold">{order.client?.nombreComercial ?? order.numero}</p>
            <p className="text-base text-slate-600">
              {order.numero} · {order.estado === 'entregado_parcial' ? 'Entrega parcial' : 'Confirmado'}
            </p>
          </Link>
        ))}
      </div>
    </div>
=======
    <FieldShell
      titulo="Entregas"
      subtitulo={
        orders.length > 0
          ? `${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'} · ${quetzales(total)}`
          : undefined
      }
    >
      {query.isLoading ? (
        <p className="rounded-card bg-surface px-4 py-4 text-sm text-muted">Cargando…</p>
      ) : null}

      {query.isError ? (
        <p className="rounded-card border border-brand/25 bg-brand-soft px-4 py-4 text-sm text-brand-deep">
          {query.error instanceof ApiError
            ? query.error.message
            : 'No se pudieron cargar las entregas'}
        </p>
      ) : null}

      {!query.isLoading && !query.isError && orders.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-muted">
          No hay pedidos pendientes de entregar. Cuando confirmes un pedido aparece acá.
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {orders.map((order) => {
          const parcial = order.estado === 'entregado_parcial'
          return (
            <li key={order.id}>
              <Link
                to={`/ruta/entregas/${order.id}`}
                className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3.5 shadow-card transition-shadow active:shadow-lift"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    parcial ? 'bg-gold-soft text-ink' : 'bg-brand-soft text-brand-deep'
                  }`}
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[1.1rem] w-[1.1rem]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 3h12l1.5 18H4.5L6 3Z" />
                    <path d="M9 8h6" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-semibold text-ink">
                    {order.client?.nombreComercial ?? order.numero}
                  </p>
                  <p className="text-xs text-muted">
                    {order.numero} · {ESTADO_LABEL[order.estado] ?? order.estado} ·{' '}
                    {order.items.length} {order.items.length === 1 ? 'producto' : 'productos'}
                  </p>
                </div>
                <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-ink">
                  {quetzales(order.total)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </FieldShell>
  )
}
