import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { listSessions, listSessionOwners } from '../api/cash.ts'
import { QueryStatus } from '../ui/Status.tsx'

const money = (value: string | number) => Number(value).toFixed(2)

function esperado(fondoInicial: string, cobrado: string, gastos: string) {
  return Number(fondoInicial) + Number(cobrado) - Number(gastos)
}

export function CashSessionsListPage() {
  const [userId, setUserId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const filters = useMemo(
    () => ({
      userId: userId ? Number(userId) : undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
    }),
    [userId, desde, hasta],
  )

  const sessionsQuery = useQuery({
    queryKey: ['cash-sessions', filters],
    queryFn: () => listSessions(filters),
  })
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listSessionOwners })

  const ownerName = useMemo(() => {
    const map = new Map<number, string>()
    for (const user of usersQuery.data ?? []) {
      map.set(user.id, user.nombre)
    }
    return map
  }, [usersQuery.data])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Cajas</h1>
        <p className="text-sm text-slate-600">Auditoría de cuadres: qué se esperaba y qué se contó.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Usuario</span>
          <select
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {(usersQuery.data ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Desde</span>
          <input
            type="date"
            value={desde}
            onChange={(event) => setDesde(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Hasta</span>
          <input
            type="date"
            value={hasta}
            onChange={(event) => setHasta(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <QueryStatus
        isLoading={sessionsQuery.isLoading || usersQuery.isLoading}
        errorMessage={
          sessionsQuery.isError || usersQuery.isError
            ? 'No se pudieron cargar las sesiones de caja'
            : null
        }
      />

      {!sessionsQuery.isLoading && !sessionsQuery.isError ? (
        <div className="registros">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Usuario</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Fondo</th>
                <th className="px-3 py-2 text-right font-medium">Cobrado</th>
                <th className="px-3 py-2 text-right font-medium">Gastos</th>
                <th className="px-3 py-2 text-right font-medium">Esperado</th>
                <th className="px-3 py-2 text-right font-medium">Contado</th>
                <th className="px-3 py-2 text-right font-medium">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {(sessionsQuery.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                    No hay sesiones de caja para mostrar.
                  </td>
                </tr>
              ) : (
                (sessionsQuery.data ?? []).map((session) => {
                  const diferencia = Number(session.diferencia ?? 0)
                  return (
                    <tr key={session.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{session.fecha.slice(0, 10)}</td>
                      <td className="px-3 py-2">
                        {ownerName.get(session.userId) ?? `Usuario ${session.userId}`}
                      </td>
                      <td className="px-3 py-2">
                        {session.estado === 'abierta' ? (
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                            Abierta
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            Cerrada
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(session.fondoInicial)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(session.totalCobrado)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(session.totalGastos)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {money(
                          esperado(session.fondoInicial, session.totalCobrado, session.totalGastos),
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {session.conteoFinal === null ? '—' : money(session.conteoFinal)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium tabular-nums ${
                          session.diferencia === null
                            ? ''
                            : diferencia === 0
                              ? 'text-green-700'
                              : diferencia > 0
                                ? 'text-amber-700'
                                : 'text-red-700'
                        }`}
                      >
                        {session.diferencia === null
                          ? '—'
                          : `${diferencia > 0 ? '+' : ''}${money(diferencia)}`}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
