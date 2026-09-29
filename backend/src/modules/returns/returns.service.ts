import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { writeAudit } from '../../shared/audit/writeAudit.js';
import { postMovement } from '../collections/account.service.js';
import { registerMovement } from '../inventory/inventory.service.js';
import { LIMITE_POR_DEFECTO, type CreateReturnInput, type ListReturnsQuery } from './returns.schema.js';

function money(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

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

const listInclude = {
  client: { select: { nombreComercial: true } },
  order: { select: { numero: true } },
} as const;

const detailInclude = {
  client: { select: { nombreComercial: true } },
  order: { select: { numero: true } },
  items: {
    include: {
      orderItem: {
        include: {
          productUnit: {
            select: {
              nombre: true,
              product: { select: { nombre: true } },
            },
          },
        },
      },
      batch: true,
    },
  },
} as const;

export async function listReturns(query: ListReturnsQuery) {
  const where: Prisma.ReturnWhereInput = {};
  if (query.estado) {
    where.estado = query.estado;
  }
  if (query.clientId) {
    where.clientId = query.clientId;
  }

  const limit = query.limit ?? LIMITE_POR_DEFECTO;
  const offset = query.offset ?? 0;

  const [total, rows] = await Promise.all([
    prisma.return.count({ where }),
    prisma.return.findMany({
      where,
      include: listInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    data: rows,
    meta: {
      total,
      limit,
      offset,
      count: rows.length,
      hasMore: offset + rows.length < total,
    },
  };
}

export async function getReturn(id: number) {
  const record = await prisma.return.findUnique({
    where: { id },
    include: detailInclude,
  });
  if (!record) {
    throw new AppError('Devolución no encontrada', 404, 'NOT_FOUND');
  }
  return record;
}

export async function createReturn(input: CreateReturnInput, userId: number) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      items: { include: { deliveryItems: true } },
    },
  });
  if (!order || order.clientId !== input.clientId) {
    throw new AppError('El pedido no pertenece a ese cliente', 422, 'INVALID_ORDER');
  }

  for (const line of input.items) {
    const item = order.items.find((row) => row.id === line.orderItemId);
    if (!item) {
      throw new AppError('La línea no pertenece al pedido', 422, 'INVALID_ORDER_ITEM');
    }
    const entregada = item.deliveryItems.reduce(
      (sum, row) => sum.add(row.cantidadEntregada),
      new Prisma.Decimal(0),
    );
    if (new Prisma.Decimal(line.cantidad).greaterThan(entregada)) {
      throw new AppError('No se puede devolver más de lo entregado en la línea', 422, 'RETURN_EXCEEDS_DELIVERED');
    }
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.return.create({
      data: {
        clientId: input.clientId,
        orderId: input.orderId,
        userId,
        fecha: new Date(),
        motivo: input.motivo,
        estado: 'pendiente',
        total: new Prisma.Decimal(0),
        items: {
          create: input.items.map((line) => ({
            orderItemId: line.orderItemId,
            cantidad: line.cantidad,
            batchId: line.batchId ?? null,
            destino: line.destino,
          })),
        },
      },
      include: { items: true },
    });

    await writeAudit(tx, {
      userId,
      entidad: 'Return',
      entidadId: String(created.id),
      accion: 'create',
      datosDespues: {
        clientId: created.clientId,
        orderId: created.orderId,
        estado: created.estado,
        motivo: created.motivo,
        items: created.items.map((line) => ({
          orderItemId: line.orderItemId,
          cantidad: new Prisma.Decimal(line.cantidad).toString(),
          destino: line.destino,
        })),
      },
    });

    return created;
  });
}

export async function acceptReturn(returnId: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.return.findUnique({
      where: { id: returnId },
      include: {
        order: true,
        items: { include: { orderItem: { include: { productUnit: { include: { product: true } } } } } },
      },
    });
    if (!record) {
      throw new AppError('Devolución no encontrada', 404, 'NOT_FOUND');
    }
    if (record.estado !== 'pendiente') {
      throw new AppError('Solo se puede aceptar una devolución pendiente', 409, 'INVALID_RETURN_STATE');
    }

    const warehouse = await sellerVehicle(tx, record.order.userId);
    let total = new Prisma.Decimal(0);

    for (const line of record.items) {
      const cantidad = new Prisma.Decimal(line.cantidad);
      const share = cantidad.div(line.orderItem.cantidad);
      total = total.add(
        money(
          new Prisma.Decimal(line.orderItem.precioUnitario)
            .mul(cantidad)
            .add(new Prisma.Decimal(line.orderItem.impuesto).mul(share)),
        ),
      );

      if (line.destino !== 'reingreso') {
        continue;
      }

      const baseQty = cantidad.mul(line.orderItem.productUnit.factor);
      await registerMovement(
        {
          productId: line.orderItem.productUnit.productId,
          warehouseId: warehouse.id,
          batchId: line.batchId,
          tipo: 'entrada',
          cantidad: baseQty.toString(),
          referenciaTipo: 'return',
          referenciaId: String(record.id),
          userId,
        },
        tx,
      );
    }

    total = money(total);
    if (total.greaterThan(0)) {
      await postMovement(tx, {
        clientId: record.clientId,
        tipo: 'abono',
        referenciaTipo: 'return',
        referenciaId: String(record.id),
        monto: total,
        fecha: new Date(),
        userId,
      });
    }

    return tx.return.update({
      where: { id: record.id },
      data: { estado: 'aceptada', total },
      include: { items: true },
    });
  });
}

export async function rejectReturn(returnId: number) {
  const record = await prisma.return.findUnique({ where: { id: returnId } });
  if (!record) {
    throw new AppError('Devolución no encontrada', 404, 'NOT_FOUND');
  }
  if (record.estado !== 'pendiente') {
    throw new AppError('Solo se puede rechazar una devolución pendiente', 409, 'INVALID_RETURN_STATE');
  }
  return prisma.return.update({
    where: { id: record.id },
    data: { estado: 'rechazada' },
    include: { items: true },
  });
}
