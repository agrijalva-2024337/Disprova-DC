import { aCentavos, desdeCentavos, totalesCentavos } from '../../shared/money/iva.ts'

/**
 * Estado y cuentas del pedido que se lleva el vendedor.
 *
 * Vive aparte de la pantalla porque lo comparten la grilla de productos, la
 * columna de escritorio y la hoja del teléfono: si el total viviera en cada
 * copia, dosRenderizados desincronizados mostrarían cifras distintas.
 */

export type CartLine = {
  productUnitId: number
  productId: number
  productName: string
  unitName: string
  /** Foto principal del producto, para la línea del pedido. */
  imagen: string | null
  precio: number
  cantidad: number
}

/**
 * Totales del pedido.
 *
 * El precio ya trae el IVA. El total es la suma de las líneas; el impuesto
 * se muestra aparte y no se vuelve a sumar. Las cuentas van en centavos,
 * igual que el backend, para que el total no cambie al confirmar.
 */
export function totales(lineas: CartLine[]) {
  const centavos = totalesCentavos(
    lineas.map((linea) => ({
      precioCentavos: aCentavos(linea.precio),
      cantidad: linea.cantidad,
    })),
  )
  return {
    subtotal: desdeCentavos(centavos.subtotal),
    impuesto: desdeCentavos(centavos.impuesto),
    total: desdeCentavos(centavos.total),
  }
}

/**
 * Clave de idempotencia del pedido.
 *
 * `crypto.randomUUID` solo existe en contextos seguros: si la app se abre por
 * la IP de la oficina (http://192.168.x.x) no está y reventaba con
 * "crypto.randomUUID is not a function" justo al crear el pedido. El respaldo
 * no criptográfico es aceptable acá porque la clave solo evita que un doble
 * toque abra dos pedidos del mismo formulario.
 */
export function claveIdempotencia(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
