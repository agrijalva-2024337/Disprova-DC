import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { getCatalog, isPublicStoreError, type PublicCatalog } from '../api/publicStore.ts'
import { useCart } from '../cart/CartContext.tsx'
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

function Catalogo({ token, catalog }: { token: string; catalog: PublicCatalog }) {
  const { totalItems } = useCart()
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

  return (
    <div className={totalItems > 0 ? 'pb-24' : undefined}>
      <header className={styles.header}>
        <h1 className={`${styles.brand} font-display`}>Disprova GyG</h1>
        <div className={styles.rule} aria-hidden="true" />
        <p className={`${styles.clientName} font-body`}>{catalog.cliente.nombreComercial}</p>
        <input
          className={`${styles.search} font-body`}
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por nombre o SKU"
          aria-label="Buscar productos"
        />
      </header>
      <div className={styles.chips}>
        <button
          type="button"
          className={`${styles.chip} ${categoriaId === null ? styles.chipActive : ''} font-body`}
          onClick={() => setCategoriaId(null)}
        >
          Todos
        </button>
        {catalog.categorias.map((categoria) => (
          <button
            key={categoria.id}
            type="button"
            className={`${styles.chip} ${categoriaId === categoria.id ? styles.chipActive : ''} font-body`}
            onClick={() => setCategoriaId(categoria.id)}
          >
            {categoria.nombre}
          </button>
        ))}
      </div>
      {productosVisibles.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm font-body" style={{ color: theme.textMuted }}>
          No hay productos con esa búsqueda.
        </p>
      ) : (
        <div className={styles.grid}>
          {productosVisibles.map((producto) => (
            <ProductCard key={producto.id} producto={producto} />
          ))}
        </div>
      )}
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
      <div className="mx-auto min-h-screen w-full max-w-md">
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
