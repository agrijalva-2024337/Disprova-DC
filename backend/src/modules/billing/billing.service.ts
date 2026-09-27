import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/AppError.js';
import { importeEntregado, importeLineaEntregada } from '../sales/sales.service.js';
import { getFelProvider } from './providers/fel.provider.js';
import type { CreateInvoiceInput } from './billing.schema.js';

const FACTURABLE_STATES = ['entregado', 'entregado_parcial'] as const;

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function money(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export async function listInvoices(filtros: { estado?: 'pendiente_certificacion' | 'certificada' | 'error' }) {
  return prisma.invoice.findMany({
    where: { estado: filtros.estado },
    include: { order: { include: { client: true } } },
    orderBy: { id: 'desc' },
  });
}

export async function getInvoiceForOrder(orderId: number) {
  const invoice = await prisma.invoice.findUnique({
    where: { orderId },
    include: { order: true },
  });
  if (!invoice) {
    throw new AppError('El pedido no tiene factura', 404, 'NOT_FOUND');
  }
  return invoice;
}

/**
 * Emite la factura de un pedido entregado. El importe es lo REALMENTE
 * entregado (misma fórmula proporcional que el cargo de cobranza), no el
 * total del pedido: en una entrega parcial factura solo lo entregado.
 *
 * Si no hay certificador configurado la factura queda en
 * `pendiente_certificacion` y eso NO es un error: hoy no hay certificador
 * elegido. Solo queda en `error` cuando un proveedor real falla.
 */
export async function createInvoiceForOrder(
  orderId: number,
  input: CreateInvoiceInput,
  userId: number,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: true,
      items: { include: { deliveryItems: true, productUnit: { include: { product: true } } } },
    },
  });

  if (!order) {
    throw new AppError('Pedido no encontrado', 404, 'NOT_FOUND');
  }

  if (!(FACTURABLE_STATES as readonly string[]).includes(order.estado)) {
    throw new AppError(
      `Solo se puede facturar un pedido entregado o entregado a medias. Este está en estado "${order.estado}"`,
      422,
      'ORDER_NOT_DELIVERED',
    );
  }

  const existente = await prisma.invoice.findUnique({ where: { orderId: order.id } });
  if (existente) {
    throw new AppError('El pedido ya tiene factura', 409, 'ALREADY_INVOICED');
  }

  const lineas = order.items.map((item) => ({
    orderItemId: item.id,
    cantidadEntregada: item.deliveryItems.reduce(
      (sum, row) => sum.add(row.cantidadEntregada),
      new Prisma.Decimal(0),
    ),
  }));

  const total = money(importeEntregado(order.items, lineas));

  const serie = input.serie ?? env.fel.serie;

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        orderId: order.id,
        serie,
        total,
        estado: 'pendiente_certificacion',
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        entidad: 'Invoice',
        entidadId: String(created.id),
        accion: 'create',
        datosDespues: toJson({ orderId: order.id, serie, total: total.toFixed(2) }),
      },
    });
    return created;
  });

  const provider = getFelProvider();
  if (!provider.configured) {
    // Comportamiento esperado hoy: queda pendiente de certificar.
    return { invoice, certified: false as const };
  }

  const resultado = await provider.certify({
    serie: invoice.serie,
    numero: invoice.numero,
    total: total.toFixed(2),
    cliente: { nit: order.client.nit, nombre: order.client.nombreComercial },
    lineas: order.items
      .map((item) => {
        const entregada = item.deliveryItems.reduce(
          (sum, row) => sum.add(row.cantidadEntregada),
          new Prisma.Decimal(0),
        );
        if (entregada.lessThanOrEqualTo(0)) {
          return null;
        }
        return {
          sku: item.productUnit.product.sku,
          descripcion: item.productUnit.product.nombre,
          cantidad: entregada.toString(),
          precioUnitario: money(item.precioUnitario).toFixed(2),
          total: importeLineaEntregada(item, entregada).toFixed(2),
        };
      })
      .filter((linea): linea is NonNullable<typeof linea> => linea !== null),
  });

  if (!resultado.ok) {
    // Hay proveedor configurado y falló: acá sí es un error de verdad.
    const fallida = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { estado: 'error', error: resultado.error },
    });
    return { invoice: fallida, certified: false as const };
  }

  const certificada = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      estado: 'certificada',
      uuidFel: resultado.uuid,
      fechaCertificacion: new Date(),
      xmlUrl: resultado.xmlUrl,
      pdfUrl: resultado.pdfUrl,
      error: null,
    },
  });

  return { invoice: certificada, certified: true as const };
}