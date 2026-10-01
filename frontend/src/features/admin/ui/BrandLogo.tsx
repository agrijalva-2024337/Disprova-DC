/**
 * Logo de Disprova GyG.
 *
 * No hay un archivo de logo vectorial en el repo: public/favicon.svg es el logo
 * por defecto de Vite. Como la marca es tipográfica (el póster de
 * public/brand muestra "DISPROVA" en tinta y "GyG" en rojo, ambos en la serif
 * Fraunces), se reconstruye aquí con texto, que además escala a cualquier
 * tamaño sin perder nitidez y respeta la fuente que ya carga index.html.
 */
import { brand } from '../../../shared/brand.ts'

const tamanos = {
  sm: { dis: 'text-[0.95rem]', gy: 'text-[1.3rem]', gap: '' },
  md: { dis: 'text-[1.2rem]', gy: 'text-[1.65rem]', gap: '' },
  lg: { dis: 'text-[1.9rem]', gy: 'text-[2.6rem]', gap: 'tracking-[0.18em]' },
} as const

export function BrandLogo({
  size = 'md',
  className = '',
}: {
  size?: keyof typeof tamanos
  className?: string
}) {
  const t = tamanos[size]

  return (
    <span className={`font-display leading-none select-none ${className}`}>
      <span
        className={`font-semibold ${t.dis} ${t.gap}`}
        style={{ color: brand.ink, fontVariationSettings: "'opsz' 120" }}
      >
        DISPROVA
      </span>
      <span
        className={`font-semibold italic ${t.gy}`}
        style={{ color: brand.red, fontVariationSettings: "'opsz' 144" }}
      >
        GyG
      </span>
    </span>
  )
}

/**
 * Isotipo para espacios estrechos (sidebar colapsado, favicon en la pestaña).
 * Mismo rojo y misma serif, solo "GyG".
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="font-display inline-flex items-center justify-center rounded-lg font-semibold italic text-white shadow-card"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(140deg, ${brand.red} 0%, ${brand.redDeep} 100%)`,
        fontSize: size * 0.44,
        letterSpacing: '-0.02em',
      }}
      aria-hidden="true"
    >
      GyG
    </span>
  )
}