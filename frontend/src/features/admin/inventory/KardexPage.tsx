import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/http.ts'
import { listMovements } from '../api/inventory.ts'
import { Alert, QueryStatus } from '../ui/Status.tsx'

export function KardexPage() {
  const { productId } = useParams()
  const id = Number(productId)
  const movementsQuery = useQuery({
    queryKey: ['inventory-movements', id],
    queryFn: () => listMovements(id),
    enabled: Number.isFinite(id),
  })

  const rows = movementsQuery.data ?? []

  return (
    <div className="space-y-4">
      <Link to="/admin/inventario" className="text-sm text-slate-600 hover:underline">
        ← Existencias
      </Link>
      <h1 className="text-xl font-semibold">Kardex</h1>
      <QueryStatus
        isLoading={movementsQuery.isLoading}
        errorMessage={
          movementsQuery.isError
            ? movementsQuery.error instanceof ApiError
              ? movementsQuery.error.message
              : 'No se pudo cargar el historial'
            : null
        }
      />
      {!movementsQuery.isLoading && !movementsQuery.isError && rows.length === 0 ? (
        <Alert tone="info">Este producto no tiene movimientos.</Alert>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Bodega</th>
                <th className="px-3 py-2 font-medium">Cantidad</th>
                <th className="px-3 py-2 font-medium">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((movement) => (
                <tr key={movement.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{new Date(movement.createdAt).toLocaleString('es-GT')}</td>
                  <td className="px-3 py-2">{movement.tipo}</td>
                  <td className="px-3 py-2">{movement.warehouse.nombre}</td>
                  <td className="px-3 py-2">{movement.cantidad}</td>
                  <td className="px-3 py-2">
                    {movement.referenciaTipo ?? '—'}
                    {movement.referenciaId ? ` ${movement.referenciaId}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
