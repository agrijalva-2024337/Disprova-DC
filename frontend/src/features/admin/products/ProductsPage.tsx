import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCategories, listProducts, updateProduct } from '../api/catalog.ts'
import type { Product } from '../api/types.ts'
import { ApiError } from '../api/http.ts'
import { AddButton } from '../ui/ListTools.tsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx'
import { Modal } from '../ui/Modal.tsx'
import { Alert, QueryStatus } from '../ui/Status.tsx'
import { RecordSheet, RowMoves } from '../ui/RecordSheet.tsx'
import { useToast } from '../ui/Toast.tsx'
import { ProductForm } from './ProductFormPage.tsx'

const PAGE_SIZE = 10

export function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [visto, setVisto] = useState<Product | null>(null)
  const [formulario, setFormulario] = useState<number | 'nuevo' | null>(null)
  const [sucio, setSucio] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const avisos = useToast()

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: listProducts,
  })
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
  })

  const deactivateMutation = useMutation({
    mutationFn: (productId: number) => updateProduct(productId, { activo: false }),
    onSuccess: async () => {
      setPendingId(null)
      setActionError(null)
      avisos.ok('Producto desactivado')
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (err) => {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo desactivar el producto'
      setActionError(mensaje)
      avisos.error(mensaje)
    },
  })

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const category of categoriesQuery.data ?? []) {
      map.set(category.id, category.nombre)
    }
    return map
  }, [categoriesQuery.data])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const products = productsQuery.data ?? []
    if (!term) {
      return products
    }
    return products.filter(
      (product) =>
        product.nombre.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term),
    )
  }, [productsQuery.data, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pendingProduct = productsQuery.data?.find((item) => item.id === pendingId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Productos</h1>
          <p className="text-sm text-slate-600">Catálogo con presentaciones y precios base.</p>
        </div>
        <AddButton
          onOpen={() => {
            setSucio(false)
            setFormulario('nuevo')
          }}
        >
          Agregar producto
        </AddButton>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Buscar por SKU o nombre"
          className="w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="text-sm text-slate-500">{filtered.length} resultados</p>
      </div>

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <QueryStatus
        isLoading={productsQuery.isLoading}
        errorMessage={
          productsQuery.isError
            ? productsQuery.error instanceof ApiError
              ? productsQuery.error.message
              : 'No se pudieron cargar los productos'
            : null
        }
      />

      {!productsQuery.isLoading && !productsQuery.isError ? (
        <div className="registros">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Categoría</th>
                <th className="px-3 py-2 font-medium">Presentaciones</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No hay productos para mostrar.
                  </td>
                </tr>
              ) : (
                pageItems.map((product) => (
                  <tr
                    key={product.id}
                    className="cursor-pointer border-t border-slate-100"
                    onDoubleClick={() => setVisto(product)}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{product.sku}</td>
                    <td className="px-3 py-2">{product.nombre}</td>
                    <td className="px-3 py-2">{categoryNameById.get(product.categoryId) ?? '—'}</td>
                    <td className="px-3 py-2">{product.units.length}</td>
                    <td className="px-3 py-2">{product.activo ? 'Activo' : 'Inactivo'}</td>
                    <td className="px-3 py-2">
                      <RowMoves
                        onView={() => setVisto(product)}
                        onEdit={() => {
                          setSucio(false)
                          setFormulario(product.id)
                          setVisto(null)
                        }}
                        onDisable={product.activo ? () => setPendingId(product.id) : undefined}
                        disableLabel="Desactivar"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {filtered.length > PAGE_SIZE ? (
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      ) : null}

      {visto ? (
        <RecordSheet title={visto.nombre} onClose={() => setVisto(null)}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">SKU</dt>
              <dd>{visto.sku}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Categoría</dt>
              <dd>{categoryNameById.get(visto.categoryId) ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Presentaciones</dt>
              <dd>{visto.units.map((unit) => unit.nombre).join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Estado</dt>
              <dd>{visto.activo ? 'Activo' : 'Inactivo'}</dd>
            </div>
          </dl>
          <Link to={`/admin/productos/${visto.id}`} className="mt-4 inline-block text-sm text-slate-600 underline">
            Ver ficha
          </Link>
          <button
            type="button"
            onClick={() => {
              setSucio(false)
              setFormulario(visto.id)
              setVisto(null)
            }}
            className="mt-4 ml-3 rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
          >
            Editar producto
          </button>
        </RecordSheet>
      ) : null}

      {pendingProduct ? (
        <ConfirmDialog
          title="Desactivar producto"
          confirmLabel="Desactivar"
          pending={deactivateMutation.isPending}
          onClose={() => setPendingId(null)}
          onConfirm={() => deactivateMutation.mutate(pendingProduct.id)}
        >
          ¿Confirmas desactivar {pendingProduct.nombre} ({pendingProduct.sku})? Dejará de aparecer
          como disponible en el catálogo activo.
        </ConfirmDialog>
      ) : null}

      {formulario !== null ? (
        <Modal
          title={formulario === 'nuevo' ? 'Agregar producto' : 'Editar producto'}
          size="lg"
          formId="producto-form"
          dirty={sucio}
          saving={guardando}
          onClose={() => setFormulario(null)}
        >
          <ProductForm
            key={formulario}
            id={formulario === 'nuevo' ? undefined : formulario}
            formId="producto-form"
            onDirtyChange={setSucio}
            onSavingChange={setGuardando}
            onDone={() => {
              const eraNuevo = formulario === 'nuevo'
              setFormulario(null)
              avisos.ok(eraNuevo ? 'Producto agregado' : 'Producto actualizado')
            }}
          />
        </Modal>
      ) : null}
    </div>
  )
}
