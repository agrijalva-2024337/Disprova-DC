import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { disableClient, listClients, listZones } from '../api/territory.ts'
import { ApiError } from '../api/http.ts'
import type { Client } from '../api/types.ts'
import { AddButton, SearchBox } from '../ui/ListTools.tsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx'
import { Modal } from '../ui/Modal.tsx'
import { QueryStatus } from '../ui/Status.tsx'
import { RecordSheet, RowMoves } from '../ui/RecordSheet.tsx'
import { useToast } from '../ui/Toast.tsx'
import { ClientMessaging } from '../messaging/ClientMessaging.tsx'
import { ClientForm } from './ClientFormPage.tsx'
import { PublicCatalogSection } from './PublicCatalogSection.tsx'

const tipoLabel: Record<string, string> = {
  tienda: 'Tienda',
  farmacia: 'Farmacia',
  mercado: 'Mercado',
  otro: 'Otro',
}

export function ClientsPage() {
  const queryClient = useQueryClient()
  const [zoneId, setZoneId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [mensajeriaClientId, setMensajeriaClientId] = useState<number | null>(null)
  const [abierto, setAbierto] = useState<Client | null>(null)
  const [formulario, setFormulario] = useState<number | 'nuevo' | null>(null)
  const [sucio, setSucio] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [accionError, setAccionError] = useState<string | null>(null)
  const [aDeshabilitar, setADeshabilitar] = useState<Client | null>(null)
  const avisos = useToast()
  const clientsQuery = useQuery({ queryKey: ['clients'], queryFn: listClients })
  const disableMutation = useMutation({
    mutationFn: disableClient,
    onSuccess: async () => {
      setAbierto(null)
      setADeshabilitar(null)
      setAccionError(null)
      avisos.ok('Cliente deshabilitado')
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: (err) => {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo deshabilitar el cliente'
      setAccionError(mensaje)
      avisos.error(mensaje)
    },
  })
  const zonesQuery = useQuery({ queryKey: ['zones'], queryFn: listZones })

  const zoneName = useMemo(() => {
    const map = new Map<number, string>()
    for (const zone of zonesQuery.data ?? []) {
      map.set(zone.id, zone.nombre)
    }
    return map
  }, [zonesQuery.data])

  const rows = (clientsQuery.data ?? []).filter((client) => {
    if (zoneId && client.zoneId !== Number(zoneId)) return false
    const term = busqueda.trim().toLowerCase()
    if (!term) return true
    return (
      client.nombreComercial.toLowerCase().includes(term) || (client.nit ?? '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-sm text-slate-600">Puntos de la ruta, crédito y contactos.</p>
        </div>
        <AddButton
          onOpen={() => {
            setSucio(false)
            setFormulario('nuevo')
          }}
        >
          Agregar cliente
        </AddButton>
      </div>

      <div className="flex flex-wrap items-end gap-3">
      <SearchBox value={busqueda} onChange={setBusqueda} placeholder="Buscar cliente" />
      <label className="block min-w-48 text-sm">
        <span className="mb-1 block font-medium">Zona</span>
        <select
          value={zoneId}
          onChange={(event) => setZoneId(event.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todas</option>
          {(zonesQuery.data ?? []).map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.nombre}
            </option>
          ))}
        </select>
      </label>
      </div>

      <QueryStatus
        isLoading={clientsQuery.isLoading || zonesQuery.isLoading}
        errorMessage={
          clientsQuery.isError || zonesQuery.isError
            ? 'No se pudieron cargar los clientes'
            : null
        }
      />

      {!clientsQuery.isLoading && !clientsQuery.isError ? (
        <div className="registros">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Zona</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Orden</th>
                <th className="px-3 py-2 font-medium">Crédito</th>
                <th className="px-3 py-2 font-medium">Plazo</th>
                <th className="px-3 py-2 font-medium">Contactos</th>
                <th className="px-3 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                    No hay clientes para mostrar.
                  </td>
                </tr>
              ) : (
                rows.map((client) => (
                  <tr
                    key={client.id}
                    className="cursor-pointer border-t border-slate-100"
                    onDoubleClick={() => setAbierto(client)}
                  >
                    <td className="px-3 py-2">{client.nombreComercial}</td>
                    <td className="px-3 py-2">{zoneName.get(client.zoneId) ?? '—'}</td>
                    <td className="px-3 py-2">{tipoLabel[client.tipoNegocio]}</td>
                    <td className="px-3 py-2">{client.ordenRuta}</td>
                    <td className="px-3 py-2">{client.limiteCredito}</td>
                    <td className="px-3 py-2">{client.plazoDias} días</td>
                    <td className="px-3 py-2">{client.contacts?.length ?? 0}</td>
                    <td className="px-3 py-2">
                      <RowMoves
                        onView={() => setAbierto(client)}
                        onEdit={() => {
                          setSucio(false)
                          setFormulario(client.id)
                          setAbierto(null)
                        }}
                        onDisable={client.activo ? () => setADeshabilitar(client) : undefined}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setMensajeriaClientId(mensajeriaClientId === client.id ? null : client.id)
                        }
                        className="mt-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                      >
                        WhatsApp
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {accionError ? <p className="text-sm text-red-700">{accionError}</p> : null}
      {mensajeriaClientId !== null ? <ClientMessaging clientId={mensajeriaClientId} /> : null}
      {abierto ? (
        <RecordSheet title={abierto.nombreComercial} onClose={() => setAbierto(null)}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Zona</dt>
              <dd>{zoneName.get(abierto.zoneId) ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tipo</dt>
              <dd>{tipoLabel[abierto.tipoNegocio]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Dirección</dt>
              <dd>{abierto.direccion}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Crédito</dt>
              <dd>
                {abierto.limiteCredito} · {abierto.plazoDias} días
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">NIT</dt>
              <dd>{abierto.nit || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Estado</dt>
              <dd>{abierto.activo ? 'Activo' : 'Deshabilitado'}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/admin/clientes/${abierto.id}`} className="text-sm text-slate-600 underline">
              Ver ficha
            </Link>
            <button
              type="button"
              onClick={() => {
                setSucio(false)
                setFormulario(abierto.id)
                setAbierto(null)
              }}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
            >
              Editar cliente
            </button>
          </div>
          <div className="mt-6">
            <PublicCatalogSection clientId={abierto.id} />
          </div>
        </RecordSheet>
      ) : null}
      {aDeshabilitar ? (
        <ConfirmDialog
          title="Deshabilitar cliente"
          confirmLabel="Deshabilitar"
          pending={disableMutation.isPending}
          onClose={() => setADeshabilitar(null)}
          onConfirm={() => disableMutation.mutate(aDeshabilitar.id)}
        >
          {aDeshabilitar.nombreComercial} deja de aparecer en la ruta. No se borra.
        </ConfirmDialog>
      ) : null}
      {formulario !== null ? (
        <Modal
          title={formulario === 'nuevo' ? 'Agregar cliente' : 'Editar cliente'}
          size="lg"
          formId="cliente-form"
          dirty={sucio}
          saving={guardando}
          onClose={() => setFormulario(null)}
        >
          <ClientForm
            key={formulario}
            id={formulario === 'nuevo' ? undefined : formulario}
            formId="cliente-form"
            onDirtyChange={setSucio}
            onSavingChange={setGuardando}
            onDone={() => {
              const eraNuevo = formulario === 'nuevo'
              setFormulario(null)
              avisos.ok(eraNuevo ? 'Cliente agregado' : 'Cliente actualizado')
            }}
          />
        </Modal>
      ) : null}
    </div>
  )
}
