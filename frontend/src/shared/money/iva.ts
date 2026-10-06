/**
 * Mismas cuentas que el backend, en centavos enteros.
 * El precio ya trae el IVA: el total de la línea es precio × cantidad.
 * impuesto = total − total / 1.12, redondeado half-up al centavo.
 */

const NUMERADOR_IVA = 12
const DENOMINADOR_IVA = 112

export function aCentavos(quetzales: number): number {
  return Math.round(quetzales * 100)
}

export function desdeCentavos(centavos: number): number {
  return centavos / 100
}

/** División entera con redondeo half-up. Solo importes positivos. */
function dividirHalfUp(numerador: number, denominador: number): number {
  return Math.floor((numerador + Math.floor(denominador / 2)) / denominador)
}

export function desgloseCentavos(totalCentavos: number): {
  total: number
  impuesto: number
  subtotal: number
} {
  const total = Math.round(totalCentavos)
  const impuesto = dividirHalfUp(total * NUMERADOR_IVA, DENOMINADOR_IVA)
  return { total, impuesto, subtotal: total - impuesto }
}

export function desgloseLineaCentavos(
  precioCentavos: number,
  cantidad: number,
  descuentoCentavos = 0,
): { total: number; impuesto: number; subtotal: number } {
  return desgloseCentavos(precioCentavos * cantidad - descuentoCentavos)
}

export function totalesCentavos(
  lineas: Array<{ precioCentavos: number; cantidad: number; descuentoCentavos?: number }>,
): { total: number; impuesto: number; subtotal: number } {
  let total = 0
  let impuesto = 0
  for (const linea of lineas) {
    const desglose = desgloseLineaCentavos(
      linea.precioCentavos,
      linea.cantidad,
      linea.descuentoCentavos ?? 0,
    )
    total += desglose.total
    impuesto += desglose.impuesto
  }
  return { total, impuesto, subtotal: total - impuesto }
}
