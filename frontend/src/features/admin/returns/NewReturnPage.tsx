import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listOrders, type FieldOrder } from '../../field/ordersApi.ts'
import { createReturn } from '../api/returns.ts'
import { Alert, QueryStatus } from '../ui/Status.tsx'

/** Lo que se entregó de verdad: lo pedido menos lo ya entregado. */
function pendienteDe(line: FieldOrder['items'][number]) {
  const entregado = (line.deliveryItems ?? []).reduce(
    (sum, row) => sum + Number(row.cantidadEntregada),
    0,
  )
  return Math.max(0, Number(line.cantidad) - entregado)
}

/** Solo se puede devolver sobre pedidos que ya recibieron mercadería. */
function esDevoluble(order: FieldOrder) {
  return (
    (order.estado === 'entregado' || order.estado === 'entregado_parcial') &&
    order.items.some((line) => pendienteDe(line) > 0)
  )
}

const money = (value: string | number) => Number(value).toFixed(2)

type LineaEstado = { cantidad: string; destino: 'reingreso' | 'merma' }

export function NewReturnPage() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [orderId, setOrderId] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')
  const [lineas, setLineas] = useState<Record<number, LineaEstado>>({})
  const [tocado, setTocado] = useState(false)

  // El backend solo expone POST /returns: no hay GET de devoluciones. El
  // buscador trabaja sobre los pedidos que ya trae GET /orders.
  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: () => listOrders() })

  const createMutation = useMutation({
    mutationFn: createReturn,
    onSuccess: (created) => {
      navigate(`/admin/devoluciones/${created.id}`)
    },
  })

  const candidatos = useMemo(() => {
    const todos = (ordersQuery.data ?? []).filter(esDevoluble)
    const term = busqueda.trim().toLowerCase()
    if (term === '') {
      return todos.slice(0, 10)
    }
    return todos
      .filter(
        (order) =>
          order.numero.toLowerCase().includes(term) ||
          (order.client?.nombreComercial ?? '').toLowerCase().includes(term),
      )
      .slice(0, 10)
  }, [ordersQuery.data, busqueda])

  const order = (ordersQuery.data ?? []).find((row) => row.id === orderId) ?? null

  function setLinea(orderItemId: number, patch: Partial<LineaEstado>) {
    setLineas((prev) => ({
      ...prev,
      [orderItemId]: { ...prev[orderItemId], cantidad: '', destino: 'reingreso', ...patch },
    }))
  }

  /**
   * Valida contra lo entregado antes de pegarle al backend: si una cantidad
   * supera lo entregado, el POST /returns igual respondería 422
   * (`RETURN_EXCEEDS_DELIVERED`) y es un viaje al servidor que ya sabemos
   * que va a fallar.
   */
  const lineasConError = useMemo(() => {
    const errores = new Map<number, string>()
    if (!order) {
      return errores
    }
    for (const linea of order.items) {
      const disponible = pendienteDe(linea)
      if (disponible <= 0) {
        continue
      }
      const cantidad = Number(lineas[linea.id]?.cantidad ?? '')
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        continue
      }
      if (cantidad > disponible) {
        errores.set(linea.id, `Máximo ${disponible}`)
      }
    }
    return errores
  }, [order, lineas])

  const items = useMemo(() => {
    if (!order) {
      return []
    }
    return order.items
      .filter((linea) => Number(lineas[linea.id]?.cantidad ?? '') > 0)
      .map((linea) => ({
        orderItemId: linea.id,
        cantidad: lineas[linea.id].cantidad,
        destino: lineas[linea.id].destino,
      }))
  }, [order, lineas])

  const puedeEnviar = motivo.trim() !== '' && items.length > 0 && lineasConError.size === 0

  function enviar() {
    setTocado(true)
    if (!order || !puedeEnviar) {
      return
    }
    createMutation.mutate({
      clientId: order.clientId,
      orderId: order.id,
      motivo: motivo.trim(),
      items,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Nueva devolución</h1>
        <p className="text-sm text-slate-600">
          Elegí el pedido, marcá qué se devuelve y a dónde va cada línea.
        </p>
      </div>

      {!order ? (
        <div className="space-y-4">
          <label className="block max-w-sm text-sm">
            <span className="mb-1 block font-medium">Buscar pedido</span>
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Número de pedido o cliente"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <QueryStatus
            isLoading={ordersQuery.isLoading}
            errorMessage={ordersQuery.isError ? 'No se pudieron cargar los pedidos' : null}
          />

          {!ordersQuery.isLoading && !ordersQuery.isError ? (
            candidatos.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500">
                {busqueda.trim() === ''
                  ? 'No hay pedidos entregados con mercadería para devolver.'
                  : 'Ningún pedido entregado coincide con la búsqueda.'}
              </p>
            ) : (
              <div className="registros">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Pedido</th>
                      <th className="px-3 py-2 font-medium">Cliente</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {candidatos.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium">{row.numero}</td>
                        <td className="px-3 py-2">{row.client?.nombreComercial ?? '—'}</td>
                        <td className="px-3 py-2">{row.estado}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(row.total)}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setOrderId(row.id)}
                            className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Elegir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </div>
      ) : null}


      {order ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{order.numero}</p>
              <p className="text-xs text-slate-500">
                {order.client?.nombreComercial ?? `Cliente ${order.clientId}`} · {order.estado}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOrderId(null)
                setLineas({})
                setTocado(false)
              }}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
            >
              Cambiar pedido
            </button>
          </div>

          <div className="registros">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 text-right font-medium">Pedido</th>
                  <th className="px-3 py-2 text-right font-medium">Entregado</th>
                  <th className="px-3 py-2 font-medium">Devolver</th>
                  <th className="px-3 py-2 font-medium">Destino</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((linea) => {
                  const disponible = pendienteDe(linea)
                  const estado = lineas[linea.id] ?? { cantidad: '', destino: 'reingreso' as const }
                  const error = lineasConError.get(linea.id)
                  return (
                    <tr key={linea.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <p className="font-medium">{linea.productUnit.product.nombre}</p>
                        <p className="text-xs text-slate-500">
                          {linea.productUnit.nombre} · {linea.productUnit.product.sku}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{linea.cantidad}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{disponible}</td>
                      <td className="px-3 py-2">
                        {disponible <= 0 ? (
                          <span className="text-xs text-slate-400">Sin mercadería por devolver</span>
                        ) : (
                          <>
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              value={estado.cantidad}
                              onChange={(event) =>
                                setLinea(linea.id, { cantidad: event.target.value })
                              }
                              placeholder="0"
                              className={`w-28 rounded border px-3 py-2 text-sm ${
                                error ? 'border-red-400' : 'border-slate-300'
                              }`}
                            />
                            {error && tocado ? (
                              <p className="mt-1 text-xs text-red-700">{error}</p>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {disponible <= 0 ? null : (
                          <select
                            value={estado.destino}
                            onChange={(event) =>
                              setLinea(linea.id, {
                                destino: event.target.value as 'reingreso' | 'merma',
                              })
                            }
                            className="rounded border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="reingreso">Reingreso a inventario</option>
                            <option value="merma">Merma</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Motivo general</span>
              <input
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Producto vencido, empaque dañado…"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            {tocado && motivo.trim() === '' ? (
              <p className="mt-1 text-xs text-red-700">Indicá el motivo de la devolución</p>
            ) : null}
          </div>

          {createMutation.isError ? (
            <Alert tone="error">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'No se pudo registrar la devolución'}
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={enviar}
              disabled={createMutation.isPending}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {createMutation.isPending ? 'Registrando…' : 'Registrar devolución'}
            </button>
            <p className="text-sm text-slate-600">
              {items.length} línea{items.length === 1 ? '' : 's'} para devolver
              {lineasConError.size > 0 ? ' · corregí las cantidades marcadas' : ''}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
