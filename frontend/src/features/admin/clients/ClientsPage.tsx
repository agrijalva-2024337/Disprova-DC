import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listClients, listZones } from '../api/territory.ts'
import { QueryStatus } from '../ui/Status.tsx'

const tipoLabel: Record<string, string> = {
  tienda: 'Tienda',
  farmacia: 'Farmacia',
  mercado: 'Mercado',
  otro: 'Otro',
}

export function ClientsPage() {
  const [zoneId, setZoneId] = useState('')
  const clientsQuery = useQuery({ queryKey: ['clients'], queryFn: listClients })
  const zonesQuery = useQuery({ queryKey: ['zones'], queryFn: listZones })

  const zoneName = useMemo(() => {
    const map = new Map<number, string>()
    for (const zone of zonesQuery.data ?? []) {
      map.set(zone.id, zone.nombre)
    }
    return map
  }, [zonesQuery.data])

  const rows = (clientsQuery.data ?? []).filter((client) =>
    zoneId ? client.zoneId === Number(zoneId) : true,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-sm text-slate-600">Puntos de la ruta, crédito y contactos.</p>
        </div>
        <Link
          to="/admin/clientes/nuevo"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Nuevo cliente
        </Link>
      </div>

      <label className="block max-w-xs text-sm">
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

      <QueryStatus
        isLoading={clientsQuery.isLoading || zonesQuery.isLoading}
        errorMessage={
          clientsQuery.isError || zonesQuery.isError
            ? 'No se pudieron cargar los clientes'
            : null
        }
      />

      {!clientsQuery.isLoading && !clientsQuery.isError ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
                  <tr key={client.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{client.nombreComercial}</td>
                    <td className="px-3 py-2">{zoneName.get(client.zoneId) ?? '—'}</td>
                    <td className="px-3 py-2">{tipoLabel[client.tipoNegocio]}</td>
                    <td className="px-3 py-2">{client.ordenRuta}</td>
                    <td className="px-3 py-2">{client.limiteCredito}</td>
                    <td className="px-3 py-2">{client.plazoDias} días</td>
                    <td className="px-3 py-2">{client.contacts?.length ?? 0}</td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/admin/clientes/${client.id}`}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Editar
                      </Link>
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
