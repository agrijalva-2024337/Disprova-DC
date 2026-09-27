import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { generateClientAccessToken } from '../catalog-public/clientAccessToken.js';

async function loginAsAdmin() {
  const response = await request(app).post('/api/auth/login').send({
    email: 'admin@disprova.local',
    password: 'Admin123!',
  });
  expect(response.status).toBe(200);
  return { token: response.body.accessToken as string, userId: response.body.user.id as number };
}

/**
 * Estos tests corren contra la base compartida. Todo lo que crean se borra en
 * afterEach: si quedan clientes o pedidos de prueba, los tests de
 * sales-territory y reports que cuentan clientes empiezan a fallar.
 */
const creados = { tokens: [] as number[], clients: [] as number[], priceLists: [] as number[] };

async function limpiar() {
  const { tokens, clients, priceLists } = creados;
  creados.tokens = [];
  creados.clients = [];
  creados.priceLists = [];

  if (tokens.length > 0) {
    await prisma.clientAccessToken.deleteMany({ where: { id: { in: tokens } } });
  }
  if (clients.length > 0) {
    await prisma.orderItem.deleteMany({ where: { order: { clientId: { in: clients } } } });
    await prisma.order.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.clientAccessToken.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.clientContact.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.client.deleteMany({ where: { id: { in: clients } } });
  }
  if (priceLists.length > 0) {
    await prisma.priceListItem.deleteMany({ where: { priceListId: { in: priceLists } } });
    await prisma.priceList.deleteMany({ where: { id: { in: priceLists } } });
  }
}

afterEach(async () => {
  await limpiar();
});

let contador = 0;
function sufijo() {
  contador += 1;
  return `${Math.floor(Math.random() * 1e9)}-${contador}`;
}

async function crearCliente(priceListId: number) {
  const zone = await prisma.zone.findFirstOrThrow();
  const client = await prisma.client.create({
    data: {
      nombreComercial: `Cliente Web ${sufijo()}`,
      tipoNegocio: 'tienda',
      zoneId: zone.id,
      ordenRuta: 7000 + Math.floor(Math.random() * 2000),
      direccion: 'Direccion de prueba',
      priceListId,
      limiteCredito: '9000.00',
      plazoDias: 15,
    },
  });
  creados.clients.push(client.id);
  return client;
}

async function crearToken(clientId: number, userId: number, dias = 30) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + dias);
  const record = await prisma.clientAccessToken.create({
    data: { clientId, token: generateClientAccessToken(), expiresAt, createdByUserId: userId },
  });
  creados.tokens.push(record.id);
  return record;
}

async function unidadSeed() {
  return prisma.productUnit.findFirstOrThrow({
    where: { product: { sku: 'MED-001' }, nombre: 'Blister x10' },
  });
}

