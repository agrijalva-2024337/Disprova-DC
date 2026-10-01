import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro'
type Tamano = 'sm' | 'md'

const variantes: Record<Variante, string> = {
  // El rojo de marca es la acción principal; se reserva para una por pantalla.
  primario:
    'bg-brand text-white shadow-lift hover:bg-brand-deep active:translate-y-px disabled:bg-brand/40',
  secundario:
    'bg-surface text-ink border border-line hover:border-brand/40 hover:bg-brand-soft/50 active:translate-y-px',
  fantasma: 'bg-transparent text-ink-soft hover:bg-brand-soft/60 active:translate-y-px',
  peligro: 'bg-surface text-brand border border-brand/30 hover:bg-brand-soft active:translate-y-px',
}

const tamanos: Record<Tamano, string> = {
  sm: 'h-8 px-3 text-[0.8125rem] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-[0.625rem]',
}

export function Button({
  variante = 'secundario',
  tamano = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  tamano?: Tamano
  children: ReactNode
}) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none ${variantes[variante]} ${tamanos[tamano]} ${className}`}
    >
      {children}
    </button>
  )
}