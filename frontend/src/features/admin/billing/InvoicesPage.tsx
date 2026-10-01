import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createInvoiceForOrder, listInvoices } from '../api/billing.ts'
import { ApiError } from '../api/http.ts'
import { listOrders } from '../../field/ordersApi.ts'
import type { InvoiceEstado } from '../api/types.ts'
import { SearchBox } from '../ui/ListTools.tsx'
import { Alert, QueryStatus } from '../ui/Status.tsx'

const money = (value: string) => Number(value).toFixed(2)

const estadoLabels: Record<InvoiceEstado, string> = {
  pendiente_certificacion: 'Pendiente de certificación',
  certificada: 'Certificada',
  error: 'Con error',
}

const estadoClasses: Record<InvoiceEstado, string> = {
  // Ámbar y no rojo: mientras no haya certificador FEL esto es lo normal, y
  // marcarlo como error haría creer que hay algo que arreglar.
  pendiente_certificacion: 'bg-amber-100 text-amber-800',
  certificada: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
}

export function InvoicesPage() {
  const [estado, setEstado] = useState<InvoiceEstado | ''>('')
  const [orderId, setOrderId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const queryClient = useQueryClient()

  const invoicesQuery = useQuery({
    queryKey: ['invoices', estado],
    queryFn: () => listInvoices(estado || undefined),
  })

  // Pedidos entregados sin factura: es lo único que el backend deja facturar.
  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: () => listOrders() })
  const facturables = (ordersQuery.data ?? []).filter(
    (order) => order.estado === 'entregado' || order.estado === 'entregado_parcial',
  )

  const createMutation = useMutation({
    mutationFn: (id: number) => createInvoiceForOrder(id),
    onSuccess: async () => {
      setOrderId('')
      await queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })

  const invoices = invoicesQuery.data ?? []
  const terminoFactura = busqueda.trim().toLowerCase()
  const facturasVisibles = invoices.filter((invoice) => {
    if (!terminoFactura) return true
    const cliente = invoice.order?.client?.nombreComercial ?? ''
    const pedido = invoice.order?.numero ?? ''
    return (
      `${invoice.serie}-${invoice.numero}`.toLowerCase().includes(terminoFactura) ||
      cliente.toLowerCase().includes(terminoFactura) ||
      pedido.toLowerCase().includes(terminoFactura)
    )
  })
  const pendientes = invoices.filter((row) => row.estado === 'pendiente_certificacion').length
  // Se arma un solo string porque `Alert` recibe `children: string`, y mezclar
  // texto con un número suelto no compila.
  const mensajePendientes = `${pendientes} factura${
    pendientes === 1 ? '' : 's'
  } en pendiente de certificación. Es lo normal: no hay certificador FEL contratado, así que quedan esperando a que lo elijas.`
  const createError = createMutation.isError
    ? createMutation.error instanceof ApiError
      ? createMutation.error.message
      : 'No se pudo emitir la factura'
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Facturación</h1>
        <p className="text-sm text-slate-600">
          Las facturas se emiten al entregar el pedido, no desde acá. Esta pantalla es para
          consultarlas y para emitir alguna a mano si hizo falta.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <SearchBox value={busqueda} onChange={setBusqueda} placeholder="Buscar factura, cliente o pedido" />
        <label className="block min-w-56 text-sm">
          <span className="mb-1 block font-medium">Estado</span>
          <select
            value={estado}
            onChange={(event) => setEstado(event.target.value as InvoiceEstado | '')}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="pendiente_certificacion">Pendiente de certificación</option>
            <option value="certificada">Certificada</option>
            <option value="error">Con error</option>
          </select>
        </label>

        <label className="block min-w-72 text-sm">
          <span className="mb-1 block font-medium">Emitir factura de un pedido</span>
          <select
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Elegí un pedido entregado</option>
            {facturables.map((order) => (
              <option key={order.id} value={order.id}>
                {order.numero} · {order.client?.nombreComercial ?? `Cliente ${order.clientId}`}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => createMutation.mutate(Number(orderId))}
          disabled={createMutation.isPending || orderId === ''}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {createMutation.isPending ? 'Emitiendo…' : 'Emitir factura'}
        </button>
      </div>

      {createError ? <Alert tone="error">{createError}</Alert> : null}

      {invoicesQuery.isSuccess && estado === '' && pendientes > 0 ? (
        <Alert tone="info">{mensajePendientes}</Alert>
      ) : null}

      <QueryStatus
        isLoading={invoicesQuery.isLoading}
        errorMessage={invoicesQuery.isError ? 'No se pudieron cargar las facturas' : null}
      />

      {!invoicesQuery.isLoading && !invoicesQuery.isError ? (
        <div className="registros">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Factura</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Pedido</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Emitida</th>
              </tr>
            </thead>
            <tbody>
              {facturasVisibles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No hay facturas para mostrar.
                  </td>
                </tr>
              ) : (
                facturasVisibles.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <p className="font-medium">
                        {invoice.serie}-{invoice.numero}
                      </p>
                      {invoice.uuidFel ? (
                        <p className="text-xs text-slate-500">UUID {invoice.uuidFel.slice(0, 8)}…</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {invoice.order?.client?.nombreComercial ?? '—'}
                    </td>
                    <td className="px-3 py-2">{invoice.order?.numero ?? invoice.orderId}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {money(invoice.total)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${estadoClasses[invoice.estado]}`}>
                        {estadoLabels[invoice.estado]}
                      </span>
                      {invoice.error ? (
                        <p className="mt-1 text-xs text-red-700">{invoice.error}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {invoice.createdAt.slice(0, 10)}
                    </td>
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

