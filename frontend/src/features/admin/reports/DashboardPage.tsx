import { useQuery } from '@tanstack/react-query'
import { getAgingReport, getCollectionsToday, getSalesToday } from '../api/reports.ts'
import { QueryStatus } from '../ui/Status.tsx'
import { AgingTable } from './AgingTable.tsx'

const money = (value: string) => Number(value).toFixed(2)

function BigNumber({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'danger'
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-3xl font-semibold tabular-nums ${
          tone === 'danger' ? 'text-red-700' : 'text-slate-900'
        }`}
      >
        Q{value}
      </p>
    </div>
  )
}

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


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Panel del día</h1>
        <p className="text-sm text-slate-600">Cómo viene el día: ventas, cobros y a quién presionar.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <BigNumber label="Vendido hoy" value={sales ? money(sales.total) : '0.00'} />
        <BigNumber label="Cobrado hoy" value={collections ? money(collections.total) : '0.00'} />
        <BigNumber
          label="Saldos vencidos"
          value={money(vencido.toFixed(2))}
          tone={vencido > 0 ? 'danger' : 'default'}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Ventas de hoy</h2>

        <QueryStatus
          isLoading={salesQuery.isLoading}
          errorMessage={salesQuery.isError ? 'No se pudo cargar lo vendido hoy' : null}
        />

        {sales ? (
          <>
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">Q{money(sales.total)}</span> en total · Q
              {money(sales.porCondicion.contado)} contado · Q
              {money(sales.porCondicion.credito)} a crédito
            </p>

            <div className="registros">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Vendedor</th>
                    <th className="px-3 py-2 text-right font-medium">Contado</th>
                    <th className="px-3 py-2 text-right font-medium">Crédito</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.porVendedor.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                        Hoy todavía no se registró ninguna venta.
                      </td>
                    </tr>
                  ) : (
                    sales.porVendedor.map((row) => (
                      <tr key={row.userId} className="border-t border-slate-100">
                        <td className="px-3 py-2">{row.nombre}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(row.contado)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(row.credito)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {money(row.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Cobros de hoy</h2>

        <QueryStatus
          isLoading={collectionsQuery.isLoading}
          errorMessage={collectionsQuery.isError ? 'No se pudo cargar lo cobrado hoy' : null}
        />

        {collections ? (
          <div className="registros">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Vendedor</th>
                  <th className="px-3 py-2 text-right font-medium">Cobrado</th>
                </tr>
              </thead>
              <tbody>
                {collections.porVendedor.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-slate-500">
                      Hoy todavía no se registró ningún cobro.
                    </td>
                  </tr>
                ) : (
                  collections.porVendedor.map((row) => (
                    <tr key={row.userId} className="border-t border-slate-100">
                      <td className="px-3 py-2">{row.nombre}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {money(row.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Saldos vencidos</h2>
          <p className="text-xs text-slate-500">
            Primero la deuda más vieja: a esos clientes hay que irles primero.
          </p>
        </div>

        <QueryStatus
          isLoading={agingQuery.isLoading}
          errorMessage={agingQuery.isError ? 'No se pudo cargar la antigüedad de saldos' : null}
        />

        {!agingQuery.isLoading && !agingQuery.isError ? <AgingTable rows={aging} /> : null}
      </section>
    </div>
  )
}
