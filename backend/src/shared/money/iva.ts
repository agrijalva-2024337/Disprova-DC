import { Prisma } from '@prisma/client';

/** 1 + 12%. El precio de venta ya incluye este IVA; no se vuelve a sumar. */
const DIVISOR_IVA = new Prisma.Decimal('1.12');

export function redondear(valor: Prisma.Decimal): Prisma.Decimal {
  return valor.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export type DesgloseIva = {
  /** Lo que paga el cliente. Ya trae el IVA. */
  total: Prisma.Decimal;
  /** Parte del total que es IVA. No se suma al total. */
  impuesto: Prisma.Decimal;
  /** Total sin el IVA. */
  subtotal: Prisma.Decimal;
};

/**
 * Separa el IVA de un importe que ya lo trae incluido.
 * impuesto = total - total / 1.12, redondeado a 2 decimales.
 * subtotal = total - impuesto.
 */
export function desgloseIva(totalConIva: Prisma.Decimal | string | number): DesgloseIva {
  const total = redondear(new Prisma.Decimal(totalConIva));
  const impuesto = redondear(total.sub(total.div(DIVISOR_IVA)));
  const subtotal = redondear(total.sub(impuesto));
  return { total, impuesto, subtotal };
}

/** Total de línea = precioUnitario × cantidad − descuento. Ese total ya incluye IVA. */
export function desgloseLinea(input: {
  precioUnitario: Prisma.Decimal | string | number;
  cantidad: Prisma.Decimal | string | number;
  descuento?: Prisma.Decimal | string | number;
}): DesgloseIva {
  const precioUnitario = new Prisma.Decimal(input.precioUnitario);
  const cantidad = new Prisma.Decimal(input.cantidad);
  const descuento = new Prisma.Decimal(input.descuento ?? 0);
  const total = redondear(precioUnitario.mul(cantidad).sub(descuento));
  return desgloseIva(total);
}

/**
 * Parte del total congelado de la línea (IVA incluido) que corresponde a una
 * cantidad. Sirve para entregar, facturar o devolver sin volver a leer el
 * precio vigente.
 */
export function importeIncluido(
  linea: {
    cantidad: Prisma.Decimal | string | number;
    totalLinea: Prisma.Decimal | string | number;
  },
  cantidadAplicada: Prisma.Decimal | string | number,
): Prisma.Decimal {
  const aplicada = new Prisma.Decimal(cantidadAplicada);
  if (aplicada.lessThanOrEqualTo(0)) {
    return new Prisma.Decimal(0);
  }
  const cantidad = new Prisma.Decimal(linea.cantidad);
  if (cantidad.lessThanOrEqualTo(0)) {
    return new Prisma.Decimal(0);
  }
  return redondear(new Prisma.Decimal(linea.totalLinea).mul(aplicada).div(cantidad));
}
