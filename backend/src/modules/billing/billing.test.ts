import { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { registerMovement } from '../inventory/inventory.service.js';

async function loginAsAdmin() {
  const response = await request(app).post('/api/auth/login').send({
    email: 'admin@disprova.local',
    password: 'Admin123!',
  });
  expect(response.status).toBe(200);
  return { token: response.body.accessToken as string, userId: response.body.user.id as number };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Limpia todo lo que crean estos tests: corren contra la base compartida. */
const creados = { clients: [] as number[] };

afterEach(async () => {
  const { clients } = creados;
  creados.clients = [];
  if (clients.length === 0) {
    return;
  }
  await prisma.invoice.deleteMany({ where: { order: { clientId: { in: clients } } } });
  await prisma.deliveryItem.deleteMany({ where: { delivery: { order: { clientId: { in: clients } } } } });
  await prisma.delivery.deleteMany({ where: { order: { clientId: { in: clients } } } });
  await prisma.orderItem.deleteMany({ where: { order: { clientId: { in: clients } } } });
  await prisma.order.deleteMany({ where: { clientId: { in: clients } } });
  await prisma.accountMovement.deleteMany({ where: { clientId: { in: clients } } });
  await prisma.clientContact.deleteMany({ where: { clientId: { in: clients } } });
  await prisma.client.deleteMany({ where: { id: { in: clients } } });
});

let contador = 0;
function sufijo() {
  contador += 1;
  return `${Math.floor(Math.random() * 1e9)}-${contador}`;
}

async function crearCliente() {
  const zone = await prisma.zone.findFirstOrThrow();
  const priceList = await prisma.priceList.findFirstOrThrow();
  const client = await prisma.client.create({
    data: {
      nombreComercial: `Cliente Factura ${sufijo()}`,
      tipoNegocio: 'tienda',
      zoneId: zone.id,
      ordenRuta: 7500 + Math.floor(Math.random() * 2000),
      direccion: 'Calle de prueba',
      priceListId: priceList.id,
      limiteCredito: '9000.00',
      plazoDias: 15,
    },
  });
  creados.clients.push(client.id);
  return client;
}

async function unidadSeed() {
  return prisma.productUnit.findFirstOrThrow({
    where: { product: { sku: 'HIG-001' }, nombre: 'Unidad' },
  });
}

/**
 * Crea un pedido de `cantidad` unidades de HIG-001 y lo deja confirmado.
 * Primero carga el vehículo del vendedor: confirmar reserva stock y sin
 * stock en el vehículo el confirm rebota con 409.
 */
async function pedidoConfirmado(token: string, userId: number, cantidad: string) {
  const client = await crearCliente();
  const unit = await unidadSeed();
  const vehicle = await prisma.warehouse.findFirstOrThrow({
    where: { tipo: 'vehiculo', activo: true, responsableUserId: userId },
  });
  await registerMovement({
    productId: unit.productId,
    warehouseId: vehicle.id,
    tipo: 'entrada',
    cantidad: '20',
    userId,
    referenciaTipo: 'test',
    referenciaId: `invoice-stock-${client.id}`,
  });

  const created = await request(app)
    .post('/api/orders')
    .set(auth(token))
    .send({
      clientId: client.id,
      canal: 'campo',
      condicionPago: 'contado',
      items: [{ productUnitId: unit.id, cantidad }],
    });
  expect(created.status).toBe(201);
  const confirmed = await request(app).post(`/api/orders/${created.body.id}/confirm`).set(auth(token));
  expect(confirmed.status).toBe(200);
  return { orderId: created.body.id as number, orderItemId: created.body.items[0].id as number, client, unit };
}

describe('POST /api/orders/:id/invoice', () => {
  it('no deja facturar un pedido que no está entregado', async () => {
    const { token, userId } = await loginAsAdmin();
    const { orderId } = await pedidoConfirmado(token, userId, '2');

    // Confirmado, pero sin entregar.
    const response = await request(app).post(`/api/orders/${orderId}/invoice`).set(auth(token)).send({});

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('ORDER_NOT_DELIVERED');
    expect(response.body.error.message).toContain('entregado');
    expect(await prisma.invoice.count({ where: { orderId } })).toBe(0);
  });

  it('no deja facturar un pedido en borrador', async () => {
    const { token } = await loginAsAdmin();
    const client = await crearCliente();
    const unit = await unidadSeed();
    const created = await request(app)
      .post('/api/orders')
      .set(auth(token))
      .send({ clientId: client.id, canal: 'campo', condicionPago: 'contado', items: [{ productUnitId: unit.id, cantidad: '1' }] });
    expect(created.status).toBe(201);

    const response = await request(app)
      .post(`/api/orders/${created.body.id}/invoice`)
      .set(auth(token))
      .send({});

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('ORDER_NOT_DELIVERED');
  });

  it('con entrega parcial factura solo lo realmente entregado', async () => {
    const { token, userId } = await loginAsAdmin();
    const { orderId, orderItemId } = await pedidoConfirmado(token, userId, '2');

    const delivered = await request(app)
      .post(`/api/orders/${orderId}/deliver`)
      .set(auth(token))
      .send({ items: [{ orderItemId, cantidadEntregada: '1' }] });
    expect(delivered.status).toBe(201);
    expect(delivered.body.order.estado).toBe('entregado_parcial');

    const pedido = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
    const totalPedido = pedido.total.toString();

    const response = await request(app).post(`/api/orders/${orderId}/invoice`).set(auth(token)).send({});

    expect(response.status).toBe(201);
    // 1 de 2 unidades: la mitad del pedido, no el pedido completo.
    const esperado = new Prisma.Decimal(totalPedido).div(2).toDecimalPlaces(2);
    expect(new Prisma.Decimal(response.body.total).equals(esperado)).toBe(true);
    expect(response.body.total).not.toBe(totalPedido);
  });

  it('con el StubFelProvider la factura queda pendiente, sin error', async () => {
    const { token, userId } = await loginAsAdmin();
    const { orderId, orderItemId } = await pedidoConfirmado(token, userId, '1');

    const delivered = await request(app)
      .post(`/api/orders/${orderId}/deliver`)
      .set(auth(token))
      .send({ items: [{ orderItemId, cantidadEntregada: '1' }] });
    expect(delivered.status).toBe(201);

    const response = await request(app).post(`/api/orders/${orderId}/invoice`).set(auth(token)).send({});

    // Comportamiento esperado hoy: no hay certificador elegido, así que la
    // factura queda pendiente. Eso NO es un error hacia el usuario.
    expect(response.status).toBe(201);
    expect(response.body.estado).toBe('pendiente_certificacion');
    expect(response.body.error).toBeNull();
    expect(response.body.uuidFel).toBeNull();
    expect(response.body.serie).toBeTruthy();
    expect(response.body.numero).toBeGreaterThan(0);
  });

  it('no deja facturar dos veces el mismo pedido', async () => {
    const { token, userId } = await loginAsAdmin();
    const { orderId, orderItemId } = await pedidoConfirmado(token, userId, '1');
    await request(app)
      .post(`/api/orders/${orderId}/deliver`)
      .set(auth(token))
      .send({ items: [{ orderItemId, cantidadEntregada: '1' }] });

    const primera = await request(app).post(`/api/orders/${orderId}/invoice`).set(auth(token)).send({});
    expect(primera.status).toBe(201);

    const segunda = await request(app).post(`/api/orders/${orderId}/invoice`).set(auth(token)).send({});
    expect(segunda.status).toBe(409);
    expect(segunda.body.error.code).toBe('ALREADY_INVOICED');
  });

  it('el correlativo de la factura es propio y no reutiliza números', async () => {
    const { token, userId } = await loginAsAdmin();
    const numeros: number[] = [];

    for (let i = 0; i < 2; i += 1) {
      const { orderId, orderItemId } = await pedidoConfirmado(token, userId, '1');
      await request(app)
        .post(`/api/orders/${orderId}/deliver`)
        .set(auth(token))
        .send({ items: [{ orderItemId, cantidadEntregada: '1' }] });
      const response = await request(app).post(`/api/orders/${orderId}/invoice`).set(auth(token)).send({});
      expect(response.status).toBe(201);
      numeros.push(response.body.numero);
    }

    expect(numeros[1]).toBeGreaterThan(numeros[0]);
  });
});

describe('GET /api/orders/:id/invoice y GET /api/invoices', () => {
  it('devuelve la factura del pedido y el listado filtrado por estado', async () => {
    const { token, userId } = await loginAsAdmin();
    const { orderId, orderItemId } = await pedidoConfirmado(token, userId, '1');
    await request(app)
      .post(`/api/orders/${orderId}/deliver`)
      .set(auth(token))
      .send({ items: [{ orderItemId, cantidadEntregada: '1' }] });
    const creada = await request(app).post(`/api/orders/${orderId}/invoice`).set(auth(token)).send({});
    expect(creada.status).toBe(201);

    const deLaFactura = await request(app).get(`/api/orders/${orderId}/invoice`).set(auth(token));
    expect(deLaFactura.status).toBe(200);
    expect(deLaFactura.body.id).toBe(creada.body.id);
    expect(deLaFactura.body.orderId).toBe(orderId);

    const listadas = await request(app)
      .get('/api/invoices?estado=pendiente_certificacion')
      .set(auth(token));
    expect(listadas.status).toBe(200);
    expect(listadas.body.map((row: { id: number }) => row.id)).toContain(creada.body.id);

    const certificadas = await request(app).get('/api/invoices?estado=certificada').set(auth(token));
    expect(certificadas.status).toBe(200);
    expect(certificadas.body.map((row: { id: number }) => row.id)).not.toContain(creada.body.id);
  });

  it('404 si el pedido no tiene factura', async () => {
    const { token, userId } = await loginAsAdmin();
    const { orderId } = await pedidoConfirmado(token, userId, '1');

    const response = await request(app).get(`/api/orders/${orderId}/invoice`).set(auth(token));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('no deja facturar sin sesión', async () => {
    const { token, userId } = await loginAsAdmin();
    const { orderId, orderItemId } = await pedidoConfirmado(token, userId, '1');
    await request(app)
      .post(`/api/orders/${orderId}/deliver`)
      .set(auth(token))
      .send({ items: [{ orderItemId, cantidadEntregada: '1' }] });

    const response = await request(app).post(`/api/orders/${orderId}/invoice`).send({});

    expect(response.status).toBe(401);
  });
});