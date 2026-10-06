import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { createPriceList, listPriceLists, updatePriceList } from '../api/catalog.ts'
import { ApiError } from '../api/http.ts'
import type { PriceList } from '../api/types.ts'
import { AddButton, ModuleHead, SearchBox } from '../ui/ListTools.tsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx'
import { Modal } from '../ui/Modal.tsx'
import { RecordSheet, RowMoves } from '../ui/RecordSheet.tsx'
import { Alert, QueryStatus } from '../ui/Status.tsx'
import { useToast } from '../ui/Toast.tsx'

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
  const [base, setBase] = useState({ nombre: '', descripcion: '' })
  const [aDeshabilitar, setADeshabilitar] = useState<PriceList | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const avisos = useToast()

  function abrirNuevo() {
    setEditando(null)
    setNombre('')
    setDescripcion('')
    setBase({ nombre: '', descripcion: '' })
    setFormError(null)
    setFormulario(true)
  }

  function abrirEdicion(list: PriceList) {
    setEditando(list)
    setNombre(list.nombre)
    setDescripcion(list.descripcion ?? '')
    setBase({ nombre: list.nombre, descripcion: list.descripcion ?? '' })
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
      const eraEdicion = editando !== null
      setFormulario(false)
      setEditando(null)
      avisos.ok(eraEdicion ? 'Lista actualizada' : 'Lista agregada')
      await queryClient.invalidateQueries({ queryKey: ['price-lists'] })
    },
    onError: (err) => {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo guardar la lista'
      setFormError(mensaje)
      avisos.error(mensaje)
    },
  })

  const disableMutation = useMutation({
    mutationFn: (list: PriceList) =>
      updatePriceList(list.id, { nombre: list.nombre, descripcion: list.descripcion, activo: false }),
    onSuccess: async () => {
      setVisto(null)
      setADeshabilitar(null)
      avisos.ok('Lista deshabilitada')
      await queryClient.invalidateQueries({ queryKey: ['price-lists'] })
    },
    onError: (err) => {
      avisos.error(err instanceof ApiError ? err.message : 'No se pudo deshabilitar la lista')
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
        action={<AddButton onOpen={abrirNuevo}>Agregar lista</AddButton>}
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
        <Modal
          title={editando ? 'Editar lista' : 'Agregar lista'}
          formId="lista-form"
          saving={saveMutation.isPending}
          dirty={nombre !== base.nombre || descripcion !== base.descripcion}
          onClose={() => setFormulario(false)}
        >
        <form id="lista-form" onSubmit={onSubmit} className="space-y-3">
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nombre</span>
            <input value={nombre} onChange={(event) => setNombre(event.target.value)} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Descripción</span>
            <input value={descripcion} onChange={(event) => setDescripcion(event.target.value)} />
          </label>
        </form>
        </Modal>
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
                        onDisable={list.activo ? () => setADeshabilitar(list) : undefined}
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
      {aDeshabilitar ? (
        <ConfirmDialog
          title="Deshabilitar lista"
          confirmLabel="Deshabilitar"
          pending={disableMutation.isPending}
          onClose={() => setADeshabilitar(null)}
          onConfirm={() => disableMutation.mutate(aDeshabilitar)}
        >
          {aDeshabilitar.nombre} deja de usarse. No se borra.
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
