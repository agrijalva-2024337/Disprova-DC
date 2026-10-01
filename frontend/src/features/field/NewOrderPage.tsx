import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../admin/api/http.ts'
import type { Category, PriceListItem, Product, ProductUnit } from '../admin/api/types.ts'
import { FieldShell } from './FieldShell.tsx'
import { OrderCart } from './OrderCart.tsx'
import { OrderCartSheet } from './OrderCartSheet.tsx'
import { ProductTile } from './ProductTile.tsx'
import type { CartLine } from './cart.ts'
import { claveIdempotencia, totales } from './cart.ts'
import {
  confirmOrder,
  createOrder,
  getClient,
  getPriceList,
  listCategories,
  listOrders,
  listProducts,
} from './ordersApi.ts'

/**
 * Precio vigente de una presentación en la lista del cliente.
 *
 * Dos detalles que el backend ya resuelve y que esta pantalla tiene que copiar
 * o el vendedor cotiza otra cosa:
 *
 * - Un precio desactivado (`activo: false`) deja de aplicar. Antes se tomaba el
 *   último `vigenteDesde` sin mirar el `activo`, y se mostraba un precio que el
 *   backend iba a rechazar al confirmar.
 * - El backend compara `vigenteDesde <= ahora` con la fecha completa. Comparar
 *   solo los diez primeros caracteres del ISO dejaba pasar precios que todavía
 *   no rigen y rechazaba alguno que sí.
 */
function preciosVigentes(items: PriceListItem[] | undefined): Map<number, number> {
  const mapa = new Map<number, number>()
  const ahora = Date.now()
  const ordenados = [...(items ?? [])].sort((a, b) =>
    b.vigenteDesde.localeCompare(a.vigenteDesde),
  )
  for (const item of ordenados) {
    if (item.activo === false) continue
    const desde = Date.parse(item.vigenteDesde)
    if (Number.isNaN(desde) || desde > ahora) continue
    if (!mapa.has(item.productUnitId)) {
      mapa.set(item.productUnitId, Number(item.precio))
    }
  }
  return mapa
}

/**
 * Tomar el pedido en la ruta del cliente.
 *
 * Antes era un campo de texto: había que recordar el nombre, apretar el
 * resultado y recién entonces elegir la presentación. Ahora el catálogo se abre
 * por CATEGORÍAS, con la foto de cada producto y un "+" por tarjeta; y si el
 * producto se vende en varias presentaciones (fardo, media docena, docena) el
 * desplegable de la tarjeta cambia de presentación y el "+" suma sobre esa.
 *
 * La grilla se adapta sola: dos columnas en el teléfono, hasta cinco en una
 * pantalla ancha. En escritorio el pedido se fija en una columna lateral; en el
 * teléfono, en una hoja que sube desde abajo.
 */
