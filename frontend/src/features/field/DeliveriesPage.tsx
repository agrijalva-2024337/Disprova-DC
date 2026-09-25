import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ApiError } from '../admin/api/http.ts'
import { listPendingDeliveries } from './ordersApi.ts'

export function DeliveriesPage() {
  const query = useQuery({ queryKey: ['pending-deliveries'], queryFn: listPendingDeliveries })
  const orders = query.data ?? []

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-100">
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
  )
}
