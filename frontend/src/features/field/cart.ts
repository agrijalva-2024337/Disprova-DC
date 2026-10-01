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

export function money(valor: number): number {
  return Math.round(valor * 100) / 100
}

/**
 * Totales del pedido.
 *
 * Se redondea igual que el backend: el IVA se calcula y redondea POR LÍNEA y
 * después se suma. Calcularlo sobre el subtotal completo daba centavos de
 * diferencia contra el total que devuelve el backend, y el vendedor ve cómo
 * el total cambia al confirmar.
 */
export function totales(lineas: CartLine[]) {
  const subtotal = money(lineas.reduce((suma, linea) => suma + linea.precio * linea.cantidad, 0))
  const impuesto = money(
    lineas.reduce((suma, linea) => suma + money(money(linea.precio * linea.cantidad) * 0.12), 0),
  )
  return { subtotal, impuesto, total: money(subtotal + impuesto) }
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
