import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { postMovement } from '../collections/account.service.js';
import { registerMovement } from '../inventory/inventory.service.js';
import { AppError } from '../../shared/errors/AppError.js';
import type { CreateOrderInput, DeliverOrderInput } from './sales.schema.js';

/** IVA copiado en cada línea al crear el pedido. No se vuelve a leer después. */
const IVA_RATE = new Prisma.Decimal('0.12');

const OPEN_CREDIT_STATES = ['pendiente', 'confirmado'] as const;

function money(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function todayDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * La reserva y la salida del pedido salen del warehouse tipo vehiculo
 * cuyo responsable es el vendedor (orders.user_id). Si tiene más de uno
 * activo, se usa el de menor id. La bodega central no se toca: el
 * producto del pedido ya debe estar cargado en el vehículo.
 */
async function sellerVehicle(tx: Prisma.TransactionClient, userId: number) {
  const warehouse = await tx.warehouse.findFirst({
    where: { tipo: 'vehiculo', activo: true, responsableUserId: userId },
    orderBy: { id: 'asc' },
  });
  if (!warehouse) {
    throw new AppError(
      'El vendedor no tiene un vehículo activo para mover el inventario del pedido',
      422,
      'NO_VEHICLE_WAREHOUSE',
    );
  }
  return warehouse;
}

async function currentPrice(priceListId: number, productUnitId: number) {
  return prisma.priceListItem.findFirst({
    where: {
      priceListId,
      productUnitId,
      vigenteDesde: { lte: new Date() },
    },
    orderBy: { vigenteDesde: 'desc' },
  });
}

export async function listOrders(filters: { clientId?: number; userId?: number; pendientes?: boolean }) {
  const start = todayDate();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return prisma.order.findMany({
    where: {
      clientId: filters.clientId,
      ...(filters.pendientes
        ? {
            userId: filters.userId,
            estado: { in: ['confirmado', 'entregado_parcial'] },
            createdAt: { gte: start, lt: end },
          }
        : {}),
    },
    include: {
      client: true,
      items: { include: { productUnit: { include: { product: true } }, deliveryItems: true } },
    },
    orderBy: { id: 'desc' },
  });
}

export async function getOrder(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: true,
      items: { include: { productUnit: { include: { product: true } }, deliveryItems: true } },
    },
  });
  if (!order) {
    throw new AppError('Pedido no encontrado', 404, 'NOT_FOUND');
  }
  return order;
}

export async function createOrder(input: CreateOrderInput, userId: number) {
  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) {
    throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
  }
  if (!client.priceListId) {
    throw new AppError('El cliente no tiene lista de precios', 422, 'NO_PRICE_LIST');
  }

  const lines = [];
  for (const line of input.items) {
    const unit = await prisma.productUnit.findUnique({ where: { id: line.productUnitId } });
    if (!unit) {
      throw new AppError('Presentación no encontrada', 404, 'NOT_FOUND');
    }
    const price = await currentPrice(client.priceListId, unit.id);
    if (!price) {
      throw new AppError(
        `La lista de precios del cliente no tiene un precio vigente para la presentación ${unit.nombre}`,
        422,
        'NO_PRICE',
      );
    }
    const cantidad = new Prisma.Decimal(line.cantidad);
    const precioUnitario = money(new Prisma.Decimal(price.precio));
    const descuento = new Prisma.Decimal(0);
    const base = money(precioUnitario.mul(cantidad).sub(descuento));
    const impuesto = money(base.mul(IVA_RATE));
    const totalLinea = money(base.add(impuesto));
    lines.push({
      productUnitId: unit.id,
      cantidad,
      precioUnitario,
      descuento,
      impuesto,
      totalLinea,
    });
  }

  const subtotal = money(lines.reduce((sum, line) => sum.add(line.precioUnitario.mul(line.cantidad).sub(line.descuento)), new Prisma.Decimal(0)));
  const descuento = new Prisma.Decimal(0);
  const impuesto = money(lines.reduce((sum, line) => sum.add(line.impuesto), new Prisma.Decimal(0)));
  const total = money(subtotal.sub(descuento).add(impuesto));

  return prisma.order.create({
    data: {
      clientId: client.id,
      userId,
      canal: input.canal,
      estado: 'borrador',
      condicionPago: input.condicionPago,
      subtotal,
      descuento,
      impuesto,
      total,
      items: { create: lines },
    },
    include: { items: true },
  });
}

