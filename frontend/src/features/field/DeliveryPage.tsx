import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError } from '../admin/api/http.ts'
import { FieldShell } from './FieldShell.tsx'
import { Stepper } from './Stepper.tsx'
import { quetzales } from './format.ts'
import { deliverOrder, listPendingDeliveries } from './ordersApi.ts'

/**
 * Entrega de un pedido en la puerta del cliente.
 *
 * Acá el vendedor no escribe: cuenta lo que baja del camión. Por eso cada línea
 * trae la foto del producto, lo pedido contra lo ya entregado, y botones grandes
 * para marcar fardos, cajas o unidades sin teclear números en un teclado.
 */
export function DeliveryPage() {
  const { orderId } = useParams()
  const id = Number(orderId)
  const queryClient = useQueryClient()
  const [qty, setQty] = useState<Record<number, number>>({})
  const [pagado, setPagado] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [saldoMsg, setSaldoMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ordersQuery = useQuery({ queryKey: ['pending-deliveries'], queryFn: listPendingDeliveries })
  const order = (ordersQuery.data ?? []).find((item) => item.id === id)

  useEffect(() => {
    if (!order) return
    const next: Record<number, number> = {}
    for (const item of order.items) {
      const delivered = (item.deliveryItems ?? []).reduce(
        (sum, row) => sum + Number(row.cantidadEntregada),
        0,
      )
      // Arranca con lo que falta: si vino todo se marca completo de una vez y
      // solo queda tocar "Registrar entrega".
      next[item.id] = Math.max(0, Number(item.cantidad) - delivered)
    }
    setQty(next)
  }, [order])

  // Cuánto vale lo que se está entregando en esta visita: cada línea a
  // proporción de lo entregado sobre lo pedido. Es el cargo que va al libro
  // mayor y el total contra el que el vendedor compara lo que cobró.
  const totalEstaEntrega = (order?.items ?? []).reduce((sum, item) => {
    const entregado = qty[item.id] ?? 0
    if (entregado <= 0) return sum
    const porUnidad = Number(item.totalLinea) / Number(item.cantidad || 1)
    return sum + porUnidad * entregado
  }, 0)

  const pagadoNum = pagado.trim() === '' ? null : Number(pagado)
  const pendiente =
    pagadoNum !== null && Number.isFinite(pagadoNum)
      ? Math.max(0, totalEstaEntrega - pagadoNum)
      : null

  const mutation = useMutation({
    mutationFn: () =>
      deliverOrder(
        id,
        (order?.items ?? []).map((item) => ({
          orderItemId: item.id,
          cantidadEntregada: String(qty[item.id] ?? 0),
        })),
        pagado.trim() === '' ? undefined : pagado.trim(),
      ),
    onSuccess: async (result) => {
      setError(null)
      setDone(result.order.estado === 'entregado' ? 'Entrega completa' : 'Entrega parcial')
      const saldo = result.saldoPendiente !== null ? Number(result.saldoPendiente) : null
      if (saldo !== null && saldo > 0) {
        setSaldoMsg(`Quedó debiendo ${quetzales(result.saldoPendiente!)}. Se guardó como saldo pendiente.`)
      } else if (result.cobrado !== null) {
        setSaldoMsg('Pagó todo. No quedó saldo pendiente.')
      }
      await queryClient.invalidateQueries({ queryKey: ['pending-deliveries'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory-stock'] })
    },
    onError: (err) => {
      setDone(null)
      setSaldoMsg(null)
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la entrega')
    },
  })

  const entregables = order?.items ?? []


  return (
    <FieldShell
      titulo={order?.client?.nombreComercial ?? 'Entrega'}
      subtitulo={
        order ? (
          <span>
            {order.numero} · {order.items.length}{' '}
            {order.items.length === 1 ? 'producto' : 'productos'} · {quetzales(order.total)}
          </span>
        ) : null
      }
    >
      {ordersQuery.isLoading ? (
        <p className="rounded-card bg-surface px-4 py-4 text-sm text-muted">Cargando…</p>
      ) : null}

      {ordersQuery.isError ? (
        <p className="rounded-card border border-brand/25 bg-brand-soft px-4 py-4 text-sm text-brand-deep">
          {ordersQuery.error instanceof ApiError
            ? ordersQuery.error.message
            : 'No se pudo cargar el pedido'}
        </p>
      ) : null}

      {!ordersQuery.isLoading && !order && !done ? (
        <p className="rounded-card border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-muted">
          Ese pedido no está pendiente de entrega.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {entregables.map((item) => {
          const foto = item.productUnit.product.images?.[0]?.url
          const entregado = (item.deliveryItems ?? []).reduce(
            (sum, row) => sum + Number(row.cantidadEntregada),
            0,
          )
          const falta = Math.max(0, Number(item.cantidad) - entregado)
          return (
            <article
              key={item.id}
              className="flex gap-3 rounded-card border border-line bg-surface p-3 shadow-card"
            >
              {foto ? (
                <img
                  src={foto}
                  alt={item.productUnit.product.nombre}
                  loading="lazy"
                  className="h-20 w-20 shrink-0 rounded-[0.625rem] bg-parchment object-cover"
                />
              ) : (
                <span
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[0.625rem] bg-parchment font-display text-2xl font-semibold text-line"
                  aria-hidden="true"
                >
                  {item.productUnit.product.nombre.trim().charAt(0).toUpperCase()}
                </span>
              )}

              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-sm font-semibold text-ink">
                  {item.productUnit.product.nombre}
                </p>
                <p className="truncate text-xs text-muted">{item.productUnit.nombre}</p>
                <p className="mt-1 text-xs text-muted">
                  Pedido {item.cantidad}
                  {entregado > 0 ? ` · ya entregado ${entregado}` : ''}
                </p>
                <div className="mt-auto pt-2">
                  <Stepper
                    valor={qty[item.id] ?? 0}
                    etiqueta={`${item.productUnit.product.nombre} ${item.productUnit.nombre}`}
                    onCambio={(nuevo) =>
                      setQty((current) => ({
                        ...current,
                        [item.id]: Math.max(0, Math.min(nuevo, Number(item.cantidad))),
                      }))
                    }
                  />
                  {falta > 0 ? (
                    <button
                      type="button"
                      onClick={() => setQty((current) => ({ ...current, [item.id]: falta }))}
                      className="mt-1.5 w-full text-center text-xs font-medium text-brand transition-colors hover:text-brand-deep"
                    >
                      Dejar todo lo que falta ({falta})
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {error ? (
        <p className="mt-4 rounded-card border border-brand/25 bg-brand-soft px-4 py-3 text-sm text-brand-deep">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="mt-4 rounded-card border border-gold/30 bg-gold-soft px-4 py-3 text-base font-semibold text-ink">
          {done}
        </p>
      ) : null}

      {order && !done ? (
        <>
          <div className="mt-4 rounded-card border border-line bg-surface p-4 shadow-card">
            <p className="text-sm text-muted">
              Total de esta entrega
            </p>
            <p className="mt-0.5 font-display text-2xl font-semibold text-ink">
              {quetzales(totalEstaEntrega.toFixed(2))}
            </p>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium text-ink">
                ¿Cuánto pagó el cliente hoy?
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={pagado}
                onChange={(event) => setPagado(event.target.value)}
                placeholder="0.00"
                className="h-12 w-full rounded-[0.625rem] border border-line bg-parchment px-3 text-lg text-ink outline-none focus:border-brand"
              />
            </label>
            <p className="mt-2 text-xs text-muted">
              Dejalo en blanco si todavía no cobrás. Si pagó una parte, el resto
              queda como saldo pendiente para la próxima.
            </p>
            {pendiente !== null ? (
              <p
                className={`mt-3 rounded-[0.625rem] px-3 py-2 text-sm font-semibold ${
                  pendiente > 0
                    ? 'bg-gold-soft text-ink'
                    : 'border border-line bg-parchment text-ink-soft'
                }`}
              >
                {pendiente > 0
                  ? `Queda pendiente: ${quetzales(pendiente.toFixed(2))}`
                  : 'Pagó todo, no queda saldo.'}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="mt-4 h-14 w-full rounded-[0.625rem] bg-brand text-lg font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
          >
            {mutation.isPending ? 'Guardando…' : 'Registrar entrega'}
          </button>
        </>
      ) : null}

      {saldoMsg ? (
        <p className="mt-4 rounded-card border border-gold/30 bg-gold-soft px-4 py-3 text-base font-semibold text-ink">
          {saldoMsg}
        </p>
      ) : null}
    </FieldShell>
  )
}

