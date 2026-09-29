import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { listOrders } from '../../field/ordersApi.ts'
import { applyPayment } from '../api/collections.ts'
import { Alert } from '../ui/Status.tsx'

const money = (value: string | number) => Number(value).toFixed(2)

/**
 * Solo quedan cobrables los pedidos a crédito que ya entregaron algo: es donde
 * el backend postea el cargo. Filtrar acá evita ofrecer un borrador o un pedido
 * en ruta, que el backend aceptaría igual y no corresponde.
 */
function isCobrable(estado: string, condicionPago: string) {
  return condicionPago === 'credito' && (estado === 'entregado' || estado === 'entregado_parcial')
}

type MontosForm = { montos: Record<string, string> }

export function ApplyPaymentPanel({
  clientId,
  paymentId,
  paymentMonto,
  onApplied,
}: {
  clientId: number
  paymentId: number
  paymentMonto: string
  onApplied: () => Promise<void>
}) {
  const ordersQuery = useQuery({
    queryKey: ['client-orders', clientId],
    queryFn: () => listOrders(clientId),
  })

  const form = useForm<MontosForm>({ defaultValues: { montos: {} } })

  const applyMutation = useMutation({
    mutationFn: async (montos: Record<string, string>) => {
      const applications = Object.entries(montos)
        .filter(([, value]) => value.trim() !== '' && Number(value) > 0)
        .map(([orderId, value]) => ({ orderId: Number(orderId), monto: value }))
      if (applications.length === 0) {
        throw new Error('Indica al menos un monto a aplicar')
      }
      return applyPayment(paymentId, { applications })
    },
    onSuccess: onApplied,
  })

  const cobrables = (ordersQuery.data ?? []).filter((order) =>
    isCobrable(order.estado, order.condicionPago),
  )

  const montos = form.watch('montos')
  const suma = useMemo(
    () =>
      Object.values(montos).reduce(
        (total, value) => total + (value.trim() === '' ? 0 : Number(value) || 0),
        0,
      ),
    [montos],
  )

  // El pago se acaba de crear, así que nada está aplicado todavía: lo que queda
  // por distribuir es el monto menos lo que el admin viene escribiendo.
  const restante = Number(paymentMonto) - suma
  const sePasa = restante < -0.001

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold">Aplicar el pago a pedidos</h2>
      <p className="text-sm text-slate-600">
        El pago {paymentId} de Q{money(paymentMonto)} quedó registrado. Distribuyelo entre los
        pedidos pendientes del cliente.
      </p>

      {applyMutation.isError ? (
        <div className="mt-3">
          <Alert tone="error">
            {applyMutation.error instanceof Error
              ? applyMutation.error.message
              : 'No se pudo aplicar el pago'}
          </Alert>
        </div>
      ) : null}

      {ordersQuery.isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Cargando pedidos del cliente…</p>
      ) : cobrables.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Este cliente no tiene pedidos de crédito entregados para aplicar el pago.
        </p>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={form.handleSubmit((values) => applyMutation.mutate(values.montos))}
        >
          {cobrables.map((order) => (
            <div
              key={order.id}
              className="grid items-end gap-3 rounded border border-slate-200 p-3 sm:grid-cols-[1fr_9rem]"
            >
              <div>
                <p className="text-sm font-medium">{order.numero}</p>
                <p className="text-xs text-slate-500">
                  {order.estado} · total Q{money(order.total)}
                </p>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Aplicar</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  {...form.register(`montos.${order.id}`)}
                />
              </label>
            </div>
          ))}

          <div className="space-y-1 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Aplicando: <span className="font-semibold tabular-nums">Q{money(suma)}</span> de Q
                {money(paymentMonto)}
              </p>
              <button
                type="submit"
                disabled={applyMutation.isPending || suma <= 0}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {applyMutation.isPending ? 'Aplicando…' : 'Aplicar pago'}
              </button>
            </div>
            <p
              className={`text-sm ${
                sePasa ? 'font-medium text-red-700' : 'text-slate-600'
              }`}
            >
              {sePasa
                ? `Te pasás del pago por Q${money(Math.abs(restante))}. Bajá los montos.`
                : `Queda del pago sin aplicar: Q${money(restante)}`}
            </p>
          </div>
        </form>
      )}
    </section>
  )
}