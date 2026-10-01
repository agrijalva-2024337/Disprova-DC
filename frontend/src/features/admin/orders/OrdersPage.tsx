import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listOrders, type AdminOrder, type OrderCanal, type OrderEstado } from '../api/orders.ts'
import { listClients } from '../api/territory.ts'
import { DataTable, EmptyRow, Td, Th, Tr } from '../ui/DataTable.tsx'
import { OrderStatus, QueryStatus } from '../ui/Status.tsx'
import { RecordSheet, RowMoves } from '../ui/RecordSheet.tsx'
import { PageHeader } from '../ui/StatCard.tsx'

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
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {(ordersQuery.data ?? []).length === 0 ? (
              <EmptyRow columnas={9}>No hay pedidos para mostrar.</EmptyRow>
            ) : (
              (ordersQuery.data ?? []).map((order) => (
                <Tr key={order.id} className="cursor-pointer" onDoubleClick={() => setVisto(order)}>
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
                  <Td>
                    <RowMoves onView={() => setVisto(order)} editTo={`/admin/pedidos/${order.id}`} />
                  </Td>
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
              <dt className="text-muted">Cliente</dt>
              <dd>{visto.client?.nombreComercial ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Vendedor</dt>
              <dd>{visto.user?.nombre ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Canal</dt>
              <dd>{canalLabel[visto.canal]}</dd>
            </div>
            <div>
              <dt className="text-muted">Total</dt>
              <dd>{quetzales(visto.total)}</dd>
            </div>
          </dl>
          <Link to={`/admin/pedidos/${visto.id}`} className="mt-4 inline-block rounded-full bg-ink px-4 py-2 text-sm text-parchment">
            Abrir pedido
          </Link>
        </RecordSheet>
      ) : null}
    </div>
  )
}
