import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { createPriceList, listPriceLists, updatePriceList } from '../api/catalog.ts'
import { ApiError } from '../api/http.ts'
import type { PriceList } from '../api/types.ts'
import { AddButton, ModuleHead, SearchBox } from '../ui/ListTools.tsx'
import { RecordSheet, RowMoves } from '../ui/RecordSheet.tsx'
import { Alert, QueryStatus } from '../ui/Status.tsx'

export function PriceListsPage() {
  const queryClient = useQueryClient()
  const listsQuery = useQuery({ queryKey: ['price-lists'], queryFn: listPriceLists })
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<'todas' | 'activas' | 'inactivas'>('todas')
  const [formulario, setFormulario] = useState(false)
  const [editando, setEditando] = useState<PriceList | null>(null)
  const [visto, setVisto] = useState<PriceList | null>(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  function abrirNuevo() {
    setEditando(null)
    setNombre('')
    setDescripcion('')
    setFormError(null)
    setFormulario(true)
  }

  function abrirEdicion(list: PriceList) {
    setEditando(list)
    setNombre(list.nombre)
    setDescripcion(list.descripcion ?? '')
    setFormError(null)
    setFormulario(true)
    setVisto(null)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const input = { nombre: nombre.trim(), descripcion: descripcion.trim() || null, activo: true }
      return editando ? updatePriceList(editando.id, input) : createPriceList(input)
    },
    onSuccess: async () => {
      setFormulario(false)
      setEditando(null)
      await queryClient.invalidateQueries({ queryKey: ['price-lists'] })
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la lista')
    },
  })

  const disableMutation = useMutation({
    mutationFn: (list: PriceList) =>
      updatePriceList(list.id, { nombre: list.nombre, descripcion: list.descripcion, activo: false }),
    onSuccess: async () => {
      setVisto(null)
      await queryClient.invalidateQueries({ queryKey: ['price-lists'] })
    },
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    saveMutation.mutate()
  }

  const filas = useMemo(() => {
    const term = busqueda.trim().toLowerCase()
    return (listsQuery.data ?? []).filter((list) => {
      if (estado === 'activas' && !list.activo) return false
      if (estado === 'inactivas' && list.activo) return false
      if (!term) return true
      return list.nombre.toLowerCase().includes(term) || (list.descripcion ?? '').toLowerCase().includes(term)
    })
  }, [listsQuery.data, busqueda, estado])

  return (
    <div className="space-y-6">
      <ModuleHead
        title="Listas de precio"
        text="Listas vigentes para mostrador y ruta."
        action={<AddButton onClick={abrirNuevo}>Agregar lista</AddButton>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre o descripción" />
        <select
          value={estado}
          onChange={(event) => setEstado(event.target.value as 'todas' | 'activas' | 'inactivas')}
          className="min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm"
        >
          <option value="todas">Todas</option>
          <option value="activas">Activas</option>
          <option value="inactivas">Inactivas</option>
        </select>
      </div>

      {formulario ? (
        <form onSubmit={onSubmit} className="ficha max-w-xl space-y-3">
          <h2 className="font-display text-xl">{editando ? `Editar ${editando.nombre}` : 'Nueva lista'}</h2>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nombre</span>
            <input value={nombre} onChange={(event) => setNombre(event.target.value)} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Descripción</span>
            <input value={descripcion} onChange={(event) => setDescripcion(event.target.value)} />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="min-h-11 rounded-full bg-slate-900 px-5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setFormulario(false)} className="min-h-11 rounded-full border border-slate-300 px-5 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

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

      {!listsQuery.isLoading && !listsQuery.isError ? (
        <div className="registros">
          <table>
            <thead>
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Ítems</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    No hay listas para mostrar.
                  </td>
                </tr>
              ) : (
                filas.map((list) => (
                  <tr key={list.id} className="cursor-pointer" onDoubleClick={() => setVisto(list)}>
                    <td className="px-3 py-2 font-medium">{list.nombre}</td>
                    <td className="px-3 py-2">{list.descripcion ?? '—'}</td>
                    <td className="px-3 py-2">{list.items?.length ?? 0}</td>
                    <td className="px-3 py-2">{list.activo ? 'Activa' : 'Inactiva'}</td>
                    <td className="px-3 py-2">
                      <RowMoves
                        onView={() => setVisto(list)}
                        onEdit={() => abrirEdicion(list)}
                        onDisable={list.activo ? () => disableMutation.mutate(list) : undefined}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {visto ? (
        <RecordSheet title={visto.nombre} onClose={() => setVisto(null)}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Descripción</dt>
              <dd>{visto.descripcion || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Ítems</dt>
              <dd>{visto.items?.length ?? 0}</dd>
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
