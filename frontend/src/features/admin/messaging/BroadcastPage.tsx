import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getBroadcastToday, listTemplates } from '../api/messaging.ts'
import { ApiError } from '../api/http.ts'
import { Alert, QueryStatus } from '../ui/Status.tsx'

export function BroadcastPage() {
  const [templateId, setTemplateId] = useState('')

  const templatesQuery = useQuery({ queryKey: ['message-templates'], queryFn: listTemplates })
  const activas = (templatesQuery.data ?? []).filter((template) => template.activo)

  const broadcastQuery = useMutation({
    mutationFn: getBroadcastToday,
  })

  const links = broadcastQuery.data ?? []
  const error = broadcastQuery.isError
    ? broadcastQuery.error instanceof ApiError
      ? broadcastQuery.error.message
      : 'No se pudieron generar los enlaces'
    : null


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Enlaces de hoy</h1>
        <p className="text-sm text-slate-600">
          Genera los links de la zona activa de hoy y ábrelos uno por uno. No se manda nada solo: el
          envío automático necesita WHATSAPP_PROVIDER=business_api.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="block min-w-64 text-sm">
          <span className="mb-1 block font-medium">Plantilla</span>
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Elegí una plantilla</option>
            {activas.map((template) => (
              <option key={template.id} value={template.id}>
                {template.nombre}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => broadcastQuery.mutate(Number(templateId))}
          disabled={broadcastQuery.isPending || templateId === ''}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {broadcastQuery.isPending ? 'Generando…' : 'Generar enlaces de hoy'}
        </button>
      </div>

      <QueryStatus
        isLoading={templatesQuery.isLoading}
        errorMessage={templatesQuery.isError ? 'No se pudieron cargar las plantillas' : null}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {broadcastQuery.isSuccess && links.length === 0 ? (
        <Alert tone="info">
          Hoy no hay zona activa, o ningún cliente de la zona acepta mensajes.
        </Alert>
      ) : null}

      {links.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <article
              key={link.clientId}
              className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <p className="text-sm font-medium">{link.nombre}</p>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 rounded bg-green-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-green-700"
              >
                Abrir WhatsApp
              </a>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}