import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { postMovement } from '../collections/account.service.js';
import { registerMovement } from '../inventory/inventory.service.js';
import { AppError } from '../../shared/errors/AppError.js';
import { writeAudit } from '../../shared/audit/writeAudit.js';
import type { CreateOrderInput, DeliverOrderInput } from './sales.schema.js';

/** IVA copiado en cada línea al crear el pedido. No se vuelve a leer después. */
const IVA_RATE = new Prisma.Decimal('0.12');

const OPEN_CREDIT_STATES = ['pendiente', 'confirmado'] as const;

function money(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function todayDate() {
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

/**
 * Precio vigente de una presentación en una lista de precios: el ítem más
 * reciente cuyo `vigenteDesde` ya pasó. Lo usan tanto el pedido de campo
 * (createOrder) como el catálogo público por token.
 */
export async function currentPrice(priceListId: number, productUnitId: number) {
  return prisma.priceListItem.findFirst({
    where: {
      priceListId,
      productUnitId,
      vigenteDesde: { lte: new Date() },
    },
    orderBy: { vigenteDesde: 'desc' },
  });
}

/**
 * Importe de UNA línea según lo realmente entregado: precioUnitario x
 * cantidad entregada más la parte proporcional del impuesto de la línea.
 * No usa el total del pedido, así que una entrega parcial vale solo lo
 * entregado. Es la misma fórmula que usa el cargo de cobranza al entregar.
 */
export function importeLineaEntregada(
  item: { cantidad: Prisma.Decimal; precioUnitario: Prisma.Decimal; impuesto: Prisma.Decimal },
  cantidadEntregada: Prisma.Decimal,
): Prisma.Decimal {
  if (cantidadEntregada.lessThanOrEqualTo(0)) {
    return new Prisma.Decimal(0);
  }
  const cantidad = new Prisma.Decimal(item.cantidad);
  if (cantidad.lessThanOrEqualTo(0)) {
    return new Prisma.Decimal(0);
  }

  const share = cantidadEntregada.div(cantidad);
  return money(
    new Prisma.Decimal(item.precioUnitario)
      .mul(cantidadEntregada)
      .add(new Prisma.Decimal(item.impuesto).mul(share)),
  );
}

export type LineaEntregada = { orderItemId: number; cantidadEntregada: Prisma.Decimal };

/** Suma de lo entregado. Lo comparten el cargo de cobranza y la factura. */
export function importeEntregado(
  items: Array<{
    id: number;
    cantidad: Prisma.Decimal;
    precioUnitario: Prisma.Decimal;
    impuesto: Prisma.Decimal;
  }>,
  lines: LineaEntregada[],
): Prisma.Decimal {
  return money(
    lines.reduce((sum, line) => {
      const item = items.find((row) => row.id === line.orderItemId);
      return item ? sum.add(importeLineaEntregada(item, line.cantidadEntregada)) : sum;
    }, new Prisma.Decimal(0)),
  );
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

const orderWithItems = { items: true } as const;

function idempotencySince() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

async function existingIdempotentOrder(clientId: number, userId: number, idempotencyKey: string) {
  return prisma.order.findFirst({
    where: {
      clientId,
      userId,
      idempotencyKey,
      createdAt: { gte: idempotencySince() },
    },
    include: orderWithItems,
  });
}

export async function createOrder(input: CreateOrderInput, userId: number) {
  if (input.idempotencyKey) {
    const existing = await existingIdempotentOrder(input.clientId, userId, input.idempotencyKey);
    if (existing) {
      return { order: existing, created: false as const };
    }
  }

  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) {
    throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
  }
  if (!client.priceListId) {
    throw new AppError('El cliente no tiene lista de precios', 422, 'NO_PRICE_LIST');
  }

  const lines: Array<{
    productUnitId: number;
    cantidad: Prisma.Decimal;
    precioUnitario: Prisma.Decimal;
    descuento: Prisma.Decimal;
    impuesto: Prisma.Decimal;
    totalLinea: Prisma.Decimal;
  }> = [];
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

  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          clientId: client.id,
          userId,
          canal: input.canal,
          estado: 'borrador',
          condicionPago: input.condicionPago,
          idempotencyKey: input.idempotencyKey ?? null,
          subtotal,
          descuento,
          impuesto,
          total,
          items: { create: lines },
        },
        include: orderWithItems,
      });
      await writeAudit(tx, {
        userId,
        entidad: 'Order',
        entidadId: String(created.id),
        accion: 'create',
        datosDespues: {
          clientId: created.clientId,
          canal: created.canal,
          estado: created.estado,
          condicionPago: created.condicionPago,
          total: money(new Prisma.Decimal(created.total)).toFixed(2),
          lineas: created.items.length,
        },
      });
      return created;
    });
    return { order, created: true as const };
  } catch (error) {
    if (
      input.idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await existingIdempotentOrder(input.clientId, userId, input.idempotencyKey);
      if (existing) {
        return { order: existing, created: false as const };
      }
    }
    throw error;
  }
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

      if (item.productUnit.product.controlado) {
        // FEFO de verdad: reparte la cantidad entre los lotes por fecha de
        // vencimiento, en lugar de exigir que UN solo lote cubra todo. Antes
        // se filtraba con `disponible >= baseQty`, así que 5 unidades en un
        // lote que vence mañana y 5 en otro que vence en tres meses no
        // reservaban nada aunque juntas cubrieran las 10.
        const reservas = await reservarFEFO(tx, {
          productId: item.productUnit.productId,
          warehouseId: warehouse.id,
          cantidad: baseQty,
          orderItemId: item.id,
          orderId: order.id,
          userId,
        });

        for (const reserva of reservas) {
          await registerMovement(
            {
              productId: item.productUnit.productId,
              warehouseId: warehouse.id,
              batchId: reserva.batchId,
              tipo: 'reserva',
              cantidad: reserva.cantidad.toString(),
              referenciaTipo: 'order',
              referenciaId: String(order.id),
              userId,
            },
            tx,
          );
        }
        continue;
      }

      await registerMovement(
        {
          productId: item.productUnit.productId,
          warehouseId: warehouse.id,
          batchId: null,
          tipo: 'reserva',
          cantidad: baseQty.toString(),
          referenciaTipo: 'order',
          referenciaId: String(order.id),
          userId,
        },
        tx,
      );
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: { estado: 'confirmado' },
      include: { items: true },
    });
    await writeAudit(tx, {
      userId,
      entidad: 'Order',
      entidadId: String(order.id),
      accion: 'confirm',
      datosAntes: { estado: order.estado },
      datosDespues: { estado: updated.estado, total: money(new Prisma.Decimal(updated.total)).toFixed(2) },
    });
    return updated;
  });
}

