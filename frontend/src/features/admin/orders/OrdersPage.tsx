import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listOrders, type AdminOrder, type OrderCanal, type OrderEstado } from '../api/orders.ts'
import { listClients } from '../api/territory.ts'
import { DataTable, EmptyRow, Td, Th, Tr } from '../ui/DataTable.tsx'
import { OrderStatus, QueryStatus } from '../ui/Status.tsx'
import { RecordSheet, RowMoves } from '../ui/RecordSheet.tsx'
import { PageHeader } from '../ui/StatCard.tsx'n

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
  const [visto, setVisto] = useState<AdminOrder | null>(null)

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
      <PageHeader titulo="Pedidos" descripcion="Pedidos de campo, web y WhatsApp." />

      <div className="flex flex-wrap gap-3">
        <label className="block text-sm">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
            Estado
          </span>
          <select
            value={estado}
            onChange={(event) => setEstado(event.target.value as '' | OrderEstado)}
            className="rounded-[0.625rem] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
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
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
            Cliente
          </span>
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="max-w-xs rounded-[0.625rem] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
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
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
            Canal
          </span>
          <select
            value={canal}
            onChange={(event) => setCanal(event.target.value as '' | OrderCanal)}
            className="rounded-[0.625rem] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
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
                <th className="px-3 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(ordersQuery.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                    No hay pedidos para mostrar.
                  </td>
                </tr>
              ) : (
                (ordersQuery.data ?? []).map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer border-t border-slate-100"
                    onDoubleClick={() => setVisto(order)}
                  >
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
                    <td className="px-3 py-2">
                      <RowMoves onView={() => setVisto(order)} editTo={`/admin/pedidos/${order.id}`} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <DataTable>
          <thead>
            <tr>
              <Th>Número</Th>
              <Th>Cliente</Th>
              <Th>Vendedor</Th>
              <Th>Canal</Th>
              <Th>Estado</Th>
              <Th>Condición de pago</Th>
              <Th align="right">Total</Th>
              <Th>Fecha</Th>
            </tr>
          </thead>
          <tbody>
            {(ordersQuery.data ?? []).length === 0 ? (
              <EmptyRow columnas={8}>No hay pedidos para mostrar.</EmptyRow>
            ) : (
              (ordersQuery.data ?? []).map((order) => (
                <Tr key={order.id}>
                  <Td>
                    <Link
                      to={`/admin/pedidos/${order.id}`}
                      className="font-semibold text-brand underline-offset-2 hover:underline"
                    >
                      {order.numero}
                    </Link>
                  </Td>
                  <Td className="font-medium text-ink">{order.client?.nombreComercial ?? '—'}</Td>
                  <Td>{order.user?.nombre ?? '—'}</Td>
                  <Td>{canalLabel[order.canal]}</Td>
                  <Td>
                    <OrderStatus estado={order.estado} />
                  </Td>
                  <Td>{pagoLabel[order.condicionPago]}</Td>
                  <Td align="right" className="font-semibold tabular-nums text-ink">
                    {quetzales(order.total)}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{fecha(order.createdAt)}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </DataTable>
      ) : null}
      {visto ? (
        <RecordSheet title={visto.numero} onClose={() => setVisto(null)}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Cliente</dt>
              <dd>{visto.client?.nombreComercial ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Vendedor</dt>
              <dd>{visto.user?.nombre ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Canal</dt>
              <dd>{canalLabel[visto.canal]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Total</dt>
              <dd>{quetzales(visto.total)}</dd>
            </div>
          </dl>
          <Link to={`/admin/pedidos/${visto.id}`} className="mt-4 inline-block rounded-full bg-slate-900 px-4 py-2 text-sm text-white">
            Abrir pedido
          </Link>
        </RecordSheet>
      ) : null}
    </div>
  )
}
