import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProducts } from '../api/catalog.ts'
import { ApiError } from '../api/http.ts'
import {
  adjustStock,
  listStock,
  listWarehouses,
  transferStock,
  type StockRow,
} from '../api/inventory.ts'
import { useAuth } from '../auth/AuthContext.tsx'
import { Alert, QueryStatus } from '../ui/Status.tsx'

function asNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatQty(value: number) {
  return value.toLocaleString('es-GT', { maximumFractionDigits: 4 })
}

function expiresSoon(fecha: string | null) {
  if (!fecha) return false
  const expiry = new Date(fecha)
  const limit = new Date()
  limit.setDate(limit.getDate() + 30)
  return expiry.getTime() <= limit.getTime()
}

type Group = {
  key: string
  productId: number
  warehouseId: number
  sku: string
  nombre: string
  controlado: boolean
  bodega: string
  cantidad: number
  reservada: number
  disponible: number
  lines: StockRow[]
}

function groupStock(rows: StockRow[]): Group[] {
  const map = new Map<string, Group>()
  for (const row of rows) {
    const key = `${row.productId}-${row.warehouseId}`
    const current = map.get(key) ?? {
      key,
      productId: row.productId,
      warehouseId: row.warehouseId,
      sku: row.product.sku,
      nombre: row.product.nombre,
      controlado: row.product.controlado,
      bodega: row.warehouse.nombre,
      cantidad: 0,
      reservada: 0,
      disponible: 0,
      lines: [],
    }
    current.cantidad += asNumber(row.cantidad)
    current.reservada += asNumber(row.cantidadReservada)
    current.disponible += asNumber(row.disponible)
    current.lines.push(row)
    map.set(key, current)
  }
  return [...map.values()]
}