/** Fin de día en Guatemala (UTC-6). Un lote con esta fecha ya no se despacha. */
function venceHoyOAntes(fecha: Date | null | undefined) {
  if (!fecha) {
    return false;
  }
  const hoy = new Date();
  const cierre = new Date(
    Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + 1),
  );
  return fecha.getTime() < cierre.getTime();
}

export type ReservaFEFO = { batchId: number; cantidad: Prisma.Decimal };

/**
 * FEFO real: reparte la cantidad entre los lotes disponibles por fecha de
 * vencimiento ascendente y deja registrado qué lote se reservó para la línea.
 *
 * El reparto entre varios lotes es lo que faltaba: la versión anterior exigía
 * que un único lote cubriera toda la cantidad, así que el producto se
 * rechazaba aunque la bodega tuviera la suma repartida entre dos lotes.
 *
 * Un lote sin fecha de vencimiento va al final, nunca antes que uno que vence:
 * en un medicamento sin fecha conocida no hay garantía de que sirva, pero
 * tampoco hay motivo para preferirlo sobre un lote vigente.
 */
export async function reservarFEFO(
  tx: Prisma.TransactionClient,
  input: {
    productId: number;
    warehouseId: number;
    cantidad: Prisma.Decimal;
    orderItemId: number;
    orderId: number;
    userId: number;
  },
): Promise<ReservaFEFO[]> {
  const filas = await tx.stock.findMany({
    where: { productId: input.productId, warehouseId: input.warehouseId, batchId: { not: null } },
    include: { batch: true },
  });

  const candidatos = filas
    .map((row) => ({
      batchId: row.batchId as number,
      disponible: new Prisma.Decimal(row.cantidad).sub(row.cantidadReservada),
      vence: row.batch?.fechaVencimiento ?? null,
    }))
    .filter((row) => row.disponible.greaterThan(0))
    .filter((row) => !venceHoyOAntes(row.vence))
    .sort((a, b) => {
      if (!a.vence && !b.vence) return a.batchId - b.batchId;
      if (!a.vence) return 1;
      if (!b.vence) return -1;
      return a.vence.getTime() - b.vence.getTime();
    });

  let restante = input.cantidad;
  const reservas: ReservaFEFO[] = [];

  for (const lote of candidatos) {
    if (restante.lessThanOrEqualTo(0)) break;
    const tomar = Prisma.Decimal.min(lote.disponible, restante);
    reservas.push({ batchId: lote.batchId, cantidad: tomar });
    restante = restante.sub(tomar);
  }

  if (restante.greaterThan(0)) {
    throw new AppError(
      `Stock insuficiente: faltan ${restante.toString()} unidades de ${input.productId}`,
      409,
      'INSUFFICIENT_STOCK',
    );
  }

  // La reserva queda escrita en order_item_batches. Antes se descartaba y la
  // entrega tomaba el lote del body del vendedor, lo que rompía la
  // trazabilidad de medicamentos y hacía que liberacion_reserva pudiera
  // consumir la reserva de otro pedido sobre ese lote.
  for (const reserva of reservas) {
    await tx.orderItemBatch.upsert({
      where: { orderItemId_batchId: { orderItemId: input.orderItemId, batchId: reserva.batchId } },
      create: {
        orderItemId: input.orderItemId,
        batchId: reserva.batchId,
        cantidad: reserva.cantidad,
        vigente: true,
      },
      update: { cantidad: reserva.cantidad, vigente: true },
    });
  }

  return reservas;
}

