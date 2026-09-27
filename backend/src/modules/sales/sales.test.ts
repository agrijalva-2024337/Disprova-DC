import { Prisma } from '@prisma/client';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { registerMovement } from '../inventory/inventory.service.js';

async function loginAsAdmin() {
  const response = await request(app).post('/api/auth/login').send({
    email: 'admin@disprova.local',
    password: 'Admin123!',
  });
  expect(response.status).toBe(200);
  return {
    token: response.body.accessToken as string,
    userId: response.body.user.id as number,
  };
}

async function vehicleOf(userId: number) {
  return prisma.warehouse.findFirstOrThrow({
    where: { tipo: 'vehiculo', activo: true, responsableUserId: userId },
    orderBy: { id: 'asc' },
  });
}

async function unitOf(sku: string, nombre: string) {
  const product = await prisma.product.findFirstOrThrow({
    where: { sku },
    include: { units: true },
  });
  const unit = product.units.find((item) => item.nombre === nombre);
  expect(unit).toBeTruthy();
  return { product, unit: unit! };
}

async function stockRow(productId: number, warehouseId: number) {
  return prisma.stock.findFirst({
    where: { productId, warehouseId, batchId: null },
  });
}

async function reservas(orderId: number) {
  return prisma.inventoryMovement.count({
    where: { referenciaTipo: 'order', referenciaId: String(orderId), tipo: 'reserva' },
  });
}

