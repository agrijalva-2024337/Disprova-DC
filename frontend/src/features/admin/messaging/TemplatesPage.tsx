import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createTemplate, deactivateTemplate, listTemplates, updateTemplate } from '../api/messaging.ts'
import { ApiError } from '../api/http.ts'
import {
  ALLOWED_TEMPLATE_VARIABLES,
  type MessageCanal,
  type MessageTemplate,
  type MessageTemplateInput,
} from '../api/types.ts'
import { AddButton, ModuleHead, SearchBox } from '../ui/ListTools.tsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx'
import { Modal } from '../ui/Modal.tsx'
import { Alert, QueryStatus } from '../ui/Status.tsx'
import { useToast } from '../ui/Toast.tsx'

const variables = ALLOWED_TEMPLATE_VARIABLES.map((name) => `{${name}}`)
const variableRegex = /\{([A-Za-z0-9_]+)\}/g

/** Mismo criterio que `unknownVariables` del backend: avisa antes de mandar. */
function variablesDesconocidas(cuerpo: string) {
  const permitidas = ALLOWED_TEMPLATE_VARIABLES as readonly string[]
  const encontradas = new Set<string>()
  for (const match of cuerpo.matchAll(variableRegex)) {
    if (!permitidas.includes(match[1])) {
      encontradas.add(match[1])
    }
  }
  return [...encontradas]
}

const vacio: MessageTemplateInput = { nombre: '', canal: 'wa_link', cuerpo: '' }

export function TemplatesPage() {
  const queryClient = useQueryClient()
  const avisos = useToast()
  const [form, setForm] = useState<MessageTemplateInput>(vacio)
  const [base, setBase] = useState<MessageTemplateInput>(vacio)
  const [editando, setEditando] = useState<MessageTemplate | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [aDesactivar, setADesactivar] = useState<MessageTemplate | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const templatesQuery = useQuery({ queryKey: ['message-templates'], queryFn: listTemplates })

  const saveMutation = useMutation({
    mutationFn: (input: MessageTemplateInput) =>
      editando ? updateTemplate(editando.id, input) : createTemplate(input),
    onSuccess: async () => {
      const eraEdicion = editando !== null
      setForm(vacio)
      setBase(vacio)
      setEditando(null)
      setAbierto(false)
      avisos.ok(eraEdicion ? 'Plantilla actualizada' : 'Plantilla agregada')
      await queryClient.invalidateQueries({ queryKey: ['message-templates'] })
    },
    onError: (err) => {
      avisos.error(err instanceof ApiError ? err.message : 'No se pudo guardar la plantilla')
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateTemplate,
    onSuccess: async () => {
      setADesactivar(null)
      avisos.ok('Plantilla desactivada')
      await queryClient.invalidateQueries({ queryKey: ['message-templates'] })
    },
    onError: (err) => {
      avisos.error(err instanceof ApiError ? err.message : 'No se pudo desactivar la plantilla')
    },
  })

  const desconocidas = variablesDesconocidas(form.cuerpo)
  const puedeCrear =
    form.nombre.trim() !== '' && form.cuerpo.trim() !== '' && desconocidas.length === 0

  const errorGuardar = saveMutation.isError
    ? saveMutation.error instanceof ApiError
      ? saveMutation.error.message
      : 'No se pudo guardar la plantilla'
    : null

  function abrirNueva() {
    setEditando(null)
    setForm(vacio)
    setBase(vacio)
    setAbierto(true)
  }

  function abrirEdicion(template: MessageTemplate) {
    const valores = { nombre: template.nombre, canal: template.canal, cuerpo: template.cuerpo }
    setEditando(template)
    setForm(valores)
    setBase(valores)
    setAbierto(true)
  }

  return (
    <div className="space-y-6">
      <ModuleHead
        title="Plantillas"
        text="Los textos que se mandan por WhatsApp. El cuerpo solo puede usar las variables permitidas."
        action={<AddButton onOpen={abrirNueva}>Agregar plantilla</AddButton>}
      />
      <SearchBox value={busqueda} onChange={setBusqueda} placeholder="Buscar plantilla" />

      {abierto ? (
      <Modal
        title={editando ? 'Editar plantilla' : 'Agregar plantilla'}
        size="lg"
        formId="plantilla-form"
        saving={saveMutation.isPending}
        dirty={form.nombre !== base.nombre || form.canal !== base.canal || form.cuerpo !== base.cuerpo}
        onClose={() => {
          setAbierto(false)
          setEditando(null)
          setForm(vacio)
        }}
      >
      <form
        id="plantilla-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!puedeCrear) return
          saveMutation.mutate({ ...form, nombre: form.nombre.trim() })
        }}
      >

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nombre</span>
            <input
              value={form.nombre}
              onChange={(event) => setForm({ ...form, nombre: event.target.value })}
              placeholder="Recordatorio de saldo"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Canal</span>
            <select
              value={form.canal}
              onChange={(event) => setForm({ ...form, canal: event.target.value as MessageCanal })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="wa_link">Solo enlace (wa.me)</option>
              <option value="whatsapp_api">WhatsApp Business API</option>
            </select>
          </label>
        </div>

        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Cuerpo</span>
          <textarea
            value={form.cuerpo}
            onChange={(event) => setForm({ ...form, cuerpo: event.target.value })}
            rows={4}
            placeholder="Hola {nombre}, tu saldo es Q{saldo}."
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <p className="mt-2 text-xs text-slate-500">
          Variables permitidas: {variables.join(' · ')}
        </p>

        {desconocidas.length > 0 ? (
          <p className="mt-1 text-xs text-red-700">
            Estas variables no existen y el backend las va a rechazar:{' '}
            {desconocidas.map((name) => `{${name}}`).join(', ')}
          </p>
        ) : null}

        {errorGuardar ? (
          <div className="mt-3">
            <Alert tone="error">{errorGuardar}</Alert>
          </div>
        ) : null}
      </form>
      </Modal>
      ) : null}

      <QueryStatus
        isLoading={templatesQuery.isLoading}
        errorMessage={templatesQuery.isError ? 'No se pudieron cargar las plantillas' : null}
      />

      {!templatesQuery.isLoading && !templatesQuery.isError ? (
        <div className="registros">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Canal</th>
                <th className="px-3 py-2 font-medium">Cuerpo</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(templatesQuery.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Todavía no hay plantillas.
                  </td>
                </tr>
              ) : (
                (templatesQuery.data ?? [])
                  .filter((template) =>
                    template.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()),
                  )
                  .map((template) => (
                  <tr key={template.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{template.nombre}</td>
                    <td className="px-3 py-2">
                      {template.canal === 'wa_link' ? 'Solo enlace' : 'Business API'}
                    </td>
                    <td className="max-w-md px-3 py-2 text-slate-600">{template.cuerpo}</td>
                    <td className="px-3 py-2">
                      {template.activo ? (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                          Activa
                        </span>
                      ) : (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          Inactiva
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(template)}
                          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium"
                        >
                          Editar
                        </button>
                        {template.activo ? (
                          <button
                            type="button"
                            onClick={() => setADesactivar(template)}
                            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium"
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
      {aDesactivar ? (
        <ConfirmDialog
          title="Desactivar plantilla"
          confirmLabel="Desactivar"
          pending={deactivateMutation.isPending}
          onClose={() => setADesactivar(null)}
          onConfirm={() => deactivateMutation.mutate(aDesactivar.id)}
        >
          {aDesactivar.nombre} deja de usarse en los mensajes. No se borra.
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
