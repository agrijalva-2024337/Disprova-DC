import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/http.ts'
import { cancelOrder, cantidadEntregada, confirmOrder, getOrder, type OrderCanal } from '../api/orders.ts'
import { Alert, OrderStatus, QueryStatus } from '../ui/Status.tsx'

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

export function OrderDetailPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)

  const orderQuery = useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => getOrder(orderId),
    enabled: Number.isInteger(orderId) && orderId > 0,
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmOrder(orderId),
    onSuccess: async () => {
      setActionError(null)
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'CREDIT_LIMIT_EXCEEDED') {
        setActionError(err.message)
        return
      }
      setActionError('No se pudo confirmar el pedido')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: async () => {
      setActionError(null)
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: () => {
      setActionError('No se pudo cancelar el pedido')
    },
  })

  const order = orderQuery.data
  const nadaEntregado = order ? order.items.every((item) => cantidadEntregada(item) === 0) : false
  const puedeCancelar =
    order &&
    (order.estado === 'confirmado' || order.estado === 'entregado_parcial') &&
    nadaEntregado

  return (
    <div className="space-y-6">
      <Link to="/admin/pedidos" className="text-sm text-slate-600 underline">
        Volver a pedidos
      </Link>

      <QueryStatus
        isLoading={orderQuery.isLoading}
        errorMessage={orderQuery.isError ? 'No se pudo cargar el pedido' : null}
        loadingText="Cargando pedido…"
      />

      {order ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-semibold">{order.numero}</h1>
                <OrderStatus estado={order.estado} />
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Cliente</dt>
                  <dd>{order.client?.nombreComercial ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Vendedor</dt>
                  <dd>{order.user?.nombre ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Canal</dt>
                  <dd>{canalLabel[order.canal]}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Condición de pago</dt>
                  <dd>{pagoLabel[order.condicionPago]}</dd>
                </div>
              </dl>
            </div>
            <div className="flex gap-2">
              {order.estado === 'borrador' ? (
                <button
                  type="button"
                  disabled={confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate()}
                  className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  Confirmar
                </button>
              ) : null}
              {puedeCancelar ? (
                <button
                  type="button"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                  className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>

          {actionError ? <Alert tone="error">{actionError}</Alert> : null}

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 font-medium">Presentación</th>
                  <th className="px-3 py-2 font-medium">Cantidad</th>
                  <th className="px-3 py-2 font-medium">Precio</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Entregado</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{item.productUnit.product.nombre}</td>
                    <td className="px-3 py-2">{item.productUnit.nombre}</td>
                    <td className="px-3 py-2">{item.cantidad}</td>
                    <td className="px-3 py-2">{quetzales(item.precioUnitario)}</td>
                    <td className="px-3 py-2">{quetzales(item.totalLinea)}</td>
                    <td className="px-3 py-2">{cantidadEntregada(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
