import { useQuery } from '@tanstack/react-query'
import { useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createOrder,
  getCatalog,
  isPublicStoreError,
  type PublicCatalog,
} from '../api/publicStore.ts'
import { useCart } from '../cart/CartContext.tsx'
import catalogStyles from '../catalog/catalog.module.css'
import { theme } from '../theme.ts'
import styles from './checkout.module.css'

const storeVars = {
  '--store-bg': theme.bg,
  '--store-surface': theme.surface,
  '--store-border': theme.border,
  '--store-text': theme.text,
  '--store-muted': theme.textMuted,
  '--store-accent': theme.accent,
  '--store-accent-soft': theme.accentSoft,
} as CSSProperties

type Linea = {
  productUnitId: number
  nombre: string
  presentacion: string
  cantidad: number
  precio: string | null
}

function money(value: number) {
  return Math.round(value * 100) / 100
}

function quetzales(value: number) {
  return `Q ${value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function lineasDelCarrito(catalog: PublicCatalog, cantidades: Record<number, number>): Linea[] {
  const porUnidad = new Map<number, { nombre: string; presentacion: string; precio: string | null }>()
  for (const producto of catalog.productos) {
    for (const unidad of producto.unidades) {
      porUnidad.set(unidad.id, {
        nombre: producto.nombre,
        presentacion: unidad.nombre,
        precio: unidad.precio,
      })
    }
  }

  return Object.entries(cantidades).map(([id, cantidad]) => {
    const productUnitId = Number(id)
    const dato = porUnidad.get(productUnitId)
    return {
      productUnitId,
      nombre: dato?.nombre ?? 'Producto',
      presentacion: dato?.presentacion ?? 'Presentación',
      cantidad,
      precio: dato?.precio ?? null,
    }
  })
}

/** El backend nombra la presentación que no tiene precio vigente. */
function lineasSinPrecio(message: string, lineas: Linea[]) {
  const marca = 'para la presentación '
  const desde = message.indexOf(marca)
  if (desde < 0) {
    return []
  }
  const presentacion = message.slice(desde + marca.length).trim()
  return lineas.filter((linea) => linea.presentacion === presentacion)
}

export function CheckoutPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { cantidades, add, setQty, remove, clear, subtotal } = useCart()
  const [pago, setPago] = useState<'contado' | 'credito'>('contado')
  // Existe antes del primer envío. Un doble tap y un reintento tras un corte
  // de red mandan la misma clave, así el backend no abre otro pedido.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [enviando, setEnviando] = useState(false)
  const [errorLinea, setErrorLinea] = useState<string | null>(null)
  const enCurso = useRef(false)

  const catalogQuery = useQuery({
    queryKey: ['public-catalog', token],
    queryFn: () => getCatalog(token ?? ''),
    enabled: Boolean(token),
  })

  const catalog = catalogQuery.data
  const lineas = catalog ? lineasDelCarrito(catalog, cantidades) : []

  async function confirmar() {
    if (!token || !catalog || lineas.length === 0 || enCurso.current) {
      return
    }
    enCurso.current = true
    setEnviando(true)
    setErrorLinea(null)
    try {
      const pedido = await createOrder(token, {
        condicionPago: pago,
        idempotencyKey,
        items: lineas.map((linea) => ({
          productUnitId: linea.productUnitId,
          cantidad: linea.cantidad,
        })),
      })
      clear()
      navigate(`/catalogo/${token}/confirmacion`, { state: { numero: pedido.numero } })
    } catch (error) {
      if (isPublicStoreError(error) && error.code === 'NO_PRICE') {
        const fallidas = lineasSinPrecio(error.message, lineas)
        setErrorLinea(
          fallidas.length > 0
            ? `Sin precio vigente: ${fallidas.map((linea) => `${linea.nombre}, ${linea.presentacion}`).join('; ')}.`
            : 'Una presentación del pedido ya no tiene precio vigente.',
        )
      } else {
        setErrorLinea('No se pudo enviar el pedido. Puedes intentar de nuevo.')
      }
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }

  return (
    <main className={`${catalogStyles.page} font-body`} style={storeVars}>
      <div className="mx-auto min-h-screen w-full max-w-md">
        <header className={styles.header}>
          <h1 className={`${styles.title} font-display`}>Tu pedido</h1>
          {token ? (
            <Link className={styles.back} to={`/catalogo/${token}`}>
              Seguir comprando
            </Link>
          ) : null}
        </header>

        {catalogQuery.isPending ? (
          <p className={styles.empty}>Cargando el pedido…</p>
        ) : null}

        {catalog && lineas.length === 0 ? (
          <div className={styles.empty}>
            <p>Todavía no agregaste productos.</p>
            {token ? (
              <Link className={`${catalogStyles.addbtn} mt-4`} to={`/catalogo/${token}`}>
                Volver al catálogo
              </Link>
            ) : null}
          </div>
        ) : null}

        {catalog && lineas.length > 0 ? (
          <>
            <ul className={styles.list}>
              {lineas.map((linea) => {
                const total = linea.precio === null ? null : money(Number(linea.precio) * linea.cantidad)
                return (
                  <li key={linea.productUnitId} className={styles.line}>
                    <p className={styles.lineName}>{linea.nombre}</p>
                    <p className={styles.lineMeta}>
                      {linea.presentacion}
                      {linea.precio ? ` · ${quetzales(Number(linea.precio))}` : ' · Sin precio'}
                    </p>
                    <div className={styles.lineRow}>
                      <div className={styles.stepper}>
                        <button
                          type="button"
                          className={catalogStyles.qtybtn}
                          aria-label={`Quitar uno de ${linea.nombre}`}
                          onClick={() => setQty(linea.productUnitId, linea.cantidad - 1)}
                        >
                          −
                        </button>
                        <span className={catalogStyles.qty}>{linea.cantidad}</span>
                        <button
                          type="button"
                          className={catalogStyles.qtybtn}
                          aria-label={`Sumar uno de ${linea.nombre}`}
                          onClick={() => add(linea.productUnitId)}
                        >
                          +
                        </button>
                      </div>
                      <p className={`${styles.lineTotal} font-display`}>
                        {total === null ? 'Sin precio' : quetzales(total)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() => remove(linea.productUnitId)}
                    >
                      Quitar
                    </button>
                  </li>
                )
              })}
            </ul>

            <fieldset className={styles.pago}>
              <legend className={styles.pagoTitle}>¿Cómo vas a pagar?</legend>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="pago"
                  checked={pago === 'contado'}
                  onChange={() => setPago('contado')}
                />
                Pago al contado
              </label>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="pago"
                  checked={pago === 'credito'}
                  onChange={() => setPago('credito')}
                />
                Pago a crédito
              </label>
            </fieldset>

            <div className={styles.footer}>
              <div className={styles.total}>
                <span>Total</span>
                <span className="font-display">{quetzales(subtotal(catalog))}</span>
              </div>
              {errorLinea ? <p className={styles.error}>{errorLinea}</p> : null}
              <button
                type="button"
                className={`${catalogStyles.addbtn} w-full`}
                disabled={enviando}
                onClick={() => void confirmar()}
              >
                {enviando ? 'Enviando…' : 'Confirmar pedido'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  )
}
