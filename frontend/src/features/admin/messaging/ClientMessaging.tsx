import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  getClientHistory,
  getClientLink,
  listTemplates,
  sendToClient,
} from '../api/messaging.ts'
import { ApiError } from '../api/http.ts'
import { Alert } from '../ui/Status.tsx'

const estadoLabels: Record<string, string> = {
  generado: 'Generado',
  enviado: 'Enviado',
  fallido: 'Fallido',
}

/**
 * Link y envío a un cliente puntual, con el historial debajo. El envío
 * automático responde 422 mientras el proveedor sea `wa_link`: eso no es un
 * error, es el modo en que hoy funciona el módulo, asi que se muestra como
 * aviso con el link para mandarlo a mano.
 */
export function ClientMessaging({ clientId }: { clientId: number }) {
  const queryClient = useQueryClient()
  const [templateId, setTemplateId] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [link, setLink] = useState<{ url: string; contenido: string } | null>(null)

  const templatesQuery = useQuery({ queryKey: ['message-templates'], queryFn: listTemplates })
  const historyQuery = useQuery({
    queryKey: ['message-history', clientId],
    queryFn: () => getClientHistory(clientId),
    enabled: abierto,
  })
  const activas = (templatesQuery.data ?? []).filter((template) => template.activo)

  const linkMutation = useMutation({
    mutationFn: ({ clientId: id, templateId: tid }: { clientId: number; templateId: number }) =>
      getClientLink(id, tid),
    onSuccess: (resultado) => {
      setLink(resultado)
      void queryClient.invalidateQueries({ queryKey: ['message-history', clientId] })
    },
  })

  const sendMutation = useMutation({
    mutationFn: ({ clientId: id, templateId: tid }: { clientId: number; templateId: number }) =>
      sendToClient(id, tid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['message-history', clientId] })
    },
  })

  const envioNoConfigurado =
    sendMutation.error instanceof ApiError &&
    sendMutation.error.code === 'WHATSAPP_SEND_NOT_CONFIGURED'
      ? sendMutation.error.message
      : null

  const otroError =
    !envioNoConfigurado && sendMutation.isError
      ? sendMutation.error instanceof Error
        ? sendMutation.error.message
        : 'No se pudo enviar el mensaje'
      : null

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
      >
        {abierto ? 'Ocultar WhatsApp' : 'Enviar WhatsApp'}
      </button>

      {abierto ? (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
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
              onClick={() =>
                linkMutation.mutate({ clientId, templateId: Number(templateId) })
              }
              disabled={linkMutation.isPending || templateId === ''}
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {linkMutation.isPending ? 'Generando…' : 'Generar link'}
            </button>

            <button
              type="button"
              onClick={() => sendMutation.mutate({ clientId, templateId: Number(templateId) })}
              disabled={sendMutation.isPending || templateId === ''}
              className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {sendMutation.isPending ? 'Enviando…' : 'Enviar automático'}
            </button>
          </div>

          {envioNoConfigurado ? (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2">
              <p className="text-sm text-amber-900">
                {envioNoConfigurado} Generá el link y mandalo a mano desde WhatsApp.
              </p>
            </div>
          ) : null}

          {otroError ? <Alert tone="error">{otroError}</Alert> : null}

          {linkMutation.isError ? (
            <Alert tone="error">
              {linkMutation.error instanceof Error
                ? linkMutation.error.message
                : 'No se pudo generar el link'}
            </Alert>
          ) : null}

          {link ? (
            <div className="space-y-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Mensaje</p>
              <p className="whitespace-pre-wrap text-sm">{link.contenido}</p>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                Abrir WhatsApp
              </a>
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold">Historial</h3>
            {historyQuery.isLoading ? (
              <p className="mt-2 text-sm text-slate-500">Cargando historial…</p>
            ) : historyQuery.isError ? (
              <div className="mt-2">
                <Alert tone="error">No se pudo cargar el historial</Alert>
              </div>
            ) : (historyQuery.data ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Todavía no se generó ningún mensaje para este cliente.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {(historyQuery.data ?? []).map((log) => (
                  <li key={log.id} className="rounded border border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">
                        {log.createdAt.slice(0, 16).replace('T', ' ')} · {log.telefono}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          log.estado === 'fallido'
                            ? 'bg-red-100 text-red-800'
                            : log.estado === 'enviado'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {estadoLabels[log.estado] ?? log.estado}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{log.contenido}</p>
                    {log.error ? <p className="mt-1 text-xs text-red-700">{log.error}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
