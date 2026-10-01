import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { createCategory, listCategories, updateCategory } from '../api/catalog.ts'
import type { Category } from '../api/types.ts'
import { ApiError } from '../api/http.ts'
import { AddButton, ModuleHead, SearchBox } from '../ui/ListTools.tsx'
import { Alert, QueryStatus } from '../ui/Status.tsx'
import { RecordSheet, RowMoves } from '../ui/RecordSheet.tsx'

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
  const [visto, setVisto] = useState<Category | null>(null)
  const [formulario, setFormulario] = useState(false)
  const [editando, setEditando] = useState<Category | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      setNombre('')
      setParentId('')
      setOrden('0')
      setFormError(null)
      setFormulario(false)
      setEditando(null)
      setFormSuccess(editando ? 'Categoría actualizada' : 'Categoría creada')
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
    const input = {
      nombre: nombre.trim(),
      parentId: parentId ? Number(parentId) : null,
      orden: Number(orden) || 0,
      activo: true,
    }
    if (editando) {
      updateCategory(editando.id, input)
        .then(async () => {
          setFormulario(false)
          setEditando(null)
          setNombre('')
          await queryClient.invalidateQueries({ queryKey: ['categories'] })
        })
        .catch((err) => {
          setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la categoría')
        })
      return
    }
    createMutation.mutate(input)
  }

  const categories = categoriesQuery.data ?? []
  const termino = busqueda.trim().toLowerCase()
  const visibles = categories.filter((category) =>
    termino ? category.nombre.toLowerCase().includes(termino) : true,
  )

  function editar(category: Category) {
    setEditando(category)
    setNombre(category.nombre)
    setParentId(category.parentId ? String(category.parentId) : '')
    setOrden(String(category.orden))
    setFormulario(true)
    setVisto(null)
  }

  return (
    <div className="space-y-6">
      <ModuleHead
        title="Categorías"
        text="Organiza el catálogo por familia de producto."
        action={
          <AddButton
            onClick={() => {
              setEditando(null)
              setNombre('')
              setParentId('')
              setOrden('0')
              setFormulario(true)
            }}
          >
            Agregar categoría
          </AddButton>
        }
      />
      <SearchBox value={busqueda} onChange={setBusqueda} placeholder="Buscar categoría" />

      {formulario ? (
      <form onSubmit={onSubmit} className="ficha max-w-xl space-y-3">
        <h2 className="font-display text-xl">{editando ? `Editar ${editando.nombre}` : 'Nueva categoría'}</h2>
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
          {createMutation.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={() => setFormulario(false)} className="ml-2 min-h-11 rounded-full border border-slate-300 px-4 text-sm">
          Cancelar
        </button>
      </form>
      ) : null}

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

      {!categoriesQuery.isLoading && !categoriesQuery.isError ? (
        <div className="registros">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Padre</th>
                <th className="px-3 py-2 font-medium">Orden</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((category) => {
                const parent = categories.find((item) => item.id === category.parentId)
                return (
                  <tr
                    key={category.id}
                    className="cursor-pointer border-t border-slate-100"
                    onDoubleClick={() => setVisto(category)}
                  >
                    <td className="px-3 py-2">{category.nombre}</td>
                    <td className="px-3 py-2">{parent?.nombre ?? '—'}</td>
                    <td className="px-3 py-2">{category.orden}</td>
                    <td className="px-3 py-2">{category.activo ? 'Activa' : 'Inactiva'}</td>
                    <td className="px-3 py-2">
                      <RowMoves
                        onView={() => setVisto(category)}
                        onEdit={() => editar(category)}
                        onDisable={
                          category.activo
                            ? () =>
                                updateCategory(category.id, {
                                  nombre: category.nombre,
                                  parentId: category.parentId,
                                  orden: category.orden,
                                  activo: false,
                                }).then(() => queryClient.invalidateQueries({ queryKey: ['categories'] }))
                            : undefined
                        }
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {visto ? (
        <RecordSheet title={visto.nombre} onClose={() => setVisto(null)}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Orden</dt>
              <dd>{visto.orden}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Estado</dt>
              <dd>{visto.activo ? 'Activa' : 'Inactiva'}</dd>
            </div>
          </dl>
        </RecordSheet>
      ) : null}
    </div>
  )
}
