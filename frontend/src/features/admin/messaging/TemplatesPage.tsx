import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createTemplate, deactivateTemplate, listTemplates } from '../api/messaging.ts'
import { ApiError } from '../api/http.ts'
import {
  ALLOWED_TEMPLATE_VARIABLES,
  type MessageCanal,
  type MessageTemplateInput,
} from '../api/types.ts'
import { Alert, QueryStatus } from '../ui/Status.tsx'

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
  const [form, setForm] = useState<MessageTemplateInput>(vacio)

  const templatesQuery = useQuery({ queryKey: ['message-templates'], queryFn: listTemplates })

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: async () => {
      setForm(vacio)
      await queryClient.invalidateQueries({ queryKey: ['message-templates'] })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateTemplate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['message-templates'] })
    },
  })

  const desconocidas = variablesDesconocidas(form.cuerpo)
  const puedeCrear =
    form.nombre.trim() !== '' && form.cuerpo.trim() !== '' && desconocidas.length === 0

  const errorCrear = createMutation.isError
    ? createMutation.error instanceof ApiError
      ? createMutation.error.message
      : 'No se pudo crear la plantilla'
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Plantillas</h1>
        <p className="text-sm text-slate-600">
          Los textos que se mandan por WhatsApp. El cuerpo solo puede usar las variables de abajo.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Nueva plantilla</h2>

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

        {errorCrear ? (
          <div className="mt-3">
            <Alert tone="error">{errorCrear}</Alert>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => createMutation.mutate({ ...form, nombre: form.nombre.trim() })}
            disabled={createMutation.isPending || !puedeCrear}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {createMutation.isPending ? 'Guardando…' : 'Crear plantilla'}
          </button>

          <Link
            to="/admin/mensajeria/enlaces"
            className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Ir a los enlaces de hoy
          </Link>
        </div>
      </section>

      <QueryStatus
        isLoading={templatesQuery.isLoading}
        errorMessage={templatesQuery.isError ? 'No se pudieron cargar las plantillas' : null}
      />

      {!templatesQuery.isLoading && !templatesQuery.isError ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
                (templatesQuery.data ?? []).map((template) => (
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
                      {template.activo ? (
                        <button
                          type="button"
                          onClick={() => deactivateMutation.mutate(template.id)}
                          disabled={deactivateMutation.isPending}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
                        >
                          Desactivar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