async function lockOrder(tx: Prisma.TransactionClient, orderId: number) {
  const rows = await tx.$queryRaw<Array<{ id: number; client_id: number }>>`
    SELECT id, client_id FROM orders WHERE id = ${orderId} FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new AppError('Pedido no encontrado', 404, 'NOT_FOUND');
  }
  await tx.$queryRaw`SELECT id FROM clients WHERE id = ${rows[0].client_id} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM order_items WHERE order_id = ${orderId} FOR UPDATE`;
}

export async function confirmOrder(orderId: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        client: true,
        items: { include: { productUnit: { include: { product: true } } } },
      },
    });
    if (!order) {
      throw new AppError('Pedido no encontrado', 404, 'NOT_FOUND');
    }
    if (order.estado !== 'borrador') {
      throw new AppError('Solo se puede confirmar un pedido en borrador', 422, 'INVALID_ORDER_STATE');
    }

    if (order.condicionPago === 'credito') {
      // Comprometido = deuda ya cargada (último saldo de account_movements)
      // más el total de otros pedidos a crédito en pendiente o confirmado,
      // que todavía no se entregaron y por eso aún no son un cargo.
      // Este pedido no entra en esa suma: se compara aparte contra el límite.
      const lastMovement = await tx.accountMovement.findFirst({
        where: { clientId: order.clientId },
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      });
      const saldo = new Prisma.Decimal(lastMovement?.saldoResultante ?? 0);
      const open = await tx.order.aggregate({
        where: {
          clientId: order.clientId,
          id: { not: order.id },
          condicionPago: 'credito',
          estado: { in: [...OPEN_CREDIT_STATES] },
        },
        _sum: { total: true },
      });
      const comprometido = saldo.add(open._sum.total ?? 0);
      const limite = new Prisma.Decimal(order.client.limiteCredito);
      const disponible = money(limite.sub(comprometido));
      if (new Prisma.Decimal(order.total).greaterThan(disponible)) {
        throw new AppError(
          `Límite de crédito superado. Disponible ${disponible.toFixed(2)}, el pedido es ${money(new Prisma.Decimal(order.total)).toFixed(2)}`,
          409,
          'CREDIT_LIMIT_EXCEEDED',
        );
      }
    }

    const warehouse = await sellerVehicle(tx, order.userId);
    for (const item of order.items) {
      const baseQty = new Prisma.Decimal(item.cantidad).mul(item.productUnit.factor);
      let batchId: number | null = null;
      if (item.productUnit.product.controlado) {
        const batches = await tx.stock.findMany({
          where: { productId: item.productUnit.productId, warehouseId: warehouse.id, batchId: { not: null } },
          include: { batch: true },
        });
        const eligible = batches
          .filter((row) => new Prisma.Decimal(row.cantidad).sub(row.cantidadReservada).greaterThanOrEqualTo(baseQty))
          .sort((a, b) => {
            const aTime = a.batch?.fechaVencimiento?.getTime() ?? Number.POSITIVE_INFINITY;
            const bTime = b.batch?.fechaVencimiento?.getTime() ?? Number.POSITIVE_INFINITY;
            return aTime - bTime;
          });
        if (!eligible[0]?.batchId) {
          throw new AppError(
            `Stock insuficiente: disponible 0, se requieren ${baseQty.toString()}`,
            409,
            'INSUFFICIENT_STOCK',
          );
        }
        batchId = eligible[0].batchId;
      }

      await registerMovement(
        {
          productId: item.productUnit.productId,
          warehouseId: warehouse.id,
          batchId,
          tipo: 'reserva',
          cantidad: baseQty.toString(),
          referenciaTipo: 'order',
          referenciaId: String(order.id),
          userId,
        },
        tx,
      );
    }

    return tx.order.update({
      where: { id: order.id },
      data: { estado: 'confirmado' },
      include: { items: true },
    });
  });
}

/**
 * Entrega parcial: solo se libera y se descarga lo entregado en esta visita.
 * Lo que falta sigue reservado para una segunda entrega. No se libera el faltante.
 *
 * Por cada cantidad entregada, primero liberacion_reserva y después salida.
 * La salida exige disponible; si la reserva siguiera tomada, el disponible
 * sería cero y la salida no podría hacerse. Ambas van en la misma transacción.
 * La cantidad de inventario es la de la presentación multiplicada por su factor.
 */
export async function deliverOrder(orderId: number, input: DeliverOrderInput, userId: number) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { productUnit: { include: { product: true } }, deliveryItems: true } },
      },
    });
    if (!order) {
      throw new AppError('Pedido no encontrado', 404, 'NOT_FOUND');
    }
    if (order.estado !== 'confirmado' && order.estado !== 'entregado_parcial') {
      throw new AppError('El pedido no está listo para entregar', 422, 'INVALID_ORDER_STATE');
    }

    const warehouse = await sellerVehicle(tx, order.userId);
    const requested = new Map(input.items.map((item) => [item.orderItemId, item]));
    const deliveryLines: Array<{
      orderItemId: number;
      cantidadEntregada: Prisma.Decimal;
      batchId: number | null;
    }> = [];

    for (const item of order.items) {
      const request = requested.get(item.id);
      const entregada = new Prisma.Decimal(request?.cantidadEntregada ?? 0);
      const yaEntregada = item.deliveryItems.reduce(
        (sum, row) => sum.add(row.cantidadEntregada),
        new Prisma.Decimal(0),
      );
      const pendiente = new Prisma.Decimal(item.cantidad).sub(yaEntregada);
      if (entregada.greaterThan(pendiente)) {
        throw new AppError('No se puede entregar más de lo pendiente de la línea', 422, 'INVALID_QUANTITY');
      }
      if (entregada.greaterThan(0)) {
        const batchId = request?.batchId ?? null;
        const baseQty = entregada.mul(item.productUnit.factor);
        await registerMovement(
          {
            productId: item.productUnit.productId,
            warehouseId: warehouse.id,
            batchId,
            tipo: 'liberacion_reserva',
            cantidad: baseQty.toString(),
            referenciaTipo: 'order',
            referenciaId: String(order.id),
            userId,
          },
          tx,
        );
        await registerMovement(
          {
            productId: item.productUnit.productId,
            warehouseId: warehouse.id,
            batchId,
            tipo: 'salida',
            cantidad: baseQty.toString(),
            referenciaTipo: 'order',
            referenciaId: String(order.id),
            userId,
          },
          tx,
        );
      }
      deliveryLines.push({ orderItemId: item.id, cantidadEntregada: entregada, batchId: request?.batchId ?? null });
    }

    const completo = order.items.every((item) => {
      const ya = item.deliveryItems.reduce((sum, row) => sum.add(row.cantidadEntregada), new Prisma.Decimal(0));
      const ahora = requested.get(item.id);
      const entregada = new Prisma.Decimal(ahora?.cantidadEntregada ?? 0);
      return ya.add(entregada).greaterThanOrEqualTo(item.cantidad);
    });

    const delivery = await tx.delivery.create({
      data: {
        orderId: order.id,
        userId,
        fecha: todayDate(),
        estado: completo ? 'completa' : 'parcial',
        recibidoPor: input.recibidoPor,
        observaciones: input.observaciones,
        items: {
          create: deliveryLines.map((line) => ({
            orderItemId: line.orderItemId,
            cantidadEntregada: line.cantidadEntregada,
            batchId: line.batchId,
          })),
        },
      },
      include: { items: true },
    });

    if (order.condicionPago === 'credito') {
      // Cargo de esta visita: precioUnitario * cantidad entregada ahora
      // más la parte proporcional del impuesto de la línea. No usa el total
      // del pedido cuando la entrega es parcial.
      let cargo = new Prisma.Decimal(0);
      for (const line of deliveryLines) {
        if (line.cantidadEntregada.lessThanOrEqualTo(0)) {
          continue;
        }
        const item = order.items.find((row) => row.id === line.orderItemId);
        if (!item || new Prisma.Decimal(item.cantidad).lessThanOrEqualTo(0)) {
          continue;
        }
        const share = line.cantidadEntregada.div(item.cantidad);
        cargo = cargo.add(
          money(
            new Prisma.Decimal(item.precioUnitario)
              .mul(line.cantidadEntregada)
              .add(new Prisma.Decimal(item.impuesto).mul(share)),
          ),
        );
      }
      cargo = money(cargo);
      if (cargo.greaterThan(0)) {
        await postMovement(tx, {
          clientId: order.clientId,
          tipo: 'cargo',
          referenciaTipo: 'delivery',
          referenciaId: String(delivery.id),
          monto: cargo,
          fecha: new Date(),
          userId,
        });
      }
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: { estado: completo ? 'entregado' : 'entregado_parcial' },
      include: { items: true },
    });

    return { order: updated, delivery };
  });
}

export async function cancelOrder(orderId: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { productUnit: { include: { product: true } } } } },
    });
    if (!order) {
      throw new AppError('Pedido no encontrado', 404, 'NOT_FOUND');
    }
    if (order.estado !== 'borrador' && order.estado !== 'confirmado') {
      throw new AppError('Solo se puede cancelar un pedido en borrador o confirmado', 422, 'INVALID_ORDER_STATE');
    }

    if (order.estado === 'confirmado') {
      const warehouse = await sellerVehicle(tx, order.userId);
      for (const item of order.items) {
        const baseQty = new Prisma.Decimal(item.cantidad).mul(item.productUnit.factor);
        const reserved = await tx.inventoryMovement.findMany({
          where: {
            referenciaTipo: 'order',
            referenciaId: String(order.id),
            productId: item.productUnit.productId,
            tipo: 'reserva',
          },
        });
        const batchId = reserved.find((row) => row.batchId !== null)?.batchId ?? null;
        await registerMovement(
          {
            productId: item.productUnit.productId,
            warehouseId: warehouse.id,
            batchId,
            tipo: 'liberacion_reserva',
            cantidad: baseQty.toString(),
            referenciaTipo: 'order',
            referenciaId: String(order.id),
            userId,
          },
          tx,
        );
      }
    }

    return tx.order.update({
      where: { id: order.id },
      data: { estado: 'cancelado' },
      include: { items: true },
    });
  });
}
