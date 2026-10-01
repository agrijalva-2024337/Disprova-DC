import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { getCatalog, isPublicStoreError, type PublicCatalog } from '../api/publicStore.ts'
import { theme } from '../theme.ts'
import { BrandIntro } from './BrandIntro.tsx'
import { CartBar } from './CartBar.tsx'
import { ProductCard } from './ProductCard.tsx'
import styles from './catalog.module.css'

const INTRO_CLAVE = 'disprova-intro-visto'

function saltarIntro() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return true
  }
  return window.sessionStorage.getItem(INTRO_CLAVE) === '1'
}

const storeVars = {
  '--store-bg': theme.bg,
  '--store-surface': theme.surface,
  '--store-border': theme.border,
  '--store-text': theme.text,
  '--store-ink': theme.text,
  '--store-muted': theme.textMuted,
  '--store-accent': theme.accent,
} as CSSProperties

function CatalogSkeleton() {
  return (
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className={styles.card}>
          <div className={styles.skel} />
          <div className={styles.skelWide} />
          <div className={styles.skel} />
        </div>
      ))}
    </div>
  )
}

const PORTADAS: Record<string, { imagen: string; titulo?: string; detalle: string }> = {
  medicamentos: { imagen: '/catalogo/farmacia.jpg', titulo: 'Farmacia', detalle: 'Medicamentos de mostrador' },
  farmacia: { imagen: '/catalogo/farmacia.jpg', detalle: 'Medicamentos de mostrador' },
  'higiene personal': { imagen: '/catalogo/higiene.jpg', detalle: 'Cuidado de todos los días' },
  bebidas: { imagen: '/catalogo/bebidas.jpg', detalle: 'Para la tienda y el camino' },
  abarrotes: { imagen: '/catalogo/abarrotes.jpg', detalle: 'Despensa de todos los días' },
  'comida oriental': { imagen: '/catalogo/oriental.jpg', detalle: 'Salsas, fideos y despensa' },
}

function portadaDe(nombre: string) {
  return (
    PORTADAS[nombre.trim().toLowerCase()] ?? {
      imagen: '/catalogo/abarrotes.jpg',
      detalle: 'Productos de esta sección',
    }
  )
}

function Catalogo({ token, catalog }: { token: string; catalog: PublicCatalog }) {
  const [busqueda, setBusqueda] = useState('')
  const [categoriaId, setCategoriaId] = useState<number | null>(null)
  const termino = busqueda.trim().toLowerCase()

  const productosVisibles = useMemo(() => {
    return catalog.productos.filter((producto) => {
      const enCategoria = categoriaId === null || producto.categoryId === categoriaId
      const coincide =
        termino.length === 0 ||
        producto.nombre.toLowerCase().includes(termino) ||
        producto.sku.toLowerCase().includes(termino)
      return enCategoria && coincide
    })
  }, [catalog.productos, categoriaId, termino])

  const secciones = catalog.categorias.filter((categoria) =>
    catalog.productos.some((producto) => producto.categoryId === categoria.id),
  )
  const mostrarProductos = categoriaId !== null || termino.length > 0

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={`${styles.brand} font-display`}>Disprova GyG</h1>
          <div className={styles.rule} aria-hidden="true" />
          <p className={`${styles.clientName} font-body`}>{catalog.cliente.nombreComercial}</p>
        </div>
        <input
          className={`${styles.search} font-body`}
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por nombre o SKU"
          aria-label="Buscar productos"
        />
      </header>
      <div className={styles.sectionHead}>
        <h2 className={`${styles.sectionTitle} font-display`}>Elige una sección</h2>
        {categoriaId !== null ? (
          <button type="button" className={`${styles.sectionReset} font-body`} onClick={() => setCategoriaId(null)}>
            Ver secciones
          </button>
        ) : null}
      </div>
      <div className={categoriaId === null ? styles.sections : styles.sectionsCompact}>
        {secciones.map((categoria) => {
          const portada = portadaDe(categoria.nombre)
          const activa = categoriaId === categoria.id
          return (
            <button
              key={categoria.id}
              type="button"
              className={`${styles.section} ${activa ? styles.sectionActive : ''}`}
              onClick={() => setCategoriaId(activa ? null : categoria.id)}
            >
              <img className={styles.sectionImg} src={portada.imagen} alt="" />
              <span className={styles.sectionCopy}>
                <span className={`${styles.sectionName} font-display`}>{portada.titulo ?? categoria.nombre}</span>
                <span className={`${styles.sectionHint} font-body`}>{portada.detalle}</span>
              </span>
            </button>
          )
        })}
      </div>
      {mostrarProductos && productosVisibles.length === 0 ? (
        <p className={`${styles.elige} font-body`}>No hay productos con esa búsqueda.</p>
      ) : null}
      {mostrarProductos && productosVisibles.length > 0 ? (
        <div className={styles.grid}>
          {productosVisibles.map((producto) => (
            <ProductCard key={producto.id} producto={producto} />
          ))}
        </div>
      ) : null}
      {!mostrarProductos ? (
        <p className={`${styles.elige} font-body`}>Toca una sección para ver sus productos y precios.</p>
      ) : null}
      <CartBar token={token} catalog={catalog} />
    </div>
  )
}

function CatalogScreen() {
  const { token } = useParams()
  const [verIntro, setVerIntro] = useState(() => !saltarIntro())
  const catalogQuery = useQuery({
    queryKey: ['public-catalog', token],
    queryFn: () => getCatalog(token ?? ''),
    enabled: Boolean(token),
  })

  const enlaceInvalido =
    isPublicStoreError(catalogQuery.error) &&
    (catalogQuery.error.code === 'PUBLIC_TOKEN_EXPIRED' ||
      catalogQuery.error.code === 'PUBLIC_TOKEN_INVALID')

  return (
    <main className={`${styles.page} font-body`} style={storeVars}>
      <div className="min-h-screen w-full">
        {catalogQuery.isPending ? <CatalogSkeleton /> : null}
        {enlaceInvalido ? (
          <div className="flex min-h-screen items-center px-6 text-center">
            <p className="text-lg font-display" style={{ color: theme.text }}>
              Este enlace ya no es válido, pide uno nuevo a tu vendedor
            </p>
          </div>
        ) : null}
        {catalogQuery.isError && !enlaceInvalido ? (
          <div className="flex min-h-screen items-center px-6 text-center">
            <p className="text-lg font-display" style={{ color: theme.text }}>
              No se pudo abrir el catálogo.
            </p>
          </div>
        ) : null}
        {catalogQuery.data && token ? <Catalogo token={token} catalog={catalogQuery.data} /> : null}
      </div>
      {verIntro ? (
        <BrandIntro
          onFinish={() => {
            window.sessionStorage.setItem(INTRO_CLAVE, '1')
            setVerIntro(false)
          }}
        />
      ) : null}
    </main>
  )
}

export function CatalogPage() {
  return <CatalogScreen />
}
