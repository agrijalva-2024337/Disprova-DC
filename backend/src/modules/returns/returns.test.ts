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

async function deliveredOrder() {
  const { token, userId } = await loginAsAdmin();
  const sample = await prisma.client.findFirstOrThrow();
  const client = await prisma.client.create({
    data: {
      nombreComercial: `Devolucion ${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tipoNegocio: 'tienda',
      zoneId: sample.zoneId,
      ordenRuta: 5000 + Math.floor(Math.random() * 4000),
      direccion: 'Calle de devolucion',
      priceListId: sample.priceListId,
      limiteCredito: '5000.00',
      plazoDias: 15,
    },
  });
  const unit = await prisma.productUnit.findFirstOrThrow({
    where: { product: { sku: 'HIG-001' }, nombre: 'Unidad' },
  });
  const vehicle = await prisma.warehouse.findFirstOrThrow({
    where: { tipo: 'vehiculo', activo: true, responsableUserId: userId },
  });
  await registerMovement({
    productId: unit.productId,
    warehouseId: vehicle.id,
    tipo: 'entrada',
    cantidad: '10',
    userId,
    referenciaTipo: 'test',
    referenciaId: `return-stock-${client.id}`,
  });
  const auth = { Authorization: `Bearer ${token}` };
  const created = await request(app)
    .post('/api/orders')
    .set(auth)
    .send({
      clientId: client.id,
      canal: 'campo',
      condicionPago: 'contado',
      items: [{ productUnitId: unit.id, cantidad: '2' }],
    });
  expect(created.status).toBe(201);
  const confirmed = await request(app).post(`/api/orders/${created.body.id}/confirm`).set(auth);
  expect(confirmed.status).toBe(200);
  const delivered = await request(app)
    .post(`/api/orders/${created.body.id}/deliver`)
    .set(auth)
    .send({ items: [{ orderItemId: created.body.items[0].id, cantidadEntregada: '2' }] });
  expect(delivered.status).toBe(201);
  return { auth, client, vehicle, unit, orderItemId: created.body.items[0].id as number, orderId: created.body.id as number };
}

async function onHand(productId: number, warehouseId: number) {
  const row = await prisma.stock.findFirst({ where: { productId, warehouseId, batchId: null } });
  return new Prisma.Decimal(row?.cantidad ?? 0);
}

async function saldo(clientId: number) {
  const last = await prisma.accountMovement.findFirst({
    where: { clientId },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
  });
  return new Prisma.Decimal(last?.saldoResultante ?? 0);
}

describe('devoluciones', () => {
  it('no deja devolver más de lo entregado', async () => {
    const { auth, client, orderId, orderItemId } = await deliveredOrder();
    const response = await request(app).post('/api/returns').set(auth).send({
      clientId: client.id,
      orderId,
      motivo: 'Sobra',
      items: [{ orderItemId, cantidad: '3', destino: 'reingreso' }],
    });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('RETURN_EXCEEDS_DELIVERED');
  });

  it('reingresa al inventario la cantidad devuelta', async () => {
    const { auth, client, orderId, orderItemId, vehicle, unit } = await deliveredOrder();
    const before = await onHand(unit.productId, vehicle.id);
    const created = await request(app).post('/api/returns').set(auth).send({
      clientId: client.id,
      orderId,
      motivo: 'Buen estado',
      items: [{ orderItemId, cantidad: '1', destino: 'reingreso' }],
    });
    expect(created.status).toBe(201);
    const accepted = await request(app).post(`/api/returns/${created.body.id}/accept`).set(auth);
    expect(accepted.status).toBe(200);
    expect(accepted.body.estado).toBe('aceptada');
    const after = await onHand(unit.productId, vehicle.id);
    expect(after.toString()).toBe(before.add(1).toString());
  });

  it('la merma no vuelve al stock y sí abona la cuenta', async () => {
    const { auth, client, orderId, orderItemId, vehicle, unit } = await deliveredOrder();
    const beforeStock = await onHand(unit.productId, vehicle.id);
    const beforeSaldo = await saldo(client.id);
    const created = await request(app).post('/api/returns').set(auth).send({
      clientId: client.id,
      orderId,
      motivo: 'Dañado',
      items: [{ orderItemId, cantidad: '1', destino: 'merma' }],
    });
    expect(created.status).toBe(201);
    const accepted = await request(app).post(`/api/returns/${created.body.id}/accept`).set(auth);
    expect(accepted.status).toBe(200);
    expect((await onHand(unit.productId, vehicle.id)).toString()).toBe(beforeStock.toString());
    const movement = await prisma.accountMovement.findFirstOrThrow({
      where: { clientId: client.id, referenciaTipo: 'return', referenciaId: String(created.body.id) },
    });
    expect(movement.tipo).toBe('abono');
    expect(new Prisma.Decimal(movement.monto).equals('9.80')).toBe(true);
    expect((await saldo(client.id)).toString()).toBe(beforeSaldo.sub('9.80').toString());
  });

  it('rechazar no toca stock ni saldo', async () => {
    const { auth, client, orderId, orderItemId, vehicle, unit } = await deliveredOrder();
    const beforeStock = await onHand(unit.productId, vehicle.id);
    const beforeSaldo = await saldo(client.id);
    const created = await request(app).post('/api/returns').set(auth).send({
      clientId: client.id,
      orderId,
      motivo: 'No procede',
      items: [{ orderItemId, cantidad: '1', destino: 'reingreso' }],
    });
    expect(created.status).toBe(201);
    const rejected = await request(app).post(`/api/returns/${created.body.id}/reject`).set(auth);
    expect(rejected.status).toBe(200);
    expect(rejected.body.estado).toBe('rechazada');
    expect((await onHand(unit.productId, vehicle.id)).toString()).toBe(beforeStock.toString());
    expect((await saldo(client.id)).toString()).toBe(beforeSaldo.toString());
  });
});