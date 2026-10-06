import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { createPayment, getAccount, getAging } from '../api/collections.ts'
import { ApiError } from '../api/http.ts'
import { getClient } from '../api/territory.ts'
import { Alert, QueryStatus } from '../ui/Status.tsx'
import { Modal } from '../ui/Modal.tsx'
import { useToast } from '../ui/Toast.tsx'
import type { Payment } from '../api/types.ts'
import { ApplyPaymentPanel } from './ApplyPaymentPanel.tsx'
import { paymentFormSchema, type PaymentFormValues } from './paymentFormSchema.ts'

const metodoLabels: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
}

function money(value: string | number) {
  return Number(value).toFixed(2)
}

export function AccountStatementPage() {
  const [searchParams] = useSearchParams()
  const clientId = Number(searchParams.get('clientId'))
  const queryClient = useQueryClient()
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [aplicarSucio, setAplicarSucio] = useState(false)
  const [aplicarGuardando, setAplicarGuardando] = useState(false)
  const avisos = useToast()

  const hasClient = Number.isFinite(clientId) && clientId > 0

  const clientQuery = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => getClient(clientId),
    enabled: hasClient,
  })
  const accountQuery = useQuery({
    queryKey: ['account', clientId],
    queryFn: () => getAccount(clientId),
    enabled: hasClient,
  })
  const agingQuery = useQuery({
    queryKey: ['aging', clientId],
    queryFn: () => getAging(clientId),
    enabled: hasClient,
  })

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { monto: '', metodo: 'efectivo', referencia: '' },
  })

  const paymentMutation = useMutation({
    mutationFn: (values: PaymentFormValues) =>
      createPayment({
        clientId,
        monto: values.monto,
        metodo: values.metodo,
        referencia: values.referencia?.trim() ? values.referencia.trim() : null,
      }),
    onSuccess: async (created) => {
      setPayment(created)
      setShowPaymentForm(false)
      form.reset()
      avisos.ok('Pago registrado')
      await queryClient.invalidateQueries({ queryKey: ['account', clientId] })
    },
    onError: (err) => {
      avisos.error(err instanceof ApiError ? err.message : 'No se pudo registrar el pago')
    },
  })

  const invalidateCollections = async () => {
    await queryClient.invalidateQueries({ queryKey: ['account', clientId] })
    await queryClient.invalidateQueries({ queryKey: ['aging', clientId] })
    await queryClient.invalidateQueries({ queryKey: ['aging-report'] })
  }

  if (!hasClient) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Estado de cuenta</h1>
        <Alert tone="info">
          Falta el cliente. Abrí esta pantalla desde la ficha de un cliente o desde la antigüedad de
          saldos.
        </Alert>
        <Link
          to="/admin/cobranza"
          className="inline-block rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Ver antigüedad de saldos
        </Link>
      </div>
    )
  }

  const cashSessionError =
    paymentMutation.error instanceof ApiError &&
    paymentMutation.error.code === 'CASH_SESSION_REQUIRED'
      ? paymentMutation.error.message
      : null

  const paymentError =
    paymentMutation.isError && !cashSessionError
      ? paymentMutation.error instanceof Error
        ? paymentMutation.error.message
        : 'No se pudo registrar el pago'
      : null


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Estado de cuenta</h1>
          <p className="text-sm text-slate-600">
            {clientQuery.data?.nombreComercial ?? `Cliente ${clientId}`}
          </p>
          <Link to="/admin/cobranza" className="mt-1 inline-block text-sm text-slate-600 underline">
            Volver a cobranza
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setShowPaymentForm(true)}
          className="min-h-11 rounded-full bg-slate-900 px-5 text-sm font-medium text-white"
        >
          Registrar pago
        </button>
      </div>

      <QueryStatus
        isLoading={accountQuery.isLoading || clientQuery.isLoading}
        errorMessage={accountQuery.isError ? 'No se pudo cargar la cuenta corriente' : null}
      />

      {!accountQuery.isLoading && !accountQuery.isError ? (
        <section className="rounded-lg border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Saldo actual</p>
          <p
            className={`mt-1 text-4xl font-semibold tabular-nums ${
              Number(accountQuery.data?.saldoActual) > 0 ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            Q{accountQuery.data?.saldoActual ?? '0.00'}
          </p>
          {!agingQuery.isLoading && agingQuery.data ? (
            <p className="mt-2 text-xs text-slate-500">
              Por antigüedad: 0-15 Q{agingQuery.data.buckets['0-15']} · 16-30 Q
              {agingQuery.data.buckets['16-30']} · 31-60 Q{agingQuery.data.buckets['31-60']} · 60+ Q
              {agingQuery.data.buckets['60+']}
            </p>
          ) : null}
        </section>
      ) : null}

      {showPaymentForm ? (
        <Modal
          title="Registrar pago"
          formId="pago-form"
          dirty={form.formState.isDirty}
          saving={paymentMutation.isPending}
          onClose={() => setShowPaymentForm(false)}
        >
          {cashSessionError ? (
            <div className="mb-3 space-y-2 rounded border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">
                {cashSessionError} Abrí una sesión de caja antes de registrar un pago en efectivo.
              </p>
              <Link
                to="/admin/caja"
                className="inline-block rounded bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800"
              >
                Ir a Caja
              </Link>
            </div>
          ) : null}

          {paymentError ? (
            <div className="mb-3">
              <Alert tone="error">{paymentError}</Alert>
            </div>
          ) : null}

          <form
            id="pago-form"
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={form.handleSubmit((values) => paymentMutation.mutate(values))}
          >
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Monto</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                {...form.register('monto')}
              />
              {form.formState.errors.monto ? (
                <span className="text-xs text-red-700">{form.formState.errors.monto.message}</span>
              ) : null}
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Método</span>
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                {...form.register('metodo')}
              >
                {Object.keys(metodoLabels).map((key) => (
                  <option key={key} value={key}>
                    {metodoLabels[key]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Referencia (opcional)</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                {...form.register('referencia')}
              />
            </label>
          </form>
        </Modal>
      ) : null}

      {payment !== null ? (
        <Modal
          title="Aplicar pago"
          size="lg"
          formId="aplicar-pago"
          dirty={aplicarSucio}
          saving={aplicarGuardando}
          onClose={() => setPayment(null)}
        >
          <ApplyPaymentPanel
            clientId={clientId}
            paymentId={payment.id}
            paymentMonto={payment.monto}
            formId="aplicar-pago"
            onDirtyChange={setAplicarSucio}
            onSavingChange={setAplicarGuardando}
            onApplied={async () => {
              setPayment(null)
              avisos.ok('Pago aplicado')
              await invalidateCollections()
            }}
          />
        </Modal>
      ) : null}

      <MovementsTable
        isLoading={accountQuery.isLoading}
        movements={accountQuery.data?.movements ?? []}
      />
    </div>
  )
}

function MovementsTable({
  isLoading,
  movements,
}: {
  isLoading: boolean
  movements: Array<{
    id: number
    tipo: 'cargo' | 'abono'
    referenciaTipo: string
    referenciaId: string
    monto: string
    saldoResultante: string
    fecha: string
  }>
}) {
  if (isLoading) {
    return null
  }

  return (
    <section className="registros">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 font-medium">Tipo</th>
            <th className="px-3 py-2 font-medium">Referencia</th>
            <th className="px-3 py-2 text-right font-medium">Monto</th>
            <th className="px-3 py-2 text-right font-medium">Saldo resultante</th>
          </tr>
        </thead>
        <tbody>
          {movements.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                Este cliente todavía no tiene movimientos.
              </td>
            </tr>
          ) : (
            movements.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{row.fecha.slice(0, 10)}</td>
                <td className="px-3 py-2">{row.tipo === 'cargo' ? 'Cargo' : 'Abono'}</td>
                <td className="px-3 py-2 text-slate-500">
                  {row.referenciaTipo} {row.referenciaId}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    row.tipo === 'cargo' ? 'text-red-700' : 'text-green-700'
                  }`}
                >
                  {row.tipo === 'cargo' ? '+' : '−'}
                  {money(row.monto)}
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {money(row.saldoResultante)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  )
}
