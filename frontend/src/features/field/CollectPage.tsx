import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../admin/api/http.ts'
import { createCollectionVisit, createPayment, getAccount } from './ordersApi.ts'

const METODOS = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'cheque', etiqueta: 'Cheque' },
] as const

const money = (value: string | number) => Number(value).toFixed(2)

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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4">
        <Link to="/ruta" className="text-base text-slate-600">
          ← Ruta
        </Link>
        <h1 className="text-2xl font-semibold">Cobro</h1>
        <p className="mt-1 text-base text-slate-600">
          Saldo actual <span className="font-semibold text-slate-900">Q{money(saldo)}</span>
        </p>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        {cuentaQuery.isLoading ? (
          <p className="rounded-xl bg-white px-4 py-4 text-base">Cargando saldo…</p>
        ) : null}
        {cuentaQuery.isError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-base text-red-800">
            {cuentaQuery.error instanceof ApiError
              ? cuentaQuery.error.message
              : 'No se pudo cargar la cuenta corriente'}
          </p>
        ) : null}

        {aviso ? <p className="rounded-xl bg-green-50 px-4 py-3 text-base text-green-800">{aviso}</p> : null}
        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">{error}</p> : null}

        {cuentaQuery.data && cuentaQuery.data.movements.length > 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Últimos movimientos</h2>
            <ul className="mt-2 space-y-1">
              {cuentaQuery.data.movements
                .slice(-5)
                .reverse()
                .map((mov) => (
                  <li key={mov.id} className="flex items-center justify-between text-sm">
                    <span className={mov.tipo === 'cargo' ? 'text-slate-700' : 'text-green-800'}>
                      {mov.tipo === 'cargo' ? 'Cargo' : 'Abono'}
                    </span>
                    <span className="tabular-nums">
                      Q{money(mov.monto)} · saldo Q{money(mov.saldoResultante)}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <h2 className="text-lg font-semibold">Registrar pago</h2>
          <label className="block text-sm font-medium text-slate-600" htmlFor="monto">
            Monto
          </label>
          <input
            id="monto"
            inputMode="decimal"
            value={monto}
            onChange={(event) => setMonto(event.target.value)}
            placeholder="0.00"
            className="h-14 w-full rounded-xl border border-slate-300 px-4 text-lg"
          />
          {Number(saldo) > 0 ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMonto(saldo)}
                className="h-12 flex-1 rounded-xl border border-slate-300 text-base font-medium text-slate-700"
              >
                Todo ({money(saldo)})
              </button>
              <button
                type="button"
                onClick={() => setMonto((Number(saldo) / 2).toFixed(2))}
                className="h-12 flex-1 rounded-xl border border-slate-300 text-base font-medium text-slate-700"
              >
                Mitad
              </button>
            </div>
          ) : null}

          <label className="block text-sm font-medium text-slate-600">Método</label>
          <div className="flex gap-2">
            {METODOS.map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                onClick={() => setMetodo(opcion.valor)}
                className={`h-12 flex-1 rounded-xl text-base font-medium ${
                  metodo === opcion.valor ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-700'
                }`}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>

          {metodo !== 'efectivo' ? (
            <>
              <label className="block text-sm font-medium text-slate-600" htmlFor="referencia">
                Referencia
              </label>
              <input
                id="referencia"
                value={referencia}
                onChange={(event) => setReferencia(event.target.value)}
                placeholder="Número de cheque o transferencia"
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base"
              />
            </>
          ) : null}

          <button
            type="button"
            disabled={!montoValido || pagoMutation.isPending}
            onClick={cobrar}
            className="h-14 w-full rounded-xl bg-green-700 text-lg font-medium text-white disabled:opacity-60"
          >
            {pagoMutation.isPending ? 'Guardando…' : 'Registrar pago'}
          </button>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <h2 className="text-lg font-semibold">No pagó</h2>
          <label className="flex items-center gap-3 text-base">
            <input
              type="checkbox"
              checked={quedan}
              onChange={(event) => setQuedan(event.target.checked)}
              className="h-6 w-6"
            />
            Quedaron de prometer pago
          </label>
          {quedan ? (
            <>
              <label className="block text-sm font-medium text-slate-600" htmlFor="compromiso">
                Monto comprometido
              </label>
              <input
                id="compromiso"
                inputMode="decimal"
                value={monto}
                onChange={(event) => setMonto(event.target.value)}
                placeholder="0.00"
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base"
              />
              <label className="block text-sm font-medium text-slate-600" htmlFor="fecha-compromiso">
                Fecha de pago
              </label>
              <input
                id="fecha-compromiso"
                type="date"
                value={fechaCompromiso}
                onChange={(event) => setFechaCompromiso(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base"
              />
            </>
          ) : null}
          <button
            type="button"
            disabled={visitaMutation.isPending}
            onClick={registrarSinPago}
            className="h-14 w-full rounded-xl bg-slate-700 text-lg font-medium text-white disabled:opacity-60"
          >
            {visitaMutation.isPending
              ? 'Guardando…'
              : quedan
                ? 'Registrar compromiso'
                : 'Registrar que no atendió'}
          </button>
        </section>

        {cubreSaldo ? (
          <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
            Con este pago queda saldado. Queda pendiente de aplicarse a pedidos concretos desde el panel;
            la cuenta corriente ya lo refleja como abono.
          </p>
        ) : null}
      </main>
    </div>
  )
}
