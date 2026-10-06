import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProduct, listCategories } from '../api/catalog.ts'
import { ApiError } from '../api/http.ts'
import { Modal } from '../ui/Modal.tsx'
import { Alert, QueryStatus } from '../ui/Status.tsx'
import { useToast } from '../ui/Toast.tsx'
import { ProductForm } from './ProductFormPage.tsx'

export function ProductDetailPage() {
  const { id } = useParams()
  const productId = Number(id)
  const [editando, setEditando] = useState(false)
  const [sucio, setSucio] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const avisos = useToast()

  const productQuery = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProduct(productId),
    enabled: Number.isFinite(productId),
  })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories })
  const categoria = categoriesQuery.data?.find((item) => item.id === productQuery.data?.categoryId)

  if (!Number.isFinite(productId)) {
    return <Alert tone="error">El producto no existe.</Alert>
  }

  if (productQuery.isLoading) {
    return <QueryStatus isLoading loadingText="Cargando producto…" />
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <Alert tone="error">
        {productQuery.error instanceof ApiError ? productQuery.error.message : 'No se pudo cargar el producto'}
      </Alert>
    )
  }

  const product = productQuery.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/productos" className="text-sm text-slate-600 underline">
            Volver a productos
          </Link>
          <h1 className="mt-2 text-xl font-semibold">{product.nombre}</h1>
          <p className="text-sm text-slate-600">{product.sku}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="min-h-11 rounded-full bg-slate-900 px-5 text-sm font-medium text-white"
        >
          Editar producto
        </button>
      </div>

      <dl className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Categoría</dt>
          <dd>{categoria?.nombre ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Marca</dt>
          <dd>{product.marca || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Unidad base</dt>
          <dd>{product.unidadBase}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Estado</dt>
          <dd>{product.activo ? 'Activo' : 'Inactivo'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Presentaciones</dt>
          <dd>{product.units.map((unit) => `${unit.nombre} (×${unit.factor})`).join(', ') || '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Descripción</dt>
          <dd>{product.descripcion || '—'}</dd>
        </div>
      </dl>

      {editando ? (
        <Modal
          title="Editar producto"
          size="lg"
          formId="producto-detalle-form"
          dirty={sucio}
          saving={guardando}
          onClose={() => setEditando(false)}
        >
          <ProductForm
            id={product.id}
            formId="producto-detalle-form"
            onDirtyChange={setSucio}
            onSavingChange={setGuardando}
            onDone={() => {
              setEditando(false)
              avisos.ok('Producto actualizado')
            }}
          />
        </Modal>
      ) : null}
    </div>
  )
}
