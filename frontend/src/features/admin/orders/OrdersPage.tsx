import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listOrders, type OrderCanal, type OrderEstado } from '../api/orders.ts'
import { listClients } from '../api/territory.ts'
import { OrderStatus, QueryStatus } from '../ui/Status.tsx'

const canalLabel: Record<OrderCanal, string> = {
  campo: 'Campo',
  web: 'Web',
  whatsapp: 'WhatsApp',
}

const pagoLabel: Record<string, string> = {
  contado: 'Contado',
  credito: 'Crédito',
}

function quetzales(value: string) {
  return `Q ${Number(value).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fecha(value: string) {
  return new Date(value).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })
}

export function OrdersPage() {
  const [estado, setEstado] = useState<'' | OrderEstado>('')
  const [clientId, setClientId] = useState('')
  const [canal, setCanal] = useState<'' | OrderCanal>('')

  const filters = {
    clientId: clientId ? Number(clientId) : undefined,
    estado: estado || undefined,
    canal: canal || undefined,
  }

  const ordersQuery = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => listOrders(filters),
  })
  const clientsQuery = useQuery({ queryKey: ['clients'], queryFn: listClients })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <p className="text-sm text-slate-600">Pedidos de campo, web y WhatsApp.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Estado</span>
          <select
            value={estado}
            onChange={(event) => setEstado(event.target.value as '' | OrderEstado)}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="confirmado">Confirmado</option>
            <option value="entregado_parcial">Entrega parcial</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Cliente</span>
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="max-w-xs rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {(clientsQuery.data ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.nombreComercial}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Canal</span>
          <select
            value={canal}
            onChange={(event) => setCanal(event.target.value as '' | OrderCanal)}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="campo">Campo</option>
            <option value="web">Web</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
      </div>

      <QueryStatus
        isLoading={ordersQuery.isLoading}
        errorMessage={ordersQuery.isError ? 'No se pudieron cargar los pedidos' : null}
      />

      {!ordersQuery.isLoading && !ordersQuery.isError ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Número</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Vendedor</th>
                <th className="px-3 py-2 font-medium">Canal</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Condición de pago</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(ordersQuery.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                    No hay pedidos para mostrar.
                  </td>
                </tr>
              ) : (
                (ordersQuery.data ?? []).map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <Link to={`/admin/pedidos/${order.id}`} className="font-medium text-slate-900 underline">
                        {order.numero}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{order.client?.nombreComercial ?? '—'}</td>
                    <td className="px-3 py-2">{order.user?.nombre ?? '—'}</td>
                    <td className="px-3 py-2">{canalLabel[order.canal]}</td>
                    <td className="px-3 py-2">
                      <OrderStatus estado={order.estado} />
                    </td>
                    <td className="px-3 py-2">{pagoLabel[order.condicionPago]}</td>
                    <td className="px-3 py-2">{quetzales(order.total)}</td>
                    <td className="px-3 py-2">{fecha(order.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
