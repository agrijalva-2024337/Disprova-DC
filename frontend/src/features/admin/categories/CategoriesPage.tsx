import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { createCategory, listCategories } from '../api/catalog.ts'
import { ApiError } from '../api/http.ts'
import { Alert, QueryStatus } from '../ui/Status.tsx'

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
  })
  const [nombre, setNombre] = useState('')
  const [parentId, setParentId] = useState('')
  const [orden, setOrden] = useState('0')
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      setNombre('')
      setParentId('')
      setOrden('0')
      setFormError(null)
      setFormSuccess('Categoría creada')
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (err) => {
      setFormSuccess(null)
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la categoría')
    },
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    setFormSuccess(null)
    createMutation.mutate({
      nombre: nombre.trim(),
      parentId: parentId ? Number(parentId) : null,
      orden: Number(orden) || 0,
      activo: true,
    })
  }

  const categories = categoriesQuery.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Categorías</h1>
        <p className="text-sm text-slate-600">Organiza el catálogo por familia de producto.</p>
      </div>

      <form onSubmit={onSubmit} className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Nueva categoría</h2>
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        {formSuccess ? <Alert tone="success">{formSuccess}</Alert> : null}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nombre</span>
          <input
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Categoría padre (opcional)</span>
          <select
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Ninguna</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Orden</span>
          <input
            type="number"
            value={orden}
            onChange={(event) => setOrden(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {createMutation.isPending ? 'Guardando…' : 'Crear categoría'}
        </button>
      </form>

      <QueryStatus
        isLoading={categoriesQuery.isLoading}
        errorMessage={
          categoriesQuery.isError
            ? categoriesQuery.error instanceof ApiError
              ? categoriesQuery.error.message
              : 'No se pudieron cargar las categorías'
            : null
        }
      />

      {categories.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Padre</th>
                <th className="px-3 py-2 font-medium">Orden</th>
                <th className="px-3 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const parent = categories.find((item) => item.id === category.parentId)
                return (
                  <tr key={category.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{category.nombre}</td>
                    <td className="px-3 py-2">{parent?.nombre ?? '—'}</td>
                    <td className="px-3 py-2">{category.orden}</td>
                    <td className="px-3 py-2">{category.activo ? 'Activa' : 'Inactiva'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