/**
 * Entrega lo que la línea tiene reservado, repartiendo entre los lotes que el
 * FEFO eligió y marcándolos como ya descargados.
 *
 * Por cada lote consumido hace `liberacion_reserva` y después `salida`, en ese
 * orden: la salida exige disponible, y si la reserva siguiera tomada el
 * disponible sería cero. Las dos van en la misma transacción.
 */
async function consumeReservas(
  tx: Prisma.TransactionClient,
  input: {
    orderItemId: number;
    productId: number;
    warehouseId: number;
    cantidad: Prisma.Decimal;
    orderId: number;
    userId: number;
  },
): Promise<ReservaFEFO[]> {
  const reservas = await tx.orderItemBatch.findMany({
    where: { orderItemId: input.orderItemId, vigente: true },
    include: { batch: true },
    orderBy: { id: 'asc' },
  });

  if (reservas.length === 0) {
    throw new AppError(
      'La línea no tiene lotes reservados: el pedido no fue confirmado',
      422,
      'NO_BATCH_RESERVED',
    );
  }

  let restante = input.cantidad;
  const consumidas: ReservaFEFO[] = [];

  for (const reserva of reservas) {
    if (restante.lessThanOrEqualTo(0)) break;

    // Un lote que venció entre la confirmación y la entrega no se despacha:
    // es riesgo sanitario y legal. La reserva sigue viva para otro día.
    if (venceHoyOAntes(reserva.batch?.fechaVencimiento)) {
      throw new AppError(
        `El lote ${reserva.batch?.lote ?? reserva.batchId} está vencido y no puede entregarse`,
        422,
        'BATCH_EXPIRED',
      );
    }

    const disponible = new Prisma.Decimal(reserva.cantidad);
    const tomar = Prisma.Decimal.min(disponible, restante);

    for (const tipo of ['liberacion_reserva', 'salida'] as const) {
      await registerMovement(
        {
          productId: input.productId,
          warehouseId: input.warehouseId,
          batchId: reserva.batchId,
          tipo,
          cantidad: tomar.toString(),
          referenciaTipo: 'order',
          referenciaId: String(input.orderId),
          userId: input.userId,
        },
        tx,
      );
    }

    const restanteEnLote = disponible.sub(tomar);
    await tx.orderItemBatch.update({
      where: { id: reserva.id },
      data: { vigente: restanteEnLote.greaterThan(0) },
    });

    consumidas.push({ batchId: reserva.batchId, cantidad: tomar });
    restante = restante.sub(tomar);
  }

  if (restante.greaterThan(0)) {
    throw new AppError(
      `No hay reserva suficiente para entregar: faltan ${restante.toString()} unidades`,
      409,
      'INSUFFICIENT_RESERVED_STOCK',
    );
  }

  return consumidas;
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
        const baseQty = entregada.mul(item.productUnit.factor);

        if (item.productUnit.product.controlado) {
          // Se entrega lo que el pedido reservó, no lo que el vendedor escribió
          // en el body. El FEFO se decidió al confirmar y ya quedó escrito;
          // releerlo aquí sería permitir que la entrega elija otro lote y que
          // `liberacion_reserva` consuma la reserva de otro pedido.
          const reservations = await consumeReservas(tx, {
            orderItemId: item.id,
            productId: item.productUnit.productId,
            warehouseId: warehouse.id,
            cantidad: baseQty,
            orderId: order.id,
            userId,
          });
          deliveryLines.push({
            orderItemId: item.id,
            cantidadEntregada: entregada,
            // Una línea puede repartirse entre varios lotes: se guarda el
            // primero, que es el que el FEFO eligió antes.
            batchId: reservations[0]?.batchId ?? null,
          });
          continue;
        }

        const batchId = request?.batchId ?? null;
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
        deliveryLines.push({ orderItemId: item.id, cantidadEntregada: entregada, batchId });
      } else {
        deliveryLines.push({ orderItemId: item.id, cantidadEntregada: entregada, batchId: null });
      }
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
      // Cargo de esta visita sobre lo REALMENTE entregado: la fórmula vive
      // en importeEntregado y la comparte también la facturación.
      const cargo = importeEntregado(order.items, deliveryLines);
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

    await writeAudit(tx, {
      userId,
      entidad: 'Order',
      entidadId: String(order.id),
      accion: 'deliver',
      datosAntes: { estado: order.estado },
      datosDespues: {
        estado: updated.estado,
        deliveryId: delivery.id,
        tipoEntrega: delivery.estado,
        recibidoPor: input.recibidoPor,
        lineas: deliveryLines.map((line) => ({
          orderItemId: line.orderItemId,
          cantidadEntregada: line.cantidadEntregada.toString(),
        })),
        cargo: order.condicionPago === 'credito' ? importeEntregado(order.items, deliveryLines).toFixed(2) : null,
      },
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
        const controladas = await tx.orderItemBatch.findMany({
          where: { orderItemId: item.id, vigente: true },
          orderBy: { id: 'asc' },
        });

        if (controladas.length > 0) {
          // Se libera lote por lote lo que el FEFO repartió. Tomar solo el
          // primero dejaba las reservas de los otros lotes tomadas para
          // siempre: el producto quedaba inexistente en la bodega con el
          // pedido ya cancelado.
          for (const reserva of controladas) {
            await registerMovement(
              {
                productId: item.productUnit.productId,
                warehouseId: warehouse.id,
                batchId: reserva.batchId,
                tipo: 'liberacion_reserva',
                cantidad: new Prisma.Decimal(reserva.cantidad).toString(),
                referenciaTipo: 'order',
                referenciaId: String(order.id),
                userId,
              },
              tx,
            );
            await tx.orderItemBatch.update({
              where: { id: reserva.id },
              data: { vigente: false },
            });
          }
          continue;
        }

        await registerMovement(
          {
            productId: item.productUnit.productId,
            warehouseId: warehouse.id,
            batchId: null,
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

    const updated = await tx.order.update({
      where: { id: order.id },
      data: { estado: 'cancelado' },
      include: { items: true },
    });
    await writeAudit(tx, {
      userId,
      entidad: 'Order',
      entidadId: String(order.id),
      accion: 'cancel',
      datosAntes: { estado: order.estado },
      datosDespues: { estado: updated.estado, total: money(new Prisma.Decimal(updated.total)).toFixed(2) },
    });
    return updated;
  });
}
