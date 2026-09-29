import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { acceptReturn, rejectReturn } from '../api/returns.ts'
import type { MerchandiseReturn, ReturnDestino } from '../api/types.ts'
import { useAuth } from '../auth/AuthContext.tsx'
import { Alert } from '../ui/Status.tsx'

const money = (value: string | number) => Number(value).toFixed(2)

function totalDe(items: MerchandiseReturn['items'], destino: ReturnDestino) {
  return items
    .filter((linea) => linea.destino === destino)
    .reduce((sum, linea) => sum + Number(linea.cantidad), 0)
}

export function ReturnDetailPage() {
  const { id } = useParams()
  const returnId = Number(id)
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'

  // El backend no expone GET /returns/:id, asi que la devolución se muestra con
  // lo que devuelve la ultima accion (crear, aceptar o rechazar). Recargar la
  // URL a mano pierde ese estado, y por eso avisamos abajo.
  const [record, setRecord] = useState<MerchandiseReturn | null>(null)
  const [mostrandoArqueo, setMostrandoArqueo] = useState(false)

  const acceptMutation = useMutation({
    mutationFn: () => acceptReturn(returnId),
    onSuccess: (updated) => {
      setRecord(updated)
      setMostrandoArqueo(true)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectReturn(returnId),
    onSuccess: (updated) => {
      setRecord(updated)
      setMostrandoArqueo(false)
    },
  })

  const accionError = acceptMutation.isError
    ? acceptMutation.error instanceof Error
      ? acceptMutation.error.message
      : 'No se pudo aceptar la devolución'
    : rejectMutation.isError
      ? rejectMutation.error instanceof Error
        ? rejectMutation.error.message
        : 'No se pudo rechazar la devolución'
      : null

  if (!record) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Devolución #{returnId}</h1>
        <Alert tone="info">
          Todavía no hay datos de esta devolución en pantalla. Se muestran apenas se registre o se
          resuelva, porque el backend no tiene un endpoint para consultarla.
        </Alert>
        <div className="flex gap-3">
          <Link
            to="/admin/devoluciones/nueva"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Registrar una devolución
          </Link>
          <Link
            to="/admin/devoluciones"
            className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Volver
          </Link>
        </div>
      </div>
    )
  }

  const reingreso = totalDe(record.items, 'reingreso')
  const merma = totalDe(record.items, 'merma')
  const pendiente = record.estado === 'pendiente'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Devolución #{record.id}</h1>
          <p className="text-sm text-slate-600">
            Pedido {record.orderId} · cliente {record.clientId} · {record.fecha.slice(0, 10)}
          </p>
        </div>
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${
            record.estado === 'aceptada'
              ? 'bg-green-100 text-green-800'
              : record.estado === 'rechazada'
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-800'
          }`}
        >
          {record.estado}
        </span>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Motivo</p>
        <p className="mt-1 text-sm">{record.motivo}</p>
      </section>


      {mostrandoArqueo && record.estado === 'aceptada' ? (
        <section className="rounded-lg border border-green-200 bg-green-50 px-4 py-4">
          <h2 className="text-sm font-semibold text-green-900">Devolución aceptada</h2>
          <ul className="mt-2 space-y-1 text-sm text-green-900">
            <li>
              Se reingresó al inventario: <strong>{money(reingreso)}</strong> de mercadería.
            </li>
            <li>
              Quedó como merma: <strong>{money(merma)}</strong>.
            </li>
            <li>
              Se abonó a la cuenta del cliente: <strong>Q{money(record.total)}</strong>.
            </li>
          </ul>
        </section>
      ) : null}

      {accionError ? <Alert tone="error">{accionError}</Alert> : null}

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Línea del pedido</th>
              <th className="px-3 py-2 text-right font-medium">Cantidad</th>
              <th className="px-3 py-2 font-medium">Destino</th>
            </tr>
          </thead>
          <tbody>
            {record.items.map((linea) => (
              <tr key={linea.id} className="border-t border-slate-100">
                <td className="px-3 py-2">#{linea.orderItemId}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(linea.cantidad)}</td>
                <td className="px-3 py-2">
                  {linea.destino === 'reingreso' ? 'Reingreso a inventario' : 'Merma'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Total acreditado al cliente
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {pendiente ? '—' : `Q${money(record.total)}`}
        </p>
        {pendiente ? (
          <p className="mt-1 text-xs text-slate-500">
            Se calcula al aceptar la devolución, con el precio congelado en cada línea.
          </p>
        ) : null}
      </section>

      {pendiente && isAdmin ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending || rejectMutation.isPending}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
          >
            {acceptMutation.isPending ? 'Aceptando…' : 'Aceptar'}
          </button>
          <button
            type="button"
            onClick={() => rejectMutation.mutate()}
            disabled={acceptMutation.isPending || rejectMutation.isPending}
            className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {rejectMutation.isPending ? 'Rechazando…' : 'Rechazar'}
          </button>
        </div>
      ) : null}

      {pendiente && !isAdmin ? (
        <Alert tone="info">
          Queda pendiente de que un administrador la acepte o la rechace.
        </Alert>
      ) : null}
    </div>
  )
}
