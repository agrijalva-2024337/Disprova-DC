import { randomUUID } from 'node:crypto';
import { Prisma, type TipoMovimientoInventario } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import type { CreateBatchInput, CreateWarehouseInput, EntradaInput } from './inventory.schema.js';

/**
 * ÚNICA puerta de escritura de la tabla `stock` en todo el sistema.
 *
 * Ningún otro código —ni este módulo por fuera de registerMovement, ni ventas,
 * ni seeds de operación— debe llamar prisma.stock.update(), prisma.stock.create()
 * ni prisma.stock.upsert(). Cada cambio de existencia se hace aquí, en la misma
 * transacción que inserta el inventory_movement. La suma de movimientos es la
 * fuente de verdad; las columnas de stock solo son una caché de esa suma.
 */

type Tx = Prisma.TransactionClient;

export type RegisterMovementInput = {
  productId: number;
  warehouseId: number;
  batchId?: number | null;
  tipo: TipoMovimientoInventario;
  cantidad: string | number;
  referenciaTipo?: string | null;
  referenciaId?: string | null;
  userId: number;
};

const CONSUME_AVAILABLE = new Set<TipoMovimientoInventario>([
  'salida',
  'traslado_salida',
  'reserva',
  'merma',
]);

function deltas(tipo: TipoMovimientoInventario, cantidad: Prisma.Decimal) {
  const zero = new Prisma.Decimal(0);
  switch (tipo) {
    case 'entrada':
    case 'traslado_entrada':
      return { cantidad, reservada: zero };
    case 'salida':
    case 'traslado_salida':
    case 'merma':
      return { cantidad: cantidad.neg(), reservada: zero };
    case 'reserva':
      return { cantidad: zero, reservada: cantidad };
    case 'liberacion_reserva':
      return { cantidad: zero, reservada: cantidad.neg() };
    case 'ajuste':
      return { cantidad, reservada: zero };
    default:
      throw new AppError(`Tipo de movimiento no soportado: ${tipo}`, 400, 'INVALID_MOVEMENT');
  }
}

async function applyMovement(tx: Tx, input: RegisterMovementInput) {
  const batchId = input.batchId ?? null;
  const amount = new Prisma.Decimal(input.cantidad);
  if (input.tipo === 'ajuste') {
    if (amount.isZero()) {
      throw new AppError('El ajuste no puede ser cero', 422, 'INVALID_QUANTITY');
    }
  } else if (amount.lessThanOrEqualTo(0)) {
    throw new AppError('La cantidad del movimiento debe ser mayor a cero', 422, 'INVALID_QUANTITY');
  }

  const product = await tx.product.findUnique({ where: { id: input.productId } });
  if (!product) {
    throw new AppError('Producto no encontrado', 404, 'NOT_FOUND');
  }
  if (product.controlado && batchId === null) {
    throw new AppError(
      'Un producto controlado siempre requiere lote (batch_id) en el movimiento',
      422,
      'BATCH_REQUIRED',
    );
  }
  if (batchId !== null) {
    const batch = await tx.productBatch.findFirst({
      where: { id: batchId, productId: input.productId },
    });
    if (!batch) {
      throw new AppError('El lote no pertenece al producto', 422, 'INVALID_BATCH');
    }
  }

  if (batchId === null) {
    await tx.$queryRaw`
      SELECT id FROM stock
      WHERE product_id = ${input.productId}
        AND warehouse_id = ${input.warehouseId}
        AND batch_id IS NULL
      FOR UPDATE
    `;
  } else {
    await tx.$queryRaw`
      SELECT id FROM stock
      WHERE product_id = ${input.productId}
        AND warehouse_id = ${input.warehouseId}
        AND batch_id = ${batchId}
      FOR UPDATE
    `;
  }

  const existing = await tx.stock.findFirst({
    where: { productId: input.productId, warehouseId: input.warehouseId, batchId },
  });
  const onHand = existing ? new Prisma.Decimal(existing.cantidad) : new Prisma.Decimal(0);
  const reserved = existing ? new Prisma.Decimal(existing.cantidadReservada) : new Prisma.Decimal(0);
  const disponible = onHand.sub(reserved);

  if (CONSUME_AVAILABLE.has(input.tipo) && disponible.lessThan(amount)) {
    throw new AppError(
      `Stock insuficiente: disponible ${disponible.toString()}, se requieren ${amount.toString()}`,
      409,
      'INSUFFICIENT_STOCK',
    );
  }
  if (input.tipo === 'liberacion_reserva' && reserved.lessThan(amount)) {
    throw new AppError(
      `No hay reserva suficiente para liberar: reservado ${reserved.toString()}`,
      409,
      'INSUFFICIENT_STOCK',
    );
  }

  const delta = deltas(input.tipo, amount);
  const movement = await tx.inventoryMovement.create({
    data: {
      productId: input.productId,
      warehouseId: input.warehouseId,
      batchId,
      tipo: input.tipo,
      cantidad: amount,
      referenciaTipo: input.referenciaTipo,
      referenciaId: input.referenciaId,
      userId: input.userId,
    },
  });

  if (existing) {
    await tx.stock.update({
      where: { id: existing.id },
      data: {
        cantidad: onHand.add(delta.cantidad),
        cantidadReservada: reserved.add(delta.reservada),
      },
    });
  } else {
    await tx.stock.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        batchId,
        cantidad: delta.cantidad,
        cantidadReservada: delta.reservada,
      },
    });
  }

  return movement;
}

