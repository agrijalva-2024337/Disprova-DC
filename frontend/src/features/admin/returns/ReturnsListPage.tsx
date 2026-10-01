import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listReturns } from '../api/returns.ts'
import type { ReturnEstado } from '../api/types.ts'
import { SearchBox } from '../ui/ListTools.tsx'
import { QueryStatus } from '../ui/Status.tsx'

const estadoLabel: Record<ReturnEstado, string> = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
}

const estadoClass: Record<ReturnEstado, string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  aceptada: 'bg-green-100 text-green-800',
  rechazada: 'bg-red-100 text-red-800',
}

function quetzales(value: string) {
  return `Q ${Number(value).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fecha(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

export function ReturnsListPage() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState<'' | ReturnEstado>('')
  const [busqueda, setBusqueda] = useState('')
  const returnsQuery = useQuery({
    queryKey: ['returns', estado],
    queryFn: () => listReturns(estado ? { estado } : {}),
  })
  const rows = (returnsQuery.data?.data ?? []).filter((row) => {
    const term = busqueda.trim().toLowerCase()
    if (!term) return true
    return (
      row.client.nombreComercial.toLowerCase().includes(term) ||
      row.order.numero.toLowerCase().includes(term) ||
      row.motivo.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Devoluciones</h1>
          <p className="text-sm text-slate-600">Mercadería devuelta, pendiente de aceptar o ya resuelta.</p>
        </div>
        <Link
          to="/admin/devoluciones/nueva"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Agregar devolución
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
      <SearchBox value={busqueda} onChange={setBusqueda} placeholder="Buscar cliente, pedido o motivo" />
      <label className="block min-w-48 text-sm">
        <span className="mb-1 block font-medium">Estado</span>
        <select
          value={estado}
          onChange={(event) => setEstado(event.target.value as '' | ReturnEstado)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="aceptada">Aceptada</option>
          <option value="rechazada">Rechazada</option>
        </select>
      </label>
      </div>

      <QueryStatus
        isLoading={returnsQuery.isLoading}
        errorMessage={returnsQuery.isError ? 'No se pudieron cargar las devoluciones' : null}
      />

      {!returnsQuery.isLoading && !returnsQuery.isError ? (
        <div className="registros">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Id</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Pedido origen</th>
                <th className="px-3 py-2 font-medium">Motivo</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    No hay devoluciones para mostrar.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    onClick={() => navigate(`/admin/devoluciones/${row.id}`)}
                  >
                    <td className="px-3 py-2">
                      <Link to={`/admin/devoluciones/${row.id}`} className="font-medium text-slate-900 underline">
                        {row.id}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.client.nombreComercial}</td>
                    <td className="px-3 py-2">{row.order.numero}</td>
                    <td className="px-3 py-2">{row.motivo}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${estadoClass[row.estado]}`}>
                        {estadoLabel[row.estado]}
                      </span>
                    </td>
                    <td className="px-3 py-2">{quetzales(row.total)}</td>
                    <td className="px-3 py-2">{fecha(row.fecha)}</td>
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
