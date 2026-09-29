import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { registerMovement } from '../inventory/inventory.service.js';

/**
 * Estos tests corren contra la base compartida. Sin limpiar, los clientes de
 * prueba quedan y `sales-territory.test.ts` —que exige que la zona de la
 * semana 1 tenga exactamente los 4 clientes del seed— falla según el orden
 * en que corren los archivos.
 */
const clientsCreados: number[] = [];
const usuariosCreados: number[] = [];
const lotesCreados: number[] = [];

afterEach(async () => {
  const ids = clientsCreados.splice(0, clientsCreados.length);
  if (ids.length === 0) {
    return;
  }
  // No se puede filtrar por la relación anidada `return: { order: ... }`
  // porque el nombre choca con la palabra reservada: se resuelve en dos pasos.
  const devoluciones = await prisma.return.findMany({
    where: { order: { clientId: { in: ids } } },
    select: { id: true },
  });
  const returnIds = devoluciones.map((row) => row.id);
  const pedidos = await prisma.order.findMany({
    where: { clientId: { in: ids } },
    select: { id: true },
  });
  // El rastro de auditoría no tiene llave foránea contra devoluciones ni
  // pedidos: se limpia por entidad+id, que es como lo escribió cada módulo.
  await prisma.auditLog.deleteMany({
    where: { entidad: 'Return', entidadId: { in: returnIds.map(String) } },
  });
  await prisma.auditLog.deleteMany({
    where: { entidad: 'Order', entidadId: { in: pedidos.map((row) => String(row.id)) } },
  });
  if (returnIds.length > 0) {
    await prisma.returnItem.deleteMany({ where: { returnId: { in: returnIds } } });
    await prisma.return.deleteMany({ where: { id: { in: returnIds } } });
  }
  const lotes = lotesCreados.splice(0, lotesCreados.length);
  if (lotes.length > 0) {
    await prisma.productBatch.deleteMany({ where: { id: { in: lotes } } });
  }
  await prisma.deliveryItem.deleteMany({ where: { delivery: { order: { clientId: { in: ids } } } } });
  await prisma.delivery.deleteMany({ where: { order: { clientId: { in: ids } } } });
  await prisma.orderItem.deleteMany({ where: { order: { clientId: { in: ids } } } });
  await prisma.order.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.accountMovement.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.client.deleteMany({ where: { id: { in: ids } } });
  const users = usuariosCreados.splice(0, usuariosCreados.length);
  if (users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  }
});

