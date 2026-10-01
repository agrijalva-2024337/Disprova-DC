import { useQuery } from '@tanstack/react-query'
import { getAgingReport, getCollectionsToday, getSalesToday } from '../api/reports.ts'
import { DataTable, EmptyRow, Td, Th, Tr } from '../ui/DataTable.tsx'
import { QueryStatus } from '../ui/Status.tsx'
import { PageHeader, SectionTitle, StatCard } from '../ui/StatCard.tsx'
import { AgingTable } from './AgingTable.tsx'

const money = (value: string) => Number(value).toFixed(2)

export function DashboardPage() {
  const salesQuery = useQuery({ queryKey: ['reports', 'sales-today'], queryFn: getSalesToday })
  const collectionsQuery = useQuery({
    queryKey: ['reports', 'collections-today'],
    queryFn: getCollectionsToday,
  })
  const agingQuery = useQuery({ queryKey: ['reports', 'aging'], queryFn: getAgingReport })

  const sales = salesQuery.data
  const collections = collectionsQuery.data
  const aging = agingQuery.data ?? []
  const vencido = aging.reduce((sum, row) => sum + Number(row.saldoActual), 0)
  // Lo que pasó de 60 días es la urgencia real, no el total: se cuenta aparte
  // para que el número grande no se lea como "todo está mal".
  const masViejo = aging
    .filter((row) => Number(row.buckets['60+']) > 0)
    .reduce((sum, row) => sum + Number(row.saldoActual), 0)

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Panel del día"
        descripcion="Cómo viene el día: ventas, cobros y a quién presionar."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Vendido hoy"
          value={`Q${sales ? money(sales.total) : '0.00'}`}
          detalle={sales ? `${money(sales.porCondicion.contado)} contado` : 'Sin ventas aún'}
        />
        <StatCard
          label="Cobrado hoy"
          value={`Q${collections ? money(collections.total) : '0.00'}`}
          tono="destacado"
          detalle={collections ? 'Cobros registrados' : 'Sin cobros aún'}
        />
        <StatCard
          label="Saldos por cobrar"
          value={`Q${money(vencido.toFixed(2))}`}
          tono={vencido > 0 ? 'alerta' : 'neutro'}
          detalle={`${aging.length} ${aging.length === 1 ? 'cliente' : 'clientes'}`}
        />
        <StatCard
          label="Más de 60 días"
          value={`Q${money(masViejo.toFixed(2))}`}
          tono={masViejo > 0 ? 'alerta' : 'neutro'}
          detalle="Deuda que hay que ir a buscar"
        />
      </div>

      <section className="space-y-3">
        <SectionTitle>Ventas de hoy</SectionTitle>

        <QueryStatus
          isLoading={salesQuery.isLoading}
          errorMessage={salesQuery.isError ? 'No se pudo cargar lo vendido hoy' : null}
        />

        {sales ? (
          <>
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">Q{money(sales.total)}</span> en total · Q
              {money(sales.porCondicion.contado)} contado · Q{money(sales.porCondicion.credito)}{' '}
              a crédito
            </p>

            <DataTable>
              <thead>
                <tr>
                  <Th>Vendedor</Th>
                  <Th align="right">Contado</Th>
                  <Th align="right">Crédito</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {sales.porVendedor.length === 0 ? (
                  <EmptyRow columnas={4}>Hoy todavía no se registró ninguna venta.</EmptyRow>
                ) : (
                  sales.porVendedor.map((row) => (
                    <Tr key={row.userId}>
                      <Td className="font-medium text-ink">{row.nombre}</Td>
                      <Td align="right" className="tabular-nums">
                        {money(row.contado)}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {money(row.credito)}
                      </Td>
                      <Td align="right" className="font-semibold tabular-nums text-ink">
                        {money(row.total)}
                      </Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </DataTable>
          </>
        ) : null}
      </section>


      <section className="space-y-3">
        <SectionTitle>Cobros de hoy</SectionTitle>

        <QueryStatus
          isLoading={collectionsQuery.isLoading}
          errorMessage={collectionsQuery.isError ? 'No se pudo cargar lo cobrado hoy' : null}
        />

        {collections ? (
          <DataTable>
            <thead>
              <tr>
                <Th>Vendedor</Th>
                <Th align="right">Cobrado</Th>
              </tr>
            </thead>
            <tbody>
              {collections.porVendedor.length === 0 ? (
                <EmptyRow columnas={2}>Hoy todavía no se registró ningún cobro.</EmptyRow>
              ) : (
                collections.porVendedor.map((row) => (
                  <Tr key={row.userId}>
                    <Td className="font-medium text-ink">{row.nombre}</Td>
                    <Td align="right" className="font-semibold tabular-nums text-ink">
                      {money(row.total)}
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </DataTable>
        ) : null}
      </section>

      <section className="space-y-3">
        <SectionTitle>Saldos vencidos</SectionTitle>
        <p className="-mt-1 text-xs text-muted">
          Primero la deuda más vieja: a esos clientes hay que irles primero.
        </p>

        <QueryStatus
          isLoading={agingQuery.isLoading}
          errorMessage={agingQuery.isError ? 'No se pudo cargar la antigüedad de saldos' : null}
        />

        {!agingQuery.isLoading && !agingQuery.isError ? <AgingTable rows={aging} /> : null}
      </section>
    </div>
  )
}
