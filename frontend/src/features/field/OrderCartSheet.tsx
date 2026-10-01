import { useState } from 'react'
import type { CartLine } from './cart.ts'
import { quetzales } from './format.ts'
import { OrderCart } from './OrderCart.tsx'

/**
 * El pedido en el teléfono: una barra fija con el total que sube y baja, y un
 * toque abre la hoja con el detalle.
 *
 * Se muestra siempre, incluso vacía, para que el vendedor sepa dónde está el
 * total sin tener que buscarlo. Ocupa el ancho de la pantalla pero vive dentro
 * de `max-w-md`, igual que la navegación: en una laptop se lee como el panel
 * angosto de una app móvil y no como una barra estirada de 1.900 px.
 */
export function OrderCartSheet(props: ParametrosOrderCart) {
  const [abierto, setAbierto] = useState(false)
  const articulos = props.lineas.reduce((suma, linea) => suma + linea.cantidad, 0)

  return (
    <>
      {abierto ? (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-ink/45 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Cerrar el pedido"
            className="flex-1"
            onClick={() => setAbierto(false)}
          />
          <div className="mx-auto w-full max-w-md animate-fade-up rounded-t-3xl bg-parchment p-3 pb-4">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
            <OrderCart {...props} />
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="mt-2 h-11 w-full rounded-[0.625rem] text-sm font-medium text-muted"
            >
              Seguir pedindo
            </button>
          </div>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-[3.6rem] z-20 px-2 lg:hidden">
          <div className="mx-auto w-full max-w-md">
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="flex h-14 w-full items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 shadow-lift"
            >
              <span className="min-w-0 text-left">
                <span className="block text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted">
                  {articulos > 0
                    ? `${articulos} ${articulos === 1 ? 'artículo' : 'artículos'}`
                    : 'Pedido vacío'}
                </span>
                <span className="block truncate text-sm text-ink-soft">
                  {props.lineas[0]?.productName ?? 'Apretá + para agregar'}
                  {props.lineas.length > 1 ? ` y ${props.lineas.length - 1} más` : ''}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-display text-base font-semibold tabular-nums text-ink">
                  {quetzales(props.total)}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-muted"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 15 6-6 6 6" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

type ParametrosOrderCart = {
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
}
