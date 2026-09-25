import { Prisma } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
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
});
