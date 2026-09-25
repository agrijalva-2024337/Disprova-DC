import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../admin/api/http.ts'
import {
  confirmOrder,
  createOrder,
  getClient,
  getPriceList,
  listOrders,
  listProducts,
} from './ordersApi.ts'

type CartLine = {
  productUnitId: number
  productName: string
  unitName: string
  precio: number
  cantidad: number
}

function money(value: number) {
  return Math.round(value * 100) / 100
}

function lineTotal(precio: number, cantidad: number) {
  const base = money(precio * cantidad)
  return money(base + money(base * 0.12))
}

export function NewOrderPage() {
  const { clientId } = useParams()
  const id = Number(clientId)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [pickedProductId, setPickedProductId] = useState<number | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [condicion, setCondicion] = useState<'contado' | 'credito'>('contado')
  const [errorTitle, setErrorTitle] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  const clientQuery = useQuery({ queryKey: ['field-client', id], queryFn: () => getClient(id), enabled: Number.isFinite(id) })
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: listProducts })
  const priceQuery = useQuery({
    queryKey: ['price-list', clientQuery.data?.priceListId],
    queryFn: () => getPriceList(clientQuery.data!.priceListId),
    enabled: Boolean(clientQuery.data?.priceListId),
  })
  const previousQuery = useQuery({
    queryKey: ['client-orders', id],
    queryFn: () => listOrders(id),
    enabled: Number.isFinite(id),
  })

  const priceByUnit = useMemo(() => {
    const map = new Map<number, number>()
    const items = [...(priceQuery.data?.items ?? [])].sort((a, b) => a.vigenteDesde.localeCompare(b.vigenteDesde))
    for (const item of items) {
      if (item.vigenteDesde.slice(0, 10) <= new Date().toISOString().slice(0, 10)) {
        map.set(item.productUnitId, Number(item.precio))
      }
    }
    return map
  }, [priceQuery.data])

  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return []
    return (productsQuery.data ?? [])
      .filter((product) => {
        const barcode = product.units.some((unit) => unit.codigoBarras?.toLowerCase().includes(term))
        return product.nombre.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term) || barcode
      })
      .slice(0, 8)
  }, [productsQuery.data, search])

  const picked = (productsQuery.data ?? []).find((product) => product.id === pickedProductId) ?? null
  const total = cart.reduce((sum, line) => sum + lineTotal(line.precio, line.cantidad), 0)
  const previous = previousQuery.data?.[0]

  function addUnit(productName: string, unitId: number, unitName: string) {
    const precio = priceByUnit.get(unitId)
    if (precio === undefined) {
      setErrorTitle('Sin precio')
      setErrorDetail('Esta presentación no está en la lista del cliente.')
      return
    }
    setErrorTitle(null)
    setErrorDetail(null)
    setCart((current) => {
      const existing = current.find((line) => line.productUnitId === unitId)
      if (existing) {
        return current.map((line) =>
          line.productUnitId === unitId ? { ...line, cantidad: line.cantidad + 1 } : line,
        )
      }
      return [...current, { productUnitId: unitId, productName, unitName, precio, cantidad: 1 }]
    })
    setPickedProductId(null)
    setSearch('')
  }

  function repeatPrevious() {
    if (!previous) return
    setCart(
      previous.items
        .map((item) => ({
          productUnitId: item.productUnitId,
          productName: item.productUnit.product.nombre,
          unitName: item.productUnit.nombre,
          precio: priceByUnit.get(item.productUnitId) ?? Number(item.precioUnitario),
          cantidad: Number(item.cantidad),
        }))
        .filter((line) => Number.isFinite(line.precio)),
    )
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const order = await createOrder({
        clientId: id,
        canal: 'campo',
        condicionPago: condicion,
        items: cart.map((line) => ({ productUnitId: line.productUnitId, cantidad: String(line.cantidad) })),
      })
      await confirmOrder(order.id)
      return order
    },
    onSuccess: (order) => {
      navigate(`/ruta/entregas/${order.id}`)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'CREDIT_LIMIT_EXCEEDED') {
        setErrorTitle('No pasa por crédito')
      } else if (err instanceof ApiError && err.code === 'INSUFFICIENT_STOCK') {
        setErrorTitle('No pasa por stock')
      } else {
        setErrorTitle('No se confirmó el pedido')
      }
      setErrorDetail(err instanceof ApiError ? err.message : 'No se pudo confirmar')
    },
  })

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-100 pb-40">
      <header className="sticky top-0 z-10 bg-white px-4 py-4">
        <Link to="/ruta" className="text-base text-slate-600">
          ← Ruta
        </Link>
        <h1 className="text-2xl font-semibold">{clientQuery.data?.nombreComercial ?? 'Pedido'}</h1>
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPickedProductId(null)
          }}
          placeholder="Nombre o código"
          className="mt-3 h-14 w-full rounded-xl border border-slate-300 px-4 text-lg"
        />
      </header>

      <div className="flex gap-2 px-4 pt-3">
        <button
          type="button"
          onClick={() => setCondicion('contado')}
          className={`h-12 flex-1 rounded-xl text-base font-medium ${condicion === 'contado' ? 'bg-slate-900 text-white' : 'bg-white'}`}
        >
          Contado
        </button>
        <button
          type="button"
          onClick={() => setCondicion('credito')}
          className={`h-12 flex-1 rounded-xl text-base font-medium ${condicion === 'credito' ? 'bg-slate-900 text-white' : 'bg-white'}`}
        >
          Crédito
        </button>
      </div>

      {previous ? (
        <button type="button" onClick={repeatPrevious} className="mx-4 mt-3 h-14 rounded-xl bg-white text-lg font-medium">
          Repetir pedido anterior
        </button>
      ) : null}

      {errorTitle ? (
        <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-lg font-semibold text-red-900">{errorTitle}</p>
          <p className="mt-1 text-base text-red-800">{errorDetail}</p>
        </div>
      ) : null}

      <div className="space-y-2 px-4 py-3">
        {results.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => setPickedProductId(product.id)}
            className="h-14 w-full rounded-xl bg-white px-4 text-left text-lg font-medium"
          >
            {product.nombre}
          </button>
        ))}
        {picked
          ? picked.units.map((unit) => (
              <button
                key={unit.id}
                type="button"
                onClick={() => addUnit(picked.nombre, unit.id, unit.nombre)}
                className="h-14 w-full rounded-xl bg-slate-900 px-4 text-left text-lg font-medium text-white"
              >
                {unit.nombre}
                {priceByUnit.has(unit.id) ? ` · Q${priceByUnit.get(unit.id)}` : ' · sin precio'}
              </button>
            ))
          : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-md border-t border-slate-200 bg-white px-4 py-3">
        <div className="max-h-40 space-y-2 overflow-y-auto">
          {cart.map((line) => (
            <div key={line.productUnitId} className="flex items-center justify-between gap-2">
              <p className="text-sm">
                {line.productName} · {line.unitName}
              </p>
              <input
                aria-label={`Cantidad ${line.productName} ${line.unitName}`}
                value={line.cantidad}
                onChange={(event) =>
                  setCart((current) =>
                    current.map((item) =>
                      item.productUnitId === line.productUnitId
                        ? { ...item, cantidad: Number(event.target.value) || 0 }
                        : item,
                    ),
                  )
                }
                className="h-12 w-16 rounded-lg border border-slate-300 text-center text-lg"
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-lg font-semibold">Total Q{money(total).toFixed(2)}</p>
        <button
          type="button"
          disabled={cart.length === 0 || saveMutation.isPending}
          onClick={() => {
            setErrorTitle(null)
            setErrorDetail(null)
            saveMutation.mutate()
          }}
          className="mt-2 h-14 w-full rounded-xl bg-slate-900 text-lg font-medium text-white disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Confirmando…' : 'Confirmar pedido'}
        </button>
      </div>
    </div>
  )
}
