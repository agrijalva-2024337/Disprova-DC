import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../admin/api/http.ts'
import { deliverOrder, listPendingDeliveries } from './ordersApi.ts'

export function DeliveryPage() {
  const { orderId } = useParams()
  const id = Number(orderId)
  const queryClient = useQueryClient()
  const [qty, setQty] = useState<Record<number, string>>({})
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ordersQuery = useQuery({ queryKey: ['pending-deliveries'], queryFn: listPendingDeliveries })
  const order = (ordersQuery.data ?? []).find((item) => item.id === id)

  useEffect(() => {
    if (!order) return
    const next: Record<number, string> = {}
    for (const item of order.items) {
      const delivered = (item.deliveryItems ?? []).reduce((sum, row) => sum + Number(row.cantidadEntregada), 0)
      next[item.id] = String(Math.max(0, Number(item.cantidad) - delivered))
    }
    setQty(next)
  }, [order])

  const mutation = useMutation({
    mutationFn: () =>
      deliverOrder(
        id,
        (order?.items ?? []).map((item) => ({
          orderItemId: item.id,
          cantidadEntregada: qty[item.id] ?? '0',
        })),
      ),
    onSuccess: async (result) => {
      setError(null)
      setDone(result.order.estado === 'entregado' ? 'Entrega completa' : 'Entrega parcial')
      await queryClient.invalidateQueries({ queryKey: ['pending-deliveries'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory-stock'] })
    },
    onError: (err) => {
      setDone(null)
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la entrega')
    },
  })

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-slate-100 px-4 py-4">
      <Link to="/ruta/entregas" className="text-base text-slate-600">
        ← Entregas
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{order?.client?.nombreComercial ?? 'Entrega'}</h1>
      {ordersQuery.isLoading ? <p className="mt-4">Cargando…</p> : null}
      {ordersQuery.isError ? (
        <p className="mt-4 text-red-800">
          {ordersQuery.error instanceof ApiError ? ordersQuery.error.message : 'No se pudo cargar el pedido'}
        </p>
      ) : null}
      {!ordersQuery.isLoading && !order && !done ? <p className="mt-4">Ese pedido no está pendiente.</p> : null}
      <div className="mt-4 space-y-3">
        {(order?.items ?? []).map((item) => (
          <label key={item.id} className="block rounded-2xl bg-white px-4 py-4">
            <span className="text-lg font-medium">
              {item.productUnit.product.nombre} · {item.productUnit.nombre}
            </span>
            <span className="mt-1 block text-sm text-slate-600">Pedido {item.cantidad}</span>
            <input
              aria-label={`Entregado ${item.productUnit.product.nombre}`}
              value={qty[item.id] ?? ''}
              onChange={(event) => setQty((current) => ({ ...current, [item.id]: event.target.value }))}
              className="mt-2 h-14 w-full rounded-xl border border-slate-300 px-4 text-lg"
            />
          </label>
        ))}
      </div>
      {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">{error}</p> : null}
      {done ? <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-lg font-semibold text-green-900">{done}</p> : null}
      {order && !done ? (
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="mt-4 h-14 w-full rounded-xl bg-slate-900 text-lg font-medium text-white"
        >
          {mutation.isPending ? 'Guardando…' : 'Registrar entrega'}
        </button>
      ) : null}
    </div>
  )
}
