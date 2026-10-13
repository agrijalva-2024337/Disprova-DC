import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { createCategory, listCategories, updateCategory } from '../api/catalog.ts'
import type { Category } from '../api/types.ts'
import { ApiError } from '../api/http.ts'
import { AddButton, ModuleHead, SearchBox } from '../ui/ListTools.tsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx'
import { Modal } from '../ui/Modal.tsx'
import { Alert, QueryStatus } from '../ui/Status.tsx'
import { RecordSheet, RowMoves } from '../ui/RecordSheet.tsx'
import { useToast } from '../ui/Toast.tsx'

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
  })
  const [nombre, setNombre] = useState('')
  const [orden, setOrden] = useState('0')
  const [formError, setFormError] = useState<string | null>(null)
  const [visto, setVisto] = useState<Category | null>(null)
  const [formulario, setFormulario] = useState(false)
  const [editando, setEditando] = useState<Category | null>(null)
  const [base, setBase] = useState({ nombre: '', orden: '0' })
  const [aDeshabilitar, setADeshabilitar] = useState<Category | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const avisos = useToast()

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      setNombre('')
      setOrden('0')
      setFormError(null)
      setFormulario(false)
      setEditando(null)
      avisos.ok('Categoría agregada')
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (err) => {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo crear la categoría'
      setFormError(mensaje)
      avisos.error(mensaje)
    },
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    const input = {
      nombre: nombre.trim(),
      orden: Number(orden) || 0,
      activo: true,
    }
    if (editando) {
      updateCategory(editando.id, input)
        .then(async () => {
          setFormulario(false)
          setEditando(null)
          setNombre('')
          avisos.ok('Categoría actualizada')
          await queryClient.invalidateQueries({ queryKey: ['categories'] })
        })
        .catch((err) => {
          const mensaje = err instanceof ApiError ? err.message : 'No se pudo guardar la categoría'
          setFormError(mensaje)
          avisos.error(mensaje)
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

  function abrirNueva() {
    const vacio = { nombre: '', orden: '0' }
    setEditando(null)
    setNombre(vacio.nombre)
    setOrden(vacio.orden)
    setBase(vacio)
    setFormError(null)
    setFormulario(true)
  }

  function editar(category: Category) {
    const valores = {
      nombre: category.nombre,
      orden: String(category.orden),
    }
    setEditando(category)
    setNombre(valores.nombre)
    setOrden(valores.orden)
    setBase(valores)
    setFormError(null)
    setFormulario(true)
    setVisto(null)
  }

  return (
    <div className="space-y-6">
      <ModuleHead
        title="Categorías"
        text="Organiza el catálogo por familia de producto."
        action={
          <AddButton onOpen={abrirNueva}>Agregar categoría</AddButton>
        }
      />
      <SearchBox value={busqueda} onChange={setBusqueda} placeholder="Buscar categoría" />

      {formulario ? (
      <Modal
        title={editando ? 'Editar categoría' : 'Agregar categoría'}
        formId="categoria-form"
        dirty={nombre !== base.nombre || orden !== base.orden}
        saving={createMutation.isPending}
        onClose={() => {
          setFormulario(false)
          setEditando(null)
        }}
      >
      <form id="categoria-form" onSubmit={onSubmit} className="space-y-3">
        {formError ? <Alert tone="error">{formError}</Alert> : null}
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
          <span className="mb-1 block font-medium">Orden</span>
          <input
            type="number"
            value={orden}
            onChange={(event) => setOrden(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </form>
      </Modal>
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
                <th className="px-3 py-2 font-medium">Orden</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((category) => {
                return (
                  <tr
                    key={category.id}
                    className="cursor-pointer border-t border-slate-100"
                    onDoubleClick={() => setVisto(category)}
                  >
                    <td className="px-3 py-2">{category.nombre}</td>
                    <td className="px-3 py-2">{category.orden}</td>
                    <td className="px-3 py-2">{category.activo ? 'Activa' : 'Inactiva'}</td>
                    <td className="px-3 py-2">
                      <RowMoves
                        onView={() => setVisto(category)}
                        onEdit={() => editar(category)}
                        onDisable={category.activo ? () => setADeshabilitar(category) : undefined}
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
      {aDeshabilitar ? (
        <ConfirmDialog
          title="Deshabilitar categoría"
          confirmLabel="Deshabilitar"
          onClose={() => setADeshabilitar(null)}
          onConfirm={() => {
            const category = aDeshabilitar
            updateCategory(category.id, {
              nombre: category.nombre,
              orden: category.orden,
              activo: false,
            })
              .then(async () => {
                setADeshabilitar(null)
                avisos.ok('Categoría deshabilitada')
                await queryClient.invalidateQueries({ queryKey: ['categories'] })
              })
              .catch((err) => {
                avisos.error(err instanceof ApiError ? err.message : 'No se pudo deshabilitar la categoría')
              })
          }}
        >
          {aDeshabilitar.nombre} deja de usarse en el catálogo. No se borra.
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
