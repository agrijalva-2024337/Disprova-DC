import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCategories, listProducts, updateProduct } from '../api/catalog.ts'
import { ApiError } from '../api/http.ts'
import { Alert, QueryStatus } from '../ui/Status.tsx'

const PAGE_SIZE = 10

export function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo desactivar el producto')
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
        <Link
          to="/admin/productos/nuevo"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Nuevo producto
        </Link>
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
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
                  <tr key={product.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{product.sku}</td>
                    <td className="px-3 py-2">{product.nombre}</td>
                    <td className="px-3 py-2">{categoryNameById.get(product.categoryId) ?? '—'}</td>
                    <td className="px-3 py-2">{product.units.length}</td>
                    <td className="px-3 py-2">{product.activo ? 'Activo' : 'Inactivo'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/admin/productos/${product.id}`}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Editar
                        </Link>
                        {product.activo ? (
                          <button
                            type="button"
                            onClick={() => setPendingId(product.id)}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            Desactivar
                          </button>
                        ) : null}
                      </div>
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

      {pendingProduct ? (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-lg">
            <h2 className="text-base font-semibold">Desactivar producto</h2>
            <p className="text-sm text-slate-600">
              ¿Confirmas desactivar <strong>{pendingProduct.nombre}</strong> ({pendingProduct.sku})?
              Dejará de aparecer como disponible en el catálogo activo.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingId(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deactivateMutation.isPending}
                onClick={() => deactivateMutation.mutate(pendingProduct.id)}
                className="rounded bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-800 disabled:opacity-60"
              >
                {deactivateMutation.isPending ? 'Desactivando…' : 'Desactivar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