export function NewOrderPage() {
  const { clientId } = useParams()
  const id = Number(clientId)
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [categoriaId, setCategoriaId] = useState<number | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [condicion, setCondicion] = useState<'contado' | 'credito'>('contado')
  const [errorTitle, setErrorTitle] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  // Una clave por PEDIDO, no por intento: nace con el formulario y sobrevive a
  // los reintentos. Si se regenerara en cada submit, un doble toque o un
  // reintento tras un corte de red abrirían dos pedidos del mismo cliente.
  const [idempotencyKey] = useState(claveIdempotencia)

  const clientQuery = useQuery({ queryKey: ['field-client', id], queryFn: () => getClient(id), enabled: Number.isFinite(id) })
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: listProducts })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories })
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

  const priceByUnit = useMemo(() => preciosVigentes(priceQuery.data?.items), [priceQuery.data])

  /**
   * Solo se ofrece lo que se puede cotizar: un producto sin ninguna
   * presentación con precio vigente no aparece, igual que en el catálogo
   * público. Ver "sin precio" en todas partes solo hace dudar al vendedor
   * parado en la puerta del cliente.
   *
   * De paso se caen las presentaciones dadas de baja: `GET /catalog/products`
   * las sigue devolviendo y el precio queda en la lista, así que sin este
   * filtro el vendedor podía pedir una presentación que el negocio ya no
   * vende.
   */
  const vendibles = useMemo(() => {
    return (productsQuery.data ?? [])
      .map((producto) => ({
        ...producto,
        units: producto.units.filter((unidad) => unidad.activo !== false),
      }))
      .filter((producto) => producto.units.length > 0)
      .filter((producto) => producto.units.some((unidad) => priceByUnit.has(unidad.id)))
  }, [productsQuery.data, priceByUnit])

  const porCategoria = useMemo(() => {
    const mapa = new Map<number, Product[]>()
    for (const producto of vendibles) {
      const lista = mapa.get(producto.categoryId)
      if (lista) lista.push(producto)
      else mapa.set(producto.categoryId, [producto])
    }
    return mapa
  }, [vendibles])

  /** Pestañas de categoría. Solo las que tienen algo que vender. */
  const categorias = useMemo(() => {
    return (categoriesQuery.data ?? [])
      .map((categoria: Category) => ({
        id: categoria.id,
        nombre: categoria.nombre,
        total: porCategoria.get(categoria.id)?.length ?? 0,
      }))
      .filter((categoria) => categoria.total > 0)
  }, [categoriesQuery.data, porCategoria])

  const visibles = useMemo(() => {
    const base = categoriaId === null ? vendibles : (porCategoria.get(categoriaId) ?? [])
    const term = busqueda.trim().toLowerCase()
    if (!term) return base
    return base.filter((producto) => {
      const codigoBarras = producto.units.some((unidad) =>
        unidad.codigoBarras?.toLowerCase().includes(term),
      )
      return (
        producto.nombre.toLowerCase().includes(term) ||
        producto.sku.toLowerCase().includes(term) ||
        codigoBarras
      )
    })
  }, [vendibles, porCategoria, categoriaId, busqueda])

  const { subtotal, impuesto, total } = totales(cart)
  const previous = previousQuery.data?.[0]

  const precioDe = (unidad: ProductUnit) => priceByUnit.get(unidad.id)
  const cantidadDe = (unidadId: number) =>
    cart.find((linea) => linea.productUnitId === unidadId)?.cantidad ?? 0

  /**
   * Suma o quita una presentación. Al bajar de 1 la línea desaparece: antes
   * quedaban renglones con cantidad 0 que se mandaban al backend y terminaban
   * como productos de importe cero en el pedido.
   */
  function cambiarCantidad(producto: Product, unidad: ProductUnit, nueva: number) {
    const precio = precioDe(unidad)
    if (precio === undefined) {
      setErrorTitle('Sin precio')
      setErrorDetail('Esta presentación no está en la lista de precios de este cliente.')
      return
    }
    setErrorTitle(null)
    setErrorDetail(null)

    setCart((current) => {
      if (nueva <= 0) {
        return current.filter((linea) => linea.productUnitId !== unidad.id)
      }
      const existente = current.find((linea) => linea.productUnitId === unidad.id)
      if (existente) {
        return current.map((linea) =>
          linea.productUnitId === unidad.id ? { ...linea, cantidad: nueva, precio } : linea,
        )
      }
      const foto = producto.images.find((image) => image.esPrincipal) ?? producto.images[0]
      return [
        ...current,
        {
          productUnitId: unidad.id,
          productId: producto.id,
          productName: producto.nombre,
          unitName: unidad.nombre,
          imagen: foto?.url ?? null,
          precio,
          cantidad: nueva,
        },
      ]
    })
  }

  function cambiarLinea(linea: CartLine, nueva: number) {
    setCart((current) =>
      nueva <= 0
        ? current.filter((item) => item.productUnitId !== linea.productUnitId)
        : current.map((item) =>
            item.productUnitId === linea.productUnitId ? { ...item, cantidad: nueva } : item,
          ),
    )
  }

  function repeatPrevious() {
    if (!previous) return
    setCart(
      previous.items
        .map((item) => ({
          productUnitId: item.productUnitId,
          productId: item.productUnit.product.id,
          productName: item.productUnit.product.nombre,
          unitName: item.productUnit.nombre,
          imagen: item.productUnit.product.images?.[0]?.url ?? null,
          precio: priceByUnit.get(item.productUnitId) ?? Number(item.precioUnitario),
          cantidad: Number(item.cantidad),
        }))
        // Una presentación que hoy no tiene precio no se arrastra: mandar el
        // precio viejo dejaría al vendedor leyendo algo que el backend no
        // va a aceptar.
        .filter((linea) => Number.isFinite(linea.precio) && linea.cantidad > 0),
    )
    setErrorTitle(null)
    setErrorDetail(null)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const order = await createOrder({
        clientId: id,
        canal: 'campo',
        condicionPago: condicion,
        idempotencyKey,
        items: cart
          .filter((linea) => linea.cantidad > 0)
          .map((linea) => ({ productUnitId: linea.productUnitId, cantidad: String(linea.cantidad) })),
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
      } else if (err instanceof ApiError && err.code === 'NO_VEHICLE_WAREHOUSE') {
        // No es un fallo del pedido: el pedido se creó y lo que falta es la
        // bodega del vendedor. Decirlo evita que lo intente otra vez igual.
        setErrorTitle('Falta la bodega del vendedor')
      } else {
        setErrorTitle('No se confirmó el pedido')
      }
      setErrorDetail(
        err instanceof ApiError
          ? err.message
          : 'No se pudo confirmar. Revisá la señal e intentá de nuevo.',
      )
    },
  })

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col bg-slate-100 pb-40">
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
=======
  const cargando = clientQuery.isLoading || productsQuery.isLoading || priceQuery.isLoading
  const errorCarga = [clientQuery, productsQuery, categoriesQuery, priceQuery].find(
    (query) => query.isError,
  )
  const mensajeCarga = errorCarga
    ? errorCarga.error instanceof ApiError
      ? errorCarga.error.message
      : 'No se pudo cargar el catálogo del cliente'
    : null

  // Se pasa el mismo objeto a la columna lateral de escritorio y a la hoja del
  // teléfono. Que sea uno solo evita que las dos muestren totales distintos.
  const pedido = {
    lineas: cart,
    onCantidad: cambiarLinea,
    onVaciar: () => setCart([]),
    subtotal,
    impuesto,
    total,
    condicion,
    onCondicion: setCondicion,
    onConfirmar: () => {
      setErrorTitle(null)
      setErrorDetail(null)
      saveMutation.mutate()
    },
    pendiente: saveMutation.isPending,
  }

  return (
    <FieldShell
      titulo={clientQuery.data?.nombreComercial ?? 'Nuevo pedido'}
      subtitulo={
        <span>
          Elegí por categoría y apretá <span className="font-semibold text-ink">+</span> para
          sumar. {visibles.length} {visibles.length === 1 ? 'producto' : 'productos'}
          {categoriaId !== null ? ' en esta categoría' : ' en el catálogo'}
        </span>
      }
      acciones={
        previous ? (
          <button
            type="button"
            onClick={repeatPrevious}
            className="h-10 rounded-[0.625rem] border border-line bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:border-brand/40 hover:bg-brand-soft/60"
          >
            Repetir pedido anterior
          </button>
        ) : null
      }
      aside={<OrderCart {...pedido} />}
    >
      {cargando ? (
        <p className="rounded-card bg-surface px-4 py-4 text-sm text-muted">Cargando catálogo…</p>
      ) : null}

      {mensajeCarga ? (
        <p className="rounded-card border border-brand/25 bg-brand-soft px-4 py-4 text-sm text-brand-deep">
          {mensajeCarga}
        </p>
      ) : null}

      {errorTitle ? (
        <div className="mb-3 rounded-card border border-brand/25 bg-brand-soft px-4 py-3">
          <p className="text-base font-semibold text-brand-deep">{errorTitle}</p>
          <p className="mt-0.5 text-sm text-brand-deep">{errorDetail}</p>
        </div>
      ) : null}

      {/* Búsqueda: apoyo para cuando el cliente pide algo puntual, no la forma
          principal de encontrar el producto. */}
      <input
        value={busqueda}
        onChange={(event) => setBusqueda(event.target.value)}
        placeholder="Buscar por nombre, código o código de barras"
        aria-label="Buscar productos"
        className="h-12 w-full rounded-[0.625rem] border border-line bg-surface px-4 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-brand"
      />

      <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip activo={categoriaId === null} onClick={() => setCategoriaId(null)}>
          Todos · {vendibles.length}
        </Chip>
        {categorias.map((categoria) => (
          <Chip
            key={categoria.id}
            activo={categoriaId === categoria.id}
            onClick={() => setCategoriaId(categoria.id)}
          >
            {categoria.nombre} · {categoria.total}
          </Chip>
        ))}
      </nav>

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-6xl border-t border-slate-200 bg-white px-4 py-3">
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
      {!cargando && !mensajeCarga && visibles.length === 0 ? (
        <p className="mt-6 rounded-card border border-dashed border-line bg-surface px-4 py-10 text-center text-sm text-muted">
          {busqueda.trim() === ''
            ? 'Este cliente no tiene productos con precio en su lista.'
            : 'Ningún producto de esta categoría coincide con la búsqueda.'}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 2xl:grid-cols-5">
        {visibles.map((producto) => (
          <ProductTile
            key={producto.id}
            producto={producto}
            precioDe={precioDe}
            cantidadDe={cantidadDe}
            onCantidad={(unidad, nueva) => cambiarCantidad(producto, unidad, nueva)}
          />
        ))}
      </div>

      {/* En el teléfono el pedido vive en la hoja de abajo; en escritorio, en la
          columna lateral que dibuja el FieldShell. Las dos leen el mismo estado,
          así que nunca muestran totales distintos. */}
      <OrderCartSheet {...pedido} />
    </FieldShell>
  )
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
        activo
          ? 'bg-ink text-parchment'
          : 'border border-line bg-surface text-ink-soft hover:border-brand/40 hover:bg-brand-soft/50'
      }`}
    >
      {children}
    </button>
  )
}
