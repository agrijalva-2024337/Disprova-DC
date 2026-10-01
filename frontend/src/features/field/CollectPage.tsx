import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError } from '../admin/api/http.ts'
import { FieldShell } from './FieldShell.tsx'
import { quetzales } from './format.ts'
import { createCollectionVisit, createPayment, getAccount } from './ordersApi.ts'

const METODOS = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'cheque', etiqueta: 'Cheque' },
] as const

/**
 * Cobro desde el móvil del vendedor.
 *
 * El backend exponía `POST /payments` y `POST /collection-visits`, pero la
 * pantalla no existía: el vendedor tenía que entregar, volver a la oficina y
 * cobrar desde el panel de administración. Con la ruta repartida en cuatro
 * semanas, eso significaba que el cobro se atrasaba o se anotaba en la
 * libreta, que es justo lo que el MVP viene a eliminar.
 *
 * El pago se registra y queda en la cuenta corriente como abono. Aplicarlo a
 * un pedido concreto es un paso aparte del panel: en campo el producto ya se
 * llevó, así que el abono al saldo es lo que importa en el momento.
 */
export function CollectPage() {
  const { clientId } = useParams()
  const id = Number(clientId)
  const queryClient = useQueryClient()

  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState<'efectivo' | 'transferencia' | 'cheque'>('efectivo')
  const [referencia, setReferencia] = useState('')
  const [quedan, setQuedan] = useState(true)
  const [fechaCompromiso, setFechaCompromiso] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cuentaQuery = useQuery({
    queryKey: ['field-account', id],
    queryFn: () => getAccount(id),
    enabled: Number.isFinite(id),
  })

  const pagoMutation = useMutation({
    mutationFn: createPayment,
    onSuccess: async () => {
      setMonto('')
      setReferencia('')
      setAviso('Pago registrado')
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['field-account', id] })
      await queryClient.invalidateQueries({ queryKey: ['route-today'] })
    },
    onError: (err) => {
      setAviso(null)
      if (err instanceof ApiError && err.code === 'CASH_SESSION_REQUIRED') {
        // El pago es válido, lo que falta es la caja abierta. Decirlo evita
        // que el vendedor lo intente otra vez igual.
        setError('No tenés caja abierta. Abrila desde "Caja" antes de cobrar en efectivo.')
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudo registrar el pago')
      }
    },
  })

  const visitaMutation = useMutation({
    mutationFn: createCollectionVisit,
    onSuccess: async () => {
      setQuedan(true)
      setMonto('')
      setFechaCompromiso('')
      setAviso('Visita de cobranza registrada')
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['route-today'] })
    },
    onError: (err) => {
      setAviso(null)
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la visita')
    },
  })

  const saldo = cuentaQuery.data?.saldoActual ?? '0'
  const montoNumero = Number(monto)
  const montoValido = monto !== '' && !Number.isNaN(montoNumero) && montoNumero > 0
  const cubreSaldo = montoValido && montoNumero >= Number(saldo) && Number(saldo) > 0

  function cobrar() {
    if (!montoValido) return
    pagoMutation.mutate({
      clientId: id,
      monto: monto.toString(),
      metodo,
      referencia: referencia.trim() === '' ? null : referencia.trim(),
    })
  }

  function registrarSinPago() {
    visitaMutation.mutate({
      clientId: id,
      resultado: quedan ? 'compromiso' : 'sin_contacto',
      montoComprometido: montoValido ? monto : null,
      fechaCompromiso: quedan && fechaCompromiso !== '' ? fechaCompromiso : null,
    })
  }

  const movimientos = cuentaQuery.data?.movements ?? []

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4">
        <Link to="/ruta" className="text-base text-slate-600">
          ← Ruta
        </Link>
        <h1 className="text-2xl font-semibold">Cobro</h1>
        <p className="mt-1 text-base text-slate-600">
          Saldo actual <span className="font-semibold text-slate-900">Q{money(saldo)}</span>
    <FieldShell titulo="Cobro" subtitulo={<>Saldo actual {quetzales(saldo)}</>}>
      {cuentaQuery.isLoading ? (
        <p className="rounded-card bg-surface px-4 py-4 text-sm text-muted">Cargando saldo…</p>
      ) : null}
      {cuentaQuery.isError ? (
        <p className="rounded-card border border-brand/25 bg-brand-soft px-4 py-4 text-sm text-brand-deep">
          {cuentaQuery.error instanceof ApiError
            ? cuentaQuery.error.message
            : 'No se pudo cargar la cuenta corriente'}
        </p>
      ) : null}

      {aviso ? (
        <p className="mb-3 rounded-card border border-gold/30 bg-gold-soft px-4 py-3 text-sm font-medium text-ink">
          {aviso}
        </p>
      ) : null}
      {error ? (
        <p className="mb-3 rounded-card border border-brand/25 bg-brand-soft px-4 py-3 text-sm text-brand-deep">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
          <h2 className="font-display text-lg font-semibold text-ink">Registrar pago</h2>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-soft">Monto</span>
            <input
              id="monto"
              inputMode="decimal"
              value={monto}
              onChange={(event) => setMonto(event.target.value)}
              placeholder="0.00"
              className="h-14 w-full rounded-[0.625rem] border border-line bg-parchment px-3.5 text-lg text-ink outline-none focus:border-brand"
            />
          </label>

          <div className="flex gap-2" role="group" aria-label="Método de pago">
            {METODOS.map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                onClick={() => setMetodo(opcion.valor)}
                aria-pressed={metodo === opcion.valor}
                className={`h-12 flex-1 rounded-[0.625rem] text-sm font-medium transition-colors ${
                  metodo === opcion.valor
                    ? 'bg-ink text-parchment'
                    : 'border border-line bg-parchment text-ink-soft hover:border-brand/40'
                }`}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>

          {metodo !== 'efectivo' ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink-soft">Referencia</span>
              <input
                id="referencia"
                value={referencia}
                onChange={(event) => setReferencia(event.target.value)}
                placeholder="Número de cheque o transferencia"
                className="h-12 w-full rounded-[0.625rem] border border-line bg-parchment px-3.5 text-base text-ink outline-none focus:border-brand"
              />
            </label>
          ) : null}

          <button
            type="button"
            disabled={!montoValido || pagoMutation.isPending}
            onClick={cobrar}
            className="h-14 w-full rounded-[0.625rem] bg-brand text-lg font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
          >
            {pagoMutation.isPending ? 'Guardando…' : 'Registrar pago'}
          </button>
        </section>


        <section className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
          <h2 className="font-display text-lg font-semibold text-ink">No pagó</h2>
          <label className="flex items-center gap-3 text-base text-ink-soft">
            <input
              type="checkbox"
              checked={quedan}
              onChange={(event) => setQuedan(event.target.checked)}
              className="h-6 w-6 accent-[#A3221C]"
            />
            Quedaron de prometer pago
          </label>
          {quedan ? (
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink-soft">Monto comprometido</span>
                <input
                  id="compromiso"
                  inputMode="decimal"
                  value={monto}
                  onChange={(event) => setMonto(event.target.value)}
                  placeholder="0.00"
                  className="h-14 w-full rounded-[0.625rem] border border-line bg-parchment px-3.5 text-lg text-ink outline-none focus:border-brand"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink-soft">Fecha de pago</span>
                <input
                  id="fecha-compromiso"
                  type="date"
                  value={fechaCompromiso}
                  onChange={(event) => setFechaCompromiso(event.target.value)}
                  className="h-14 w-full rounded-[0.625rem] border border-line bg-parchment px-3.5 text-base text-ink outline-none focus:border-brand"
                />
              </label>
            </div>
          ) : null}
          <button
            type="button"
            disabled={visitaMutation.isPending}
            onClick={registrarSinPago}
            className="h-14 w-full rounded-[0.625rem] border border-line bg-parchment text-lg font-medium text-ink transition-colors hover:border-brand/40 hover:bg-brand-soft/50 disabled:opacity-60"
          >
            {visitaMutation.isPending
              ? 'Guardando…'
              : quedan
                ? 'Registrar compromiso'
                : 'Registrar que no atendió'}
          </button>
        </section>
      </div>

      {movimientos.length > 0 ? (
        <section className="mt-3 overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <p className="border-b border-line px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted">
            Últimos movimientos
          </p>
          <ul className="divide-y divide-line/70">
            {[...movimientos].reverse().slice(0, 6).map((mov) => (
              <li key={mov.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className={mov.tipo === 'cargo' ? 'text-ink-soft' : 'text-brand'}>
                  {mov.tipo === 'cargo' ? 'Cargo' : 'Abono'}
                </span>
                <span className="tabular-nums text-ink-soft">
                  {quetzales(mov.monto)} · saldo {quetzales(mov.saldoResultante)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cubreSaldo ? (
        <p className="mt-3 rounded-card border border-gold/30 bg-gold-soft px-4 py-3 text-sm text-ink">
          Con este pago queda saldado. Queda pendiente de aplicarse a pedidos concretos desde el
          panel; la cuenta corriente ya lo refleja como abono.
        </p>
      ) : null}
    </FieldShell>
  )
}
