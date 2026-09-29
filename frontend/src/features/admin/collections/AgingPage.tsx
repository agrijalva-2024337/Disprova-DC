import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getAgingReport } from '../api/collections.ts'
import { QueryStatus } from '../ui/Status.tsx'

const bucketLabels: Record<string, string> = {
  '0-15': '0-15 días',
  '16-30': '16-30 días',
  '31-60': '31-60 días',
  '60+': '60+ días',
}

/**
 * Los buckets vienen del backend ya ordenados: primero la deuda más vieja
 * (`rank` en reports.service.ts). Acá solo se muestra, sin reordenar, para no
 * contradecir al backend.
 */
export function AgingPage() {
  const agingQuery = useQuery({ queryKey: ['aging-report'], queryFn: getAgingReport })
  const rows = agingQuery.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Cobranza</h1>
        <p className="text-sm text-slate-600">
          antigüedad de la deuda. Primero la más vencida: a esos clientes hay que irles primero.
        </p>
      </div>

      <QueryStatus
        isLoading={agingQuery.isLoading}
        errorMessage={agingQuery.isError ? 'No se pudo cargar la antigüedad de saldos' : null}
      />

      {!agingQuery.isLoading && !agingQuery.isError ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Saldo</th>
                {Object.keys(bucketLabels).map((key) => (
                  <th key={key} className="px-3 py-2 font-medium">
                    {bucketLabels[key]}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    Ningún cliente tiene saldo pendiente.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.clientId} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{row.nombre}</td>
                    <td className="px-3 py-2 font-semibold">{row.saldoActual}</td>
                    {Object.keys(bucketLabels).map((key) => {
                      const value = row.buckets[key as keyof typeof row.buckets]
                      const isOldest = key === '60+' && Number(value) > 0
                      return (
                        <td
                          key={key}
                          className={
                            isOldest ? 'px-3 py-2 font-semibold text-red-700' : 'px-3 py-2'
                          }
                        >
                          {value}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2">
                      <Link
                        to={`/admin/cobranza/${row.clientId}`}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Estado de cuenta
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