describe('POST /api/tokens/clients/:clientId', () => {
  it('un admin genera un token y devuelve el path para compartir', async () => {
    const { token, userId } = await loginAsAdmin();
    const lista = await prisma.priceList.findFirstOrThrow();
    const client = await crearCliente(lista.id);

    const response = await request(app)
      .post(`/api/tokens/clients/${client.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(201);
    expect(response.body.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(response.body.pathCatalogo).toBe(`/catalogo/${response.body.token}`);

    const record = await prisma.clientAccessToken.findFirstOrThrow({
      where: { clientId: client.id },
    });
    // 30 días por defecto
    const dias = Math.round((record.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    expect(dias).toBeGreaterThan(28);
    expect(dias).toBeLessThanOrEqual(30);
    expect(record.createdByUserId).toBe(userId);
    creados.tokens.push(record.id);
  });

  it('no deja generar tokens sin admin', async () => {
    const lista = await prisma.priceList.findFirstOrThrow();
    const client = await crearCliente(lista.id);

    const sinToken = await request(app).post(`/api/tokens/clients/${client.id}`).send({});
    expect(sinToken.status).toBe(401);
  });
});

describe('GET /api/public/catalog', () => {
  it('rechaza un token inexistente con 401', async () => {
    const response = await request(app)
      .get('/api/public/catalog')
      .set('X-Client-Token', generateClientAccessToken());

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('PUBLIC_TOKEN_INVALID');
  });

  it('rechaza con 401 el token expirado', async () => {
    const { userId } = await loginAsAdmin();
    const lista = await prisma.priceList.findFirstOrThrow();
    const client = await crearCliente(lista.id);
    const vencido = await crearToken(client.id, userId, -1);

    const response = await request(app)
      .get('/api/public/catalog')
      .set('X-Client-Token', vencido.token);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('PUBLIC_TOKEN_EXPIRED');
  });

  it('acepta el token por query param además del header', async () => {
    const { userId } = await loginAsAdmin();
    const lista = await prisma.priceList.findFirstOrThrow();
    const client = await crearCliente(lista.id);
    const vigente = await crearToken(client.id, userId);

    const response = await request(app).get(`/api/public/catalog?token=${vigente.token}`);

    expect(response.status).toBe(200);
  });

  it('muestra el precio de la lista del cliente del token', async () => {
    const { userId } = await loginAsAdmin();
    const listaGeneral = await prisma.priceList.findFirstOrThrow();
    const unidad = await unidadSeed();

    // Segunda lista con precio distinto para la misma presentación.
    const listaWeb = await prisma.priceList.create({
      data: { nombre: `Lista Web ${sufijo()}`, activo: true },
    });
    creados.priceLists.push(listaWeb.id);
    await prisma.priceListItem.create({
      data: {
        priceListId: listaWeb.id,
        productUnitId: unidad.id,
        precio: '20.00',
        vigenteDesde: new Date('2026-01-01'),
      },
    });

    const clienteGeneral = await crearCliente(listaGeneral.id);
    const clienteWeb = await crearCliente(listaWeb.id);
    const tokenGeneral = await crearToken(clienteGeneral.id, userId);
    const tokenWeb = await crearToken(clienteWeb.id, userId);

    const deGeneral = await request(app)
      .get('/api/public/catalog')
      .set('X-Client-Token', tokenGeneral.token);
    const deWeb = await request(app).get('/api/public/catalog').set('X-Client-Token', tokenWeb.token);

    expect(deGeneral.status).toBe(200);
    expect(deWeb.status).toBe(200);

    const precioDe = (body: {
      productos: Array<{ unidades: Array<{ id: number; precio: string | null }> }>;
    }) => body.productos.flatMap((p) => p.unidades).find((u) => u.id === unidad.id)?.precio;

    // Misma presentación, distinto precio según la lista de cada token.
    expect(precioDe(deGeneral.body)).not.toBe(precioDe(deWeb.body));
    expect(precioDe(deWeb.body)).toBe('20.00');
  });

  it('el token no habilita endpoints internos', async () => {
    const { userId } = await loginAsAdmin();
    const lista = await prisma.priceList.findFirstOrThrow();
    const client = await crearCliente(lista.id);
    const vigente = await crearToken(client.id, userId);

    // /api/orders exige JWT: el token de cliente no sirve como sesión.
    const response = await request(app).get('/api/orders').set('X-Client-Token', vigente.token);

    expect(response.status).toBe(401);
  });
});

describe('POST /api/public/orders', () => {
  it('ignora el clientId del body y usa el del token', async () => {
    const { userId } = await loginAsAdmin();
    const lista = await prisma.priceList.findFirstOrThrow();
    const delToken = await crearCliente(lista.id);
    const otro = await crearCliente(lista.id);
    const vigente = await crearToken(delToken.id, userId);
    const unidad = await unidadSeed();

    const response = await request(app)
      .post('/api/public/orders')
      .set('X-Client-Token', vigente.token)
      .send({
        clientId: otro.id,
        canal: 'campo',
        condicionPago: 'contado',
        items: [{ productUnitId: unidad.id, cantidad: '2' }],
      });

    expect(response.status).toBe(201);
    expect(response.body.clientId).toBe(delToken.id);
    expect(response.body.clientId).not.toBe(otro.id);
    // El canal lo fija el servidor, no el body.
    expect(response.body.canal).toBe('web');
  });

  it('el pedido queda en borrador y no reserva stock', async () => {
    const { userId } = await loginAsAdmin();
    const lista = await prisma.priceList.findFirstOrThrow();
    const client = await crearCliente(lista.id);
    const vigente = await crearToken(client.id, userId);
    const unidad = await unidadSeed();

    const stockAntes = await prisma.stock.findMany({ where: { productId: unidad.productId } });

    const response = await request(app)
      .post('/api/public/orders')
      .set('X-Client-Token', vigente.token)
      .send({
        condicionPago: 'contado',
        items: [{ productUnitId: unidad.id, cantidad: '2' }],
      });

    expect(response.status).toBe(201);
    expect(response.body.estado).toBe('borrador');

    const stockDespues = await prisma.stock.findMany({ where: { productId: unidad.productId } });
    expect(stockDespues).toHaveLength(stockAntes.length);
    for (const [i, row] of stockDespues.entries()) {
      expect(row.cantidad.toString()).toBe(stockAntes[i].cantidad.toString());
    }
  });

  it('queda atribuido al usuario de sistema, no a un humano', async () => {
    const { userId } = await loginAsAdmin();
    const lista = await prisma.priceList.findFirstOrThrow();
    const client = await crearCliente(lista.id);
    const vigente = await crearToken(client.id, userId);
    const unidad = await unidadSeed();

    const response = await request(app)
      .post('/api/public/orders')
      .set('X-Client-Token', vigente.token)
      .send({ condicionPago: 'contado', items: [{ productUnitId: unidad.id, cantidad: '1' }] });

    const sistema = await prisma.user.findUniqueOrThrow({
      where: { email: 'pedidos-web@disprova.local' },
    });
    expect(response.body.userId).toBe(sistema.id);
    expect(response.body.userId).not.toBe(userId);
    // Inactivo: nunca puede obtener un JWT.
    expect(sistema.activo).toBe(false);
  });
});