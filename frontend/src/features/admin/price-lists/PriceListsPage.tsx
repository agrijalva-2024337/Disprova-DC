import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { createPriceList, listPriceLists } from '../api/catalog.ts'
import { ApiError } from '../api/http.ts'
import { Alert, QueryStatus } from '../ui/Status.tsx'

export function PriceListsPage() {
  const queryClient = useQueryClient()
  const listsQuery = useQuery({
    queryKey: ['price-lists'],
    queryFn: listPriceLists,
  })
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: createPriceList,
    onSuccess: async () => {
      setNombre('')
      setDescripcion('')
      setFormError(null)
      setFormSuccess('Lista de precios creada')
      await queryClient.invalidateQueries({ queryKey: ['price-lists'] })
    },
    onError: (err) => {
      setFormSuccess(null)
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la lista')
    },
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    createMutation.mutate({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      activo: true,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Listas de precio</h1>
        <p className="text-sm text-slate-600">Listas vigentes para mostrador y ruta.</p>
      </div>

      <form onSubmit={onSubmit} className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Nueva lista</h2>
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
          <span className="mb-1 block font-medium">Descripción</span>
          <input
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {createMutation.isPending ? 'Guardando…' : 'Crear lista'}
        </button>
      </form>

      <QueryStatus
        isLoading={listsQuery.isLoading}
        errorMessage={
          listsQuery.isError
            ? listsQuery.error instanceof ApiError
              ? listsQuery.error.message
              : 'No se pudieron cargar las listas'
            : null
        }
      />

      {(listsQuery.data ?? []).length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Descripción</th>
                <th className="px-3 py-2 font-medium">Ítems</th>
                <th className="px-3 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(listsQuery.data ?? []).map((list) => (
                <tr key={list.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{list.nombre}</td>
                  <td className="px-3 py-2">{list.descripcion ?? '—'}</td>
                  <td className="px-3 py-2">{list.items?.length ?? 0}</td>
                  <td className="px-3 py-2">{list.activo ? 'Activa' : 'Inactiva'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
