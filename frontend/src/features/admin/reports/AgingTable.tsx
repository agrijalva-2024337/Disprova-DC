import { Link } from 'react-router-dom'
import type { AgingReportRow } from '../api/types.ts'
import { DataTable, EmptyRow, Td, Th, Tr } from '../ui/DataTable.tsx'

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
  const columnas = 3 + Object.keys(bucketLabels).length

  return (
    <DataTable>
      <thead>
        <tr>
          <Th>Cliente</Th>
          <Th align="right">Saldo</Th>
          {Object.keys(bucketLabels).map((key) => (
            <Th key={key} align="right">
              {bucketLabels[key]}
            </Th>
          ))}
          <Th>Acciones</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyRow columnas={columnas}>{emptyText}</EmptyRow>
        ) : (
          rows.map((row) => (
            <Tr key={row.clientId}>
              <Td className="font-medium text-ink">{row.nombre}</Td>
              <Td align="right" className="font-semibold tabular-nums text-ink">
                {money(row.saldoActual)}
              </Td>
              {Object.keys(bucketLabels).map((key) => {
                const value = row.buckets[key as keyof typeof row.buckets]
                // Lo que pasó de 60 días se marca en rojo: es la deuda que hay
                // que ir a buscar primero.
                const masViejo = key === '60+' && Number(value) > 0
                return (
                  <Td
                    key={key}
                    align="right"
                    className={`tabular-nums ${masViejo ? 'font-semibold text-brand' : ''}`}
                  >
                    {money(value)}
                  </Td>
                )
              })}
              <Td>
                <Link
                  to={`/admin/cobranza/${row.clientId}`}
                  className="inline-block rounded-[0.5rem] border border-line px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-brand/40 hover:bg-brand-soft/50 hover:text-brand-deep"
                >
                  Estado de cuenta
                </Link>
              </Td>
            </Tr>
          ))
        )}
      </tbody>
    </DataTable>
  )
}