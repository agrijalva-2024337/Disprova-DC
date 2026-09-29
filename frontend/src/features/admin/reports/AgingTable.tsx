import { Link } from 'react-router-dom'
import type { AgingReportRow } from '../api/types.ts'

const bucketLabels: Record<string, string> = {
  '0-15': '0-15 días',
  '16-30': '16-30 días',
  '31-60': '31-60 días',
  '60+': '60+ días',
}

const money = (value: string) => Number(value).toFixed(2)

/**
 * Tabla de antigüedad de saldos. Recibe las filas ya ordenadas: el backend las
 * devuelve poniendo primero la deuda más vieja y acá no se reordenan, para no
 * contradecirlo.
 *
 * Vive en su propio componente para que la usen tanto el dashboard como la
 * pantalla de cobranza, en vez de duplicar la tabla en cada una.
 */
export function AgingTable({
  rows,
  emptyText = 'Ningún cliente tiene saldo pendiente.',
}: {
  rows: AgingReportRow[]
  emptyText?: string
}) {
  return (
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
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.clientId} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{row.nombre}</td>
                <td className="px-3 py-2 font-semibold tabular-nums">{money(row.saldoActual)}</td>
                {Object.keys(bucketLabels).map((key) => {
                  const value = row.buckets[key as keyof typeof row.buckets]
                  const masViejo = key === '60+' && Number(value) > 0
                  return (
                    <td
                      key={key}
                      className={masViejo ? 'px-3 py-2 font-semibold text-red-700' : 'px-3 py-2'}
                    >
                      {money(value)}
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
  )
}