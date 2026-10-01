/**
 * Control de cantidad del pedido en campo.
 *
 * Se usa en tres pantallas (tarjeta de producto, línea del pedido y entrega),
 * así que vive aparte: los botones miden 44 px para que se aprieten bien con
 * el pulgar y sin mirar, que es como trabaja el vendedor.
 */
export function Stepper({
  valor,
  onCambio,
  etiqueta,
  className = '',
}: {
  valor: number
  onCambio: (nuevo: number) => void
  /** Nombre del producto, para que el lector de pantalla diga qué suma. */
  etiqueta: string
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between gap-1 ${className}`}>
      <Boton
        onClick={() => onCambio(valor - 1)}
        etiqueta={`Quitar uno de ${etiqueta}`}
        signo="−"
      />
      <span
        className="min-w-[2ch] flex-1 text-center font-display text-base font-semibold tabular-nums text-ink"
        aria-live="polite"
      >
        {valor}
      </span>
      <Boton onClick={() => onCambio(valor + 1)} etiqueta={`Sumar uno de ${etiqueta}`} signo="+" />
    </div>
  )
}

function Boton({
  onClick,
  etiqueta,
  signo,
}: {
  onClick: () => void
  etiqueta: string
  signo: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={etiqueta}
      aria-label={etiqueta}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.625rem] border border-line bg-surface font-display text-xl font-semibold leading-none text-ink transition-colors hover:border-brand/40 hover:bg-brand-soft active:translate-y-px"
    >
      {signo}
    </button>
  )
}