export function InventoryPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'
  const queryClient = useQueryClient()
  const [warehouseId, setWarehouseId] = useState('')
  const [productId, setProductId] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)

  const [originId, setOriginId] = useState('')
  const [destId, setDestId] = useState('')
  const [transferProductId, setTransferProductId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [transferQty, setTransferQty] = useState('')
  const [transferMessage, setTransferMessage] = useState<string | null>(null)
  const [transferError, setTransferError] = useState<string | null>(null)

  const [adjustProductId, setAdjustProductId] = useState('')
  const [adjustWarehouseId, setAdjustWarehouseId] = useState('')
  const [adjustBatchId, setAdjustBatchId] = useState('')
  const [adjustQty, setAdjustQty] = useState('')
  const [motivo, setMotivo] = useState('')
  const [adjustMessage, setAdjustMessage] = useState<string | null>(null)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  const filters = {
    warehouseId: warehouseId ? Number(warehouseId) : undefined,
    productId: productId ? Number(productId) : undefined,
  }
  const stockQuery = useQuery({
    queryKey: ['inventory-stock', filters],
    queryFn: () => listStock(filters),
  })
  const allStockQuery = useQuery({
    queryKey: ['inventory-stock', {}],
    queryFn: () => listStock({}),
  })
  const warehousesQuery = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses })
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: listProducts })

  const groups = useMemo(() => groupStock(stockQuery.data ?? []), [stockQuery.data])
  const transferProduct = (productsQuery.data ?? []).find((product) => product.id === Number(transferProductId))
  const originLines = (allStockQuery.data ?? []).filter(
    (row) => row.productId === Number(transferProductId) && row.warehouseId === Number(originId),
  )
  const selectedLine = transferProduct?.controlado
    ? originLines.find((row) => row.batchId === Number(batchId))
    : originLines.find((row) => row.batchId === null) ?? originLines[0]
  const disponible = selectedLine ? asNumber(selectedLine.disponible) : 0
  const qtyTooHigh = transferQty !== '' && Number(transferQty) > disponible

  async function refreshStock() {
    await queryClient.invalidateQueries({ queryKey: ['inventory-stock'] })
    await queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
  }

  const transferMutation = useMutation({
    mutationFn: transferStock,
    onSuccess: async () => {
      setTransferError(null)
      setTransferMessage('Traslado registrado')
      setTransferQty('')
      await refreshStock()
    },
    onError: (err) => {
      setTransferMessage(null)
      setTransferError(err instanceof ApiError ? err.message : 'No se pudo trasladar')
    },
  })

  const adjustMutation = useMutation({
    mutationFn: adjustStock,
    onSuccess: async () => {
      setAdjustError(null)
      setAdjustMessage('Ajuste registrado')
      setAdjustQty('')
      setMotivo('')
      await refreshStock()
    },
    onError: (err) => {
      setAdjustMessage(null)
      setAdjustError(err instanceof ApiError ? err.message : 'No se pudo ajustar')
    },
  })

  const adjustProduct = (productsQuery.data ?? []).find((product) => product.id === Number(adjustProductId))
  const adjustLines = (allStockQuery.data ?? []).filter(
    (row) => row.productId === Number(adjustProductId) && row.warehouseId === Number(adjustWarehouseId),
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Inventario</h1>
        <p className="text-sm text-slate-600">Existencias por producto y bodega.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Bodega</span>
          <select
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {(warehousesQuery.data ?? []).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Producto</span>
          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {(productsQuery.data ?? []).map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} — {product.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <QueryStatus
        isLoading={stockQuery.isLoading}
        errorMessage={
          stockQuery.isError
            ? stockQuery.error instanceof ApiError
              ? stockQuery.error.message
              : 'No se pudieron cargar las existencias'
            : null
        }
      />

      {!stockQuery.isLoading && !stockQuery.isError ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Bodega</th>
                <th className="px-3 py-2 font-medium">Cantidad</th>
                <th className="px-3 py-2 font-medium">Reservada</th>
                <th className="px-3 py-2 font-medium">Disponible</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    No hay existencias para ese filtro.
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <Fragment key={group.key}>
                    <tr className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <Link to={`/admin/inventario/${group.productId}`} className="font-medium hover:underline">
                          {group.sku} — {group.nombre}
                        </Link>
                        {group.controlado ? (
                          <button
                            type="button"
                            onClick={() => setOpenKey(openKey === group.key ? null : group.key)}
                            className="ml-2 text-xs text-slate-600 underline"
                          >
                            {openKey === group.key ? 'Ocultar lotes' : 'Ver lotes'}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{group.bodega}</td>
                      <td className="px-3 py-2">{formatQty(group.cantidad)}</td>
                      <td className="px-3 py-2">{formatQty(group.reservada)}</td>
                      <td className="px-3 py-2">{formatQty(group.disponible)}</td>
                    </tr>
                    {group.controlado && openKey === group.key
                      ? group.lines.map((line) => {
                          const soon = expiresSoon(line.batch?.fechaVencimiento ?? null)
                          return (
                            <tr key={line.id} className={soon ? 'bg-amber-50 text-amber-950' : 'bg-slate-50'}>
                              <td className="px-3 py-2 pl-8" colSpan={2}>
                                Lote {line.batch?.lote ?? 'sin lote'}
                                {line.batch?.fechaVencimiento
                                  ? ` · vence ${line.batch.fechaVencimiento.slice(0, 10)}`
                                  : ''}
                                {soon ? ' · vence en 30 días o menos' : ''}
                              </td>
                              <td className="px-3 py-2">{formatQty(asNumber(line.cantidad))}</td>
                              <td className="px-3 py-2">{formatQty(asNumber(line.cantidadReservada))}</td>
                              <td className="px-3 py-2">{formatQty(asNumber(line.disponible))}</td>
                            </tr>
                          )
                        })
                      : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          setTransferMessage(null)
          setTransferError(null)
          transferMutation.mutate({
            productId: Number(transferProductId),
            warehouseIdOrigen: Number(originId),
            warehouseIdDestino: Number(destId),
            batchId: transferProduct?.controlado ? Number(batchId) : null,
            cantidad: transferQty,
          })
        }}
        className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold">Traslado</h2>
        {transferError ? <Alert tone="error">{transferError}</Alert> : null}
        {transferMessage ? <Alert tone="success">{transferMessage}</Alert> : null}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Producto</span>
          <select
            required
            value={transferProductId}
            onChange={(event) => {
              setTransferProductId(event.target.value)
              setBatchId('')
            }}
            className="w-full rounded border border-slate-300 px-3 py-2"
          >
            <option value="">Selecciona…</option>
            {(productsQuery.data ?? []).map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} — {product.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Bodega origen</span>
          <select required value={originId} onChange={(event) => setOriginId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2">
            <option value="">Selecciona…</option>
            {(warehousesQuery.data ?? []).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Bodega destino</span>
          <select required value={destId} onChange={(event) => setDestId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2">
            <option value="">Selecciona…</option>
            {(warehousesQuery.data ?? []).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.nombre}
              </option>
            ))}
          </select>
        </label>
        {transferProduct?.controlado ? (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Lote</span>
            <select required value={batchId} onChange={(event) => setBatchId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2">
              <option value="">Selecciona…</option>
              {originLines
                .filter((line) => line.batch)
                .map((line) => (
                  <option key={line.batchId} value={line.batchId ?? ''}>
                    {line.batch?.lote} · disponible {formatQty(asNumber(line.disponible))}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        <p className="text-sm text-slate-600">Disponible en origen: {formatQty(disponible)}</p>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Cantidad</span>
          <input
            required
            value={transferQty}
            onChange={(event) => setTransferQty(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          {qtyTooHigh ? (
            <span className="text-xs text-red-700">Supera lo disponible ({formatQty(disponible)}).</span>
          ) : null}
        </label>
        <button
          type="submit"
          disabled={transferMutation.isPending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {transferMutation.isPending ? 'Trasladando…' : 'Trasladar'}
        </button>
      </form>

      {isAdmin ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setAdjustError(null)
            setAdjustMessage(null)
            adjustMutation.mutate({
              productId: Number(adjustProductId),
              warehouseId: Number(adjustWarehouseId),
              batchId: adjustProduct?.controlado ? Number(adjustBatchId) : null,
              cantidad: adjustQty,
              motivo: motivo.trim(),
            })
          }}
          className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold">Ajuste manual</h2>
          {adjustError ? <Alert tone="error">{adjustError}</Alert> : null}
          {adjustMessage ? <Alert tone="success">{adjustMessage}</Alert> : null}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Producto</span>
            <select required value={adjustProductId} onChange={(event) => setAdjustProductId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2">
              <option value="">Selecciona…</option>
              {(productsQuery.data ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} — {product.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Bodega</span>
            <select required value={adjustWarehouseId} onChange={(event) => setAdjustWarehouseId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2">
              <option value="">Selecciona…</option>
              {(warehousesQuery.data ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.nombre}
                </option>
              ))}
            </select>
          </label>
          {adjustProduct?.controlado ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Lote</span>
              <select required value={adjustBatchId} onChange={(event) => setAdjustBatchId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2">
                <option value="">Selecciona…</option>
                {adjustLines
                  .filter((line) => line.batch)
                  .map((line) => (
                    <option key={line.batchId} value={line.batchId ?? ''}>
                      {line.batch?.lote}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Cantidad (negativa resta)</span>
            <input required value={adjustQty} onChange={(event) => setAdjustQty(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Motivo</span>
            <input required value={motivo} onChange={(event) => setMotivo(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <button type="submit" disabled={adjustMutation.isPending} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {adjustMutation.isPending ? 'Guardando…' : 'Registrar ajuste'}
          </button>
        </form>
      ) : null}
    </div>
  )
}
