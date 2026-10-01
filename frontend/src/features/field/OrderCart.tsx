import type { ReactNode } from 'react'
import type { CartLine } from './cart.ts'
import { quetzales } from './format.ts'
import { Stepper } from './Stepper.tsx'

/**
 * El pedido en curso: lo que pidió, cuánto suma y con qué se paga.
 *
 * Es presentacional a propósito. La misma pieza se monta en dos lugares según el
 * ancho — columna fija en escritorio y hoja inferior en el teléfono — y el
 * estado vive en la pantalla, no acá, para que las dos copias nunca se
 * desincronicen.
 */
export function OrderCart({
  lineas,
  onCantidad,
  onVaciar,
  subtotal,
  impuesto,
  total,
  condicion,
  onCondicion,
  onConfirmar,
  pendiente,
  className = '',
}: {
  lineas: CartLine[]
  onCantidad: (linea: CartLine, nueva: number) => void
  onVaciar: () => void
  subtotal: number
  impuesto: number
  total: number
  condicion: 'contado' | 'credito'
  onCondicion: (valor: 'contado' | 'credito') => void
  onConfirmar: () => void
  pendiente: boolean
  className?: string
}) {
  const articulos = lineas.reduce((suma, linea) => suma + linea.cantidad, 0)

  return (
    <section
      className={`flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card ${className}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-display text-base font-semibold text-ink">
          Pedido
          {articulos > 0 ? (
            <span className="ml-1.5 text-sm font-normal text-muted">
              {articulos} {articulos === 1 ? 'artículo' : 'artículos'}
            </span>
          ) : null}
        </h2>
        {lineas.length > 0 ? (
          <button
            type="button"
            onClick={onVaciar}
            className="rounded-[0.5rem] px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-brand-soft hover:text-brand"
          >
            Vaciar
          </button>
        ) : null}
      </header>

      {lineas.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">
          Todavía no pediste nada. Apretá <span className="font-semibold text-ink">+</span> en las
          tarjetas de arriba.
        </p>
      ) : (
        <ul className="divide-y divide-line/70">
          {lineas.map((linea) => (
            <li key={linea.productUnitId} className="flex items-center gap-2.5 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{linea.productName}</span>
                <span className="block truncate text-xs text-muted">
                  {linea.unitName} · {quetzales(linea.precio)}
                </span>
              </span>
              <Stepper
                valor={linea.cantidad}
                etiqueta={`${linea.productName} ${linea.unitName}`}
                onCambio={(nuevo) => onCantidad(linea, nuevo)}
                className="w-[8.5rem] shrink-0"
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto space-y-2 border-t border-line px-4 py-3">
        <Row etiqueta="Subtotal" valor={quetzales(subtotal)} />
        <Row etiqueta="IVA 12%" valor={quetzales(impuesto)} />
        <div className="flex items-baseline justify-between gap-2 border-t border-line pt-2">
          <span className="font-display text-sm font-semibold text-ink">Total</span>
          <span className="font-display text-xl font-semibold tabular-nums text-ink">
            {quetzales(total)}
          </span>
        </div>

        <div className="flex gap-2 pt-1" role="group" aria-label="Condición de pago">
          <Condicion
            activo={condicion === 'contado'}
            onClick={() => onCondicion('contado')}
            texto="Contado"
          />
          <Condicion
            activo={condicion === 'credito'}
            onClick={() => onCondicion('credito')}
            texto="Crédito"
          />
        </div>

        <button
          type="button"
          onClick={onConfirmar}
          disabled={lineas.length === 0 || pendiente}
          className="flex h-12 w-full items-center justify-center rounded-[0.625rem] bg-brand text-base font-semibold text-white transition-colors hover:bg-brand-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendiente ? 'Confirmando…' : 'Confirmar pedido'}
        </button>
      </div>
    </section>
  )
}

function Row({ etiqueta, valor, children }: { etiqueta: string; valor?: string; children?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted">{etiqueta}</span>
      {valor ? <span className="tabular-nums text-ink-soft">{valor}</span> : children}
    </div>
  )
}

function Condicion({
  activo,
  onClick,
  texto,
}: {
  activo: boolean
  onClick: () => void
  texto: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`h-10 flex-1 rounded-[0.625rem] text-sm font-medium transition-colors ${
        activo ? 'bg-ink text-parchment' : 'border border-line bg-parchment text-ink-soft'
      }`}
    >
      {texto}
    </button>
  )
}