async function crearVendedor() {
  const role = await prisma.role.findFirstOrThrow({ where: { nombre: 'vendedor' } });
  const email = `devolucion-${Date.now()}@disprova.local`;
  const user = await prisma.user.create({
    data: {
      nombre: 'Vendedor devolucion',
      email,
      passwordHash: await bcrypt.hash('Vendedor123!', 10),
      roleId: role.id,
    },
  });
  usuariosCreados.push(user.id);
  const response = await request(app).post('/api/auth/login').send({
    email,
    password: 'Vendedor123!',
  });
  expect(response.status).toBe(200);
  return { token: response.body.accessToken as string, userId: user.id };
}

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
  clientsCreados.push(client.id);
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
  return { auth, userId, client, vehicle, unit, orderItemId: created.body.items[0].id as number, orderId: created.body.id as number };
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
    const { auth, userId, client, orderId, orderItemId, vehicle, unit } = await deliveredOrder();
    const before = await onHand(unit.productId, vehicle.id);
    const created = await request(app).post('/api/returns').set(auth).send({
      clientId: client.id,
      orderId,
      motivo: 'Buen estado',
      items: [{ orderItemId, cantidad: '1', destino: 'reingreso' }],
    });
    expect(created.status).toBe(201);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entidad: 'Return', entidadId: String(created.body.id), accion: 'create' },
    });
    expect(audit.userId).toBe(userId);
    expect((audit.datosDespues as { estado: string }).estado).toBe('pendiente');
    expect((audit.datosDespues as { motivo: string }).motivo).toBe('Buen estado');
    expect((audit.datosDespues as { items: Array<{ destino: string }> }).items[0].destino).toBe('reingreso');

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

  it('un vendedor ve la devolución que generó, con cliente, pedido, presentación y lote', async () => {
    const { client, orderId, orderItemId, unit } = await deliveredOrder();
    const seller = await crearVendedor();
    const sellerAuth = { Authorization: `Bearer ${seller.token}` };
    const lote = await prisma.productBatch.create({
      data: {
        productId: unit.productId,
        lote: `DEV-${Date.now()}`,
        fechaVencimiento: new Date('2027-12-31'),
      },
    });
    lotesCreados.push(lote.id);
    const created = await request(app).post('/api/returns').set(sellerAuth).send({
      clientId: client.id,
      orderId,
      motivo: 'Cambio',
      items: [{ orderItemId, cantidad: '1', destino: 'reingreso', batchId: lote.id }],
    });
    expect(created.status).toBe(201);

    const list = await request(app).get('/api/returns').query({ clientId: client.id }).set(sellerAuth);
    expect(list.status).toBe(200);
    expect(list.body.meta).toMatchObject({ total: 1, limit: 100, offset: 0, count: 1, hasMore: false });
    expect(list.body.data[0].client.nombreComercial).toBe(client.nombreComercial);
    expect(list.body.data[0].order.numero).toMatch(/^PED-/);

    const detail = await request(app).get(`/api/returns/${created.body.id}`).set(sellerAuth);
    expect(detail.status).toBe(200);
    expect(detail.body.estado).toBe('pendiente');
    expect(detail.body.items[0].orderItem.productUnit.nombre).toBe('Unidad');
    expect(detail.body.items[0].orderItem.productUnit.product.nombre).toBeTruthy();
    expect(detail.body.items[0].batch.lote).toBe(lote.lote);
  });

  it('filtra por estado y pagina como la auditoría', async () => {
    const { auth, client, orderId, orderItemId } = await deliveredOrder();
    const first = await request(app).post('/api/returns').set(auth).send({
      clientId: client.id,
      orderId,
      motivo: 'Primera',
      items: [{ orderItemId, cantidad: '1', destino: 'merma' }],
    });
    const second = await request(app).post('/api/returns').set(auth).send({
      clientId: client.id,
      orderId,
      motivo: 'Segunda',
      items: [{ orderItemId, cantidad: '1', destino: 'merma' }],
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const accepted = await request(app).post(`/api/returns/${first.body.id}/accept`).set(auth);
    expect(accepted.status).toBe(200);

    const pendientes = await request(app)
      .get('/api/returns')
      .query({ clientId: client.id, estado: 'pendiente' })
      .set(auth);
    expect(pendientes.status).toBe(200);
    expect(pendientes.body.data.map((row: { id: number }) => row.id)).toEqual([second.body.id]);

    const page = await request(app)
      .get('/api/returns')
      .query({ clientId: client.id, limit: 1, offset: 0 })
      .set(auth);
    expect(page.status).toBe(200);
    expect(page.body.meta).toMatchObject({ total: 2, limit: 1, offset: 0, count: 1, hasMore: true });
    expect(page.body.data[0].id).toBe(second.body.id);

    const next = await request(app)
      .get('/api/returns')
      .query({ clientId: client.id, limit: 1, offset: 1 })
      .set(auth);
    expect(next.body.data[0].id).toBe(first.body.id);
  });

  it('exige sesión y responde 404 si la devolución no existe', async () => {
    const anon = await request(app).get('/api/returns');
    expect(anon.status).toBe(401);

    const { token } = await loginAsAdmin();
    const missing = await request(app).get('/api/returns/999999999').set({ Authorization: `Bearer ${token}` });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });
});