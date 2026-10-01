/**
 * Tokens de marca compartidos.
 *
 * La tienda (features/store/theme.ts) y el panel (Tailwind) parten de la misma
 * paleta: sale del póster de marca, donde "DISPROVA" va en tinta y "GyG" en
 * rojo sangre. Aquí está en TypeScript para los estilos que no pasan por
 * clases de Tailwind (CSS modules, estilos en línea).
 */
export const brand = {
  /** Rojo del "GyG". */
  red: '#A3221C',
  /** Rojo pulsado, para hovers y bordes con más peso. */
  redDeep: '#7A1712',
  /** Rojo lavado, para fondos de alerta y chips. */
  redSoft: '#F6E7E5',
  /** Dorado de acento para cifras y separadores. */
  gold: '#B8873A',
  goldSoft: '#F3E9D8',
  /** Tinta del "DISPROVA". */
  ink: '#1C1512',
  inkSoft: '#3A2E27',
  /** Texto secundario. */
  muted: '#8A7F73',
  /** Fondo de papel. */
  parchment: '#FAF8F4',
  surface: '#FFFFFF',
  /** Bordes y divisores. */
  line: '#E8E1D6',
} as const

/** Archivo de la intro de marca en public/brand. */
export const brandIntro = {
  poster: '/brand/logo-reveal-poster.jpg',
  webm: '/brand/logo-reveal.webm',
  mp4: '/brand/logo-reveal.mp4',
} as const