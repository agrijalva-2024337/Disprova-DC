import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/http.ts'
import { getClient, listZones } from '../api/territory.ts'
import { Modal } from '../ui/Modal.tsx'
import { Alert, QueryStatus } from '../ui/Status.tsx'
import { useToast } from '../ui/Toast.tsx'
import { ClientForm } from './ClientFormPage.tsx'
import { PublicCatalogSection } from './PublicCatalogSection.tsx'

const tipoLabel: Record<string, string> = {
  tienda: 'Tienda',
  farmacia: 'Farmacia',
  mercado: 'Mercado',
  otro: 'Otro',
}

export function ClientDetailPage() {
  const { id } = useParams()
  const clientId = Number(id)
  const [editando, setEditando] = useState(false)
  const [sucio, setSucio] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const avisos = useToast()

  const clientQuery = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => getClient(clientId),
    enabled: Number.isFinite(clientId),
  })
  const zonesQuery = useQuery({ queryKey: ['zones'], queryFn: listZones })
  const zona = zonesQuery.data?.find((item) => item.id === clientQuery.data?.zoneId)

  if (!Number.isFinite(clientId)) {
    return <Alert tone="error">El cliente no existe.</Alert>
  }

  if (clientQuery.isLoading) {
    return <QueryStatus isLoading loadingText="Cargando cliente…" />
  }

  if (clientQuery.isError || !clientQuery.data) {
    return (
      <Alert tone="error">
        {clientQuery.error instanceof ApiError ? clientQuery.error.message : 'No se pudo cargar el cliente'}
      </Alert>
    )
  }

  const client = clientQuery.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/clientes" className="text-sm text-slate-600 underline">
            Volver a clientes
          </Link>
          <h1 className="mt-2 text-xl font-semibold">{client.nombreComercial}</h1>
        </div>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="min-h-11 rounded-full bg-slate-900 px-5 text-sm font-medium text-white"
        >
          Editar cliente
        </button>
      </div>

      <dl className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Zona</dt>
          <dd>{zona?.nombre ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Tipo</dt>
          <dd>{tipoLabel[client.tipoNegocio] ?? client.tipoNegocio}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Dirección</dt>
          <dd>{client.direccion}</dd>
        </div>
        <div>
          <dt className="text-slate-500">NIT</dt>
          <dd>{client.nit || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Estado</dt>
          <dd>{client.activo ? 'Activo' : 'Deshabilitado'}</dd>
        </div>
      </dl>

      <PublicCatalogSection clientId={client.id} />

      {editando ? (
        <Modal
          title="Editar cliente"
          size="lg"
          formId="cliente-detalle-form"
          dirty={sucio}
          saving={guardando}
          onClose={() => setEditando(false)}
        >
          <ClientForm
            id={client.id}
            formId="cliente-detalle-form"
            onDirtyChange={setSucio}
            onSavingChange={setGuardando}
            onDone={() => {
              setEditando(false)
              avisos.ok('Cliente actualizado')
            }}
          />
        </Modal>
      ) : null}
    </div>
  )
}