describe('orders', () => {
  it('no confirma un crédito que supera el límite y no reserva stock', async () => {
    const { token, userId } = await loginAsAdmin();
    const client = await prisma.client.findFirstOrThrow();
    const previous = client.limiteCredito.toString();
    const { unit } = await unitOf('HIG-001', 'Unidad');
    await prisma.client.update({ where: { id: client.id }, data: { limiteCredito: '0.00' } });

    try {
      const created = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientId: client.id,
          canal: 'campo',
          condicionPago: 'credito',
          items: [{ productUnitId: unit.id, cantidad: '1' }],
        });
      expect(created.status).toBe(201);

      const confirmed = await request(app)
        .post(`/api/orders/${created.body.id}/confirm`)
        .set('Authorization', `Bearer ${token}`);

      expect(confirmed.status).toBe(409);
      expect(confirmed.body.error.code).toBe('CREDIT_LIMIT_EXCEEDED');
      expect(confirmed.body.error.message).toContain('Disponible');

      const order = await prisma.order.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(order.estado).toBe('borrador');
      expect(await reservas(order.id)).toBe(0);
      expect(userId).toBeGreaterThan(0);
    } finally {
      await prisma.client.update({ where: { id: client.id }, data: { limiteCredito: previous } });
    }
  });

  it('no reserva ninguna línea si una de tres no tiene stock', async () => {
    const { token, userId } = await loginAsAdmin();
    const vehicle = await vehicleOf(userId);
    const client = await prisma.client.findFirstOrThrow();
    const hig = await unitOf('HIG-001', 'Unidad');
    const beb = await unitOf('BEB-001', 'Unidad');
    const med = await unitOf('MED-001', 'Blister x10');

    await registerMovement({
      productId: hig.product.id,
      warehouseId: vehicle.id,
      tipo: 'entrada',
      cantidad: '30',
      userId,
      referenciaTipo: 'test',
      referenciaId: 'sales-stock-hig',
    });
    await registerMovement({
      productId: beb.product.id,
      warehouseId: vehicle.id,
      tipo: 'entrada',
      cantidad: '30',
      userId,
      referenciaTipo: 'test',
      referenciaId: 'sales-stock-beb',
    });

    const beforeHig = (await stockRow(hig.product.id, vehicle.id))?.cantidadReservada.toString();
    const beforeBeb = (await stockRow(beb.product.id, vehicle.id))?.cantidadReservada.toString();

    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client.id,
        canal: 'campo',
        condicionPago: 'contado',
        items: [
          { productUnitId: hig.unit.id, cantidad: '2' },
          { productUnitId: beb.unit.id, cantidad: '2' },
          { productUnitId: med.unit.id, cantidad: '500' },
        ],
      });
    expect(created.status).toBe(201);

    const confirmed = await request(app)
      .post(`/api/orders/${created.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`);
    expect(confirmed.status).toBe(409);
    expect(confirmed.body.error.code).toBe('INSUFFICIENT_STOCK');

    const order = await prisma.order.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(order.estado).toBe('borrador');
    expect(await reservas(order.id)).toBe(0);
    expect((await stockRow(hig.product.id, vehicle.id))?.cantidadReservada.toString()).toBe(beforeHig);
    expect((await stockRow(beb.product.id, vehicle.id))?.cantidadReservada.toString()).toBe(beforeBeb);
  });

  it('entrega parcial deja lo no entregado reservado', async () => {
    const { token, userId } = await loginAsAdmin();
    const vehicle = await vehicleOf(userId);
    const client = await prisma.client.findFirstOrThrow();
    const hig = await unitOf('HIG-001', 'Unidad');

    await registerMovement({
      productId: hig.product.id,
      warehouseId: vehicle.id,
      tipo: 'entrada',
      cantidad: '10',
      userId,
      referenciaTipo: 'test',
      referenciaId: 'sales-partial',
    });

    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client.id,
        canal: 'campo',
        condicionPago: 'contado',
        items: [{ productUnitId: hig.unit.id, cantidad: '10' }],
      });
    expect(created.status).toBe(201);
    const confirmed = await request(app)
      .post(`/api/orders/${created.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`);
    expect(confirmed.status).toBe(200);

    const reserved = await stockRow(hig.product.id, vehicle.id);
    const onHand = new Prisma.Decimal(reserved!.cantidad);
    const reservedQty = new Prisma.Decimal(reserved!.cantidadReservada);

    const delivered = await request(app)
      .post(`/api/orders/${created.body.id}/deliver`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ orderItemId: created.body.items[0].id, cantidadEntregada: '4' }],
      });
    expect(delivered.status).toBe(201);
    expect(delivered.body.order.estado).toBe('entregado_parcial');

    const after = await stockRow(hig.product.id, vehicle.id);
    expect(new Prisma.Decimal(after!.cantidad).toString()).toBe(onHand.sub(4).toString());
    expect(new Prisma.Decimal(after!.cantidadReservada).toString()).toBe(reservedQty.sub(4).toString());
    expect(new Prisma.Decimal(after!.cantidadReservada).greaterThan(0)).toBe(true);
  });

  it('cancelar un pedido confirmado libera toda la reserva', async () => {
    const { token, userId } = await loginAsAdmin();
    const vehicle = await vehicleOf(userId);
    const client = await prisma.client.findFirstOrThrow();
    const beb = await unitOf('BEB-001', 'Unidad');

    await registerMovement({
      productId: beb.product.id,
      warehouseId: vehicle.id,
      tipo: 'entrada',
      cantidad: '8',
      userId,
      referenciaTipo: 'test',
      referenciaId: 'sales-cancel',
    });
    const before = new Prisma.Decimal((await stockRow(beb.product.id, vehicle.id))?.cantidadReservada ?? 0);

    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client.id,
        canal: 'campo',
        condicionPago: 'contado',
        items: [{ productUnitId: beb.unit.id, cantidad: '5' }],
      });
    expect(created.status).toBe(201);
    const confirmed = await request(app)
      .post(`/api/orders/${created.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`);
    expect(confirmed.status).toBe(200);

    const during = new Prisma.Decimal((await stockRow(beb.product.id, vehicle.id))!.cantidadReservada);
    expect(during.toString()).toBe(before.add(5).toString());

    const cancelled = await request(app)
      .post(`/api/orders/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.estado).toBe('cancelado');

    const after = new Prisma.Decimal((await stockRow(beb.product.id, vehicle.id))!.cantidadReservada);
    expect(after.toString()).toBe(before.toString());
  });

  it('la misma idempotencyKey dos veces crea un solo pedido', async () => {
    const { token, userId } = await loginAsAdmin();
    const client = await prisma.client.findFirstOrThrow();
    const { unit } = await unitOf('HIG-001', 'Unidad');
    const idempotencyKey = `idem-${Date.now()}`;
    const body = {
      clientId: client.id,
      canal: 'campo',
      condicionPago: 'contado',
      idempotencyKey,
      items: [{ productUnitId: unit.id, cantidad: '1' }],
    };

    const first = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.total).toBe(first.body.total);

    const count = await prisma.order.count({
      where: { clientId: client.id, userId, idempotencyKey },
    });
    expect(count).toBe(1);
  });
});

describe('auditoría de pedidos', () => {
  const orderIds: number[] = [];

  afterEach(async () => {
    const ids = orderIds.splice(0, orderIds.length);
    if (ids.length === 0) {
      return;
    }
    await prisma.auditLog.deleteMany({ where: { entidad: 'Order', entidadId: { in: ids.map(String) } } });
    await prisma.deliveryItem.deleteMany({ where: { delivery: { orderId: { in: ids } } } });
    await prisma.delivery.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  });

  async function crearOrden(token: string, clientId: number, unitId: number) {
    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId,
        canal: 'campo',
        condicionPago: 'contado',
        items: [{ productUnitId: unitId, cantidad: '2' }],
      });
    expect(created.status).toBe(201);
    orderIds.push(created.body.id);
    return created;
  }

  async function auditDe(orderId: number, accion: string) {
    return prisma.auditLog.findFirstOrThrow({
      where: { entidad: 'Order', entidadId: String(orderId), accion },
    });
  }

  it('deja rastro al crear y al confirmar', async () => {
    const { token, userId } = await loginAsAdmin();
    const vehicle = await vehicleOf(userId);
    const client = await prisma.client.findFirstOrThrow();
    const { product, unit } = await unitOf('HIG-001', 'Unidad');
    await registerMovement({
      productId: product.id,
      warehouseId: vehicle.id,
      tipo: 'entrada',
      cantidad: '20',
      userId,
      referenciaTipo: 'test',
      referenciaId: 'audit-sales',
    });

    const created = await crearOrden(token, client.id, unit.id);

    const create = await auditDe(created.body.id, 'create');
    expect(create.userId).toBe(userId);
    expect((create.datosDespues as { estado: string }).estado).toBe('borrador');

    const confirmed = await request(app)
      .post(`/api/orders/${created.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`);
    expect(confirmed.status).toBe(200);

    const confirm = await auditDe(created.body.id, 'confirm');
    expect(confirm.userId).toBe(userId);
    expect((confirm.datosAntes as { estado: string }).estado).toBe('borrador');
    expect((confirm.datosDespues as { estado: string }).estado).toBe('confirmado');
  });

  it('deja rastro al entregar y guarda el cargo de la visita', async () => {
    const { token, userId } = await loginAsAdmin();
    const vehicle = await vehicleOf(userId);
    const client = await prisma.client.findFirstOrThrow();
    const { product, unit } = await unitOf('HIG-001', 'Unidad');
    await registerMovement({
      productId: product.id,
      warehouseId: vehicle.id,
      tipo: 'entrada',
      cantidad: '20',
      userId,
      referenciaTipo: 'test',
      referenciaId: 'audit-sales',
    });

    const created = await crearOrden(token, client.id, unit.id);
    await request(app).post(`/api/orders/${created.body.id}/confirm`).set('Authorization', `Bearer ${token}`);

    const delivered = await request(app)
      .post(`/api/orders/${created.body.id}/deliver`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ orderItemId: created.body.items[0].id, cantidadEntregada: '1' }] });
    expect(delivered.status).toBe(201);

    const deliver = await auditDe(created.body.id, 'deliver');
    expect(deliver.userId).toBe(userId);
    const antes = deliver.datosAntes as { estado: string };
    const despues = deliver.datosDespues as { estado: string; deliveryId: number; lineas: unknown[] };
    expect(antes.estado).toBe('confirmado');
    expect(despues.estado).toBe('entregado_parcial');
    expect(despues.deliveryId).toBeGreaterThan(0);
    expect(despues.lineas).toHaveLength(1);
  });

  it('deja rastro al cancelar con el estado anterior', async () => {
    const { token, userId } = await loginAsAdmin();
    const vehicle = await vehicleOf(userId);
    const client = await prisma.client.findFirstOrThrow();
    const { product, unit } = await unitOf('BEB-001', 'Unidad');
    await registerMovement({
      productId: product.id,
      warehouseId: vehicle.id,
      tipo: 'entrada',
      cantidad: '20',
      userId,
      referenciaTipo: 'test',
      referenciaId: 'audit-sales-cancel',
    });

    const created = await crearOrden(token, client.id, unit.id);
    await request(app).post(`/api/orders/${created.body.id}/confirm`).set('Authorization', `Bearer ${token}`);

    const cancelled = await request(app)
      .post(`/api/orders/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancelled.status).toBe(200);

    const cancel = await auditDe(created.body.id, 'cancel');
    expect(cancel.userId).toBe(userId);
    expect((cancel.datosAntes as { estado: string }).estado).toBe('confirmado');
    expect((cancel.datosDespues as { estado: string }).estado).toBe('cancelado');
  });
});