export async function registerMovement(input: RegisterMovementInput, tx?: Tx) {
  if (tx) {
    return applyMovement(tx, input);
  }
  return prisma.$transaction((inner) => applyMovement(inner, input));
}

export async function transferStock(input: {
  productId: number;
  warehouseIdOrigen: number;
  warehouseIdDestino: number;
  batchId?: number | null;
  cantidad: string | number;
  userId: number;
}) {
  if (input.warehouseIdOrigen === input.warehouseIdDestino) {
    throw new AppError('El origen y el destino del traslado deben ser distintos', 422, 'INVALID_TRANSFER');
  }
  const referenciaId = randomUUID();
  return prisma.$transaction(async (tx) => {
    const salida = await registerMovement(
      {
        productId: input.productId,
        warehouseId: input.warehouseIdOrigen,
        batchId: input.batchId,
        tipo: 'traslado_salida',
        cantidad: input.cantidad,
        referenciaTipo: 'traslado',
        referenciaId,
        userId: input.userId,
      },
      tx,
    );
    const entrada = await registerMovement(
      {
        productId: input.productId,
        warehouseId: input.warehouseIdDestino,
        batchId: input.batchId,
        tipo: 'traslado_entrada',
        cantidad: input.cantidad,
        referenciaTipo: 'traslado',
        referenciaId,
        userId: input.userId,
      },
      tx,
    );
    return { referenciaId, salida, entrada };
  });
}

export async function adjustStock(input: {
  productId: number;
  warehouseId: number;
  batchId?: number | null;
  cantidad: string | number;
  motivo: string;
  userId: number;
}) {
  return registerMovement({
    productId: input.productId,
    warehouseId: input.warehouseId,
    batchId: input.batchId,
    tipo: 'ajuste',
    cantidad: input.cantidad,
    referenciaTipo: 'motivo',
    referenciaId: input.motivo,
    userId: input.userId,
  });
}

export async function createWarehouse(input: CreateWarehouseInput) {
  if (input.tipo === 'vehiculo' && input.responsableUserId) {
    const existing = await prisma.warehouse.findFirst({
      where: {
        tipo: 'vehiculo',
        activo: true,
        responsableUserId: input.responsableUserId,
      },
    });
    if (existing) {
      throw new AppError('El usuario ya tiene un vehículo activo', 409, 'VEHICLE_ALREADY_ASSIGNED');
    }
  }

  return prisma.warehouse.create({
    data: {
      nombre: input.nombre,
      tipo: input.tipo,
      responsableUserId: input.responsableUserId ?? null,
      activo: true,
    },
  });
}

export async function createBatch(input: CreateBatchInput) {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) {
    throw new AppError('Producto no encontrado', 404, 'NOT_FOUND');
  }
  if (!product.controlado) {
    throw new AppError('Solo los productos controlados llevan lote', 422, 'NOT_CONTROLLED');
  }

  return prisma.productBatch.create({
    data: {
      productId: input.productId,
      lote: input.lote,
      fechaVencimiento: input.fechaVencimiento,
      costo: String(input.costo),
    },
  });
}

export async function receiveStock(input: EntradaInput, userId: number) {
  const bodega = await prisma.warehouse.findFirst({
    where: { tipo: 'bodega', activo: true, nombre: 'Bodega central' },
    orderBy: { id: 'asc' },
  });
  if (!bodega) {
    throw new AppError('No hay una bodega central activa para recibir la mercadería', 422, 'NO_CENTRAL_WAREHOUSE');
  }

  return registerMovement({
    productId: input.productId,
    warehouseId: bodega.id,
    batchId: input.batchId,
    tipo: 'entrada',
    cantidad: input.cantidad,
    referenciaTipo: 'entrada',
    referenciaId: 'bodega-central',
    userId,
  });
}

export async function listWarehouses() {
  return prisma.warehouse.findMany({
    where: { activo: true },
    orderBy: { id: 'asc' },
  });
}

export async function listStock(filters: {
  warehouseId?: number;
  productId?: number;
  soloDisponible?: boolean;
}) {
  const rows = await prisma.stock.findMany({
    where: {
      warehouseId: filters.warehouseId,
      productId: filters.productId,
    },
    include: {
      product: true,
      warehouse: true,
      batch: true,
    },
  });

  const visible = filters.soloDisponible
    ? rows.filter((row) => new Prisma.Decimal(row.cantidad).sub(row.cantidadReservada).greaterThan(0))
    : rows;

  visible.sort((a, b) => {
    if (a.productId !== b.productId) {
      return a.productId - b.productId;
    }
    const aExpiry = a.batch?.fechaVencimiento?.getTime() ?? Number.POSITIVE_INFINITY;
    const bExpiry = b.batch?.fechaVencimiento?.getTime() ?? Number.POSITIVE_INFINITY;
    return aExpiry - bExpiry;
  });

  return visible.map((row) => ({
    ...row,
    disponible: new Prisma.Decimal(row.cantidad).sub(row.cantidadReservada).toString(),
  }));
}

export async function listMovements(filters: {
  productId?: number;
  desde?: Date;
  hasta?: Date;
}) {
  return prisma.inventoryMovement.findMany({
    where: {
      productId: filters.productId,
      createdAt: {
        gte: filters.desde,
        lte: filters.hasta,
      },
    },
    include: { product: true, warehouse: true, batch: true },
    orderBy: { id: 'asc' },
  });
}
