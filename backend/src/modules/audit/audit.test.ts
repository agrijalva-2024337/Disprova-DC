import bcrypt from 'bcryptjs';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';

/**
 * Las filas se siembran directo en audit_log con un entidadId recognizeble
 * (90x) para poder borrarlas sin tocar el rastro que dejaron otros tests.
 */
const ENTIDAD_ID = '900123';
const otrosEntidadId: string[] = [];
const usuariosCreados: number[] = [];

async function login(email: string, password: string) {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  expect(response.status).toBe(200);
  return { token: response.body.accessToken as string, userId: response.body.user.id as number };
}

const admin = () => login('admin@disprova.local', 'Admin123!');

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function crearVendedor(sufijo: string) {
  const role = await prisma.role.findFirstOrThrow({ where: { nombre: 'vendedor' } });
  const email = `auditoria-${Date.now()}-${sufijo}@disprova.local`;
  const user = await prisma.user.create({
    // Hash de verdad: con 'x' el login devolvería 401 y el test probaría la
    // contraseña en vez del permiso.
    data: {
      nombre: 'Vendedor auditoría',
      email,
      passwordHash: await bcrypt.hash('Vendedor123!', 10),
      roleId: role.id,
    },
  });
  usuariosCreados.push(user.id);
  return { ...user, email };
}

afterEach(async () => {
  const ids = [ENTIDAD_ID, ...otrosEntidadId.splice(0, otrosEntidadId.length)];
  await prisma.auditLog.deleteMany({ where: { entidadId: { in: ids } } });
  const users = usuariosCreados.splice(0, usuariosCreados.length);
  if (users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  }
});

describe('GET /api/audit-log', () => {
  it('responde con el rastro paginado y el nombre de quien hizo el cambio', async () => {
    const { token, userId } = await admin();
    const otro = await crearVendedor('a');

    await prisma.auditLog.createMany({
      data: [
        { userId, entidad: 'Order', entidadId: ENTIDAD_ID, accion: 'create', createdAt: new Date('2026-01-01T10:00:00Z') },
        { userId, entidad: 'Order', entidadId: ENTIDAD_ID, accion: 'confirm', createdAt: new Date('2026-01-02T10:00:00Z') },
        { userId: otro.id, entidad: 'Order', entidadId: ENTIDAD_ID, accion: 'cancel', createdAt: new Date('2026-01-03T10:00:00Z') },
      ],
    });

    // Se filtra por entidadId para no depender de lo que dejaron otros tests.
    const response = await request(app).get('/api/audit-log').query({ entityId: ENTIDAD_ID }).set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(3);
    expect(response.body.meta).toMatchObject({ total: 3, limit: 100, offset: 0, count: 3, hasMore: false });

    const [masReciente] = response.body.data;
    expect(masReciente.accion).toBe('cancel');
    expect(masReciente.entidad).toBe('Order');
    expect(masReciente.entidadId).toBe(ENTIDAD_ID);
    expect(masReciente.usuario).toEqual({
      id: otro.id,
      nombre: 'Vendedor auditoría',
      email: otro.email,
    });
    expect(masReciente).toHaveProperty('datosAntes');
    expect(masReciente).toHaveProperty('datosDespues');
    expect(masReciente).toHaveProperty('createdAt');

    const delAdmin = response.body.data.find((row: { accion: string }) => row.accion === 'create');
    expect(delAdmin.usuario.email).toBe('admin@disprova.local');
  });

  it('ordena de más nuevo a más viejo', async () => {
    const { token, userId } = await admin();
    await prisma.auditLog.createMany({
      data: [
        { userId, entidad: 'Order', entidadId: ENTIDAD_ID, accion: 'a', createdAt: new Date('2026-01-01T10:00:00Z') },
        { userId, entidad: 'Order', entidadId: ENTIDAD_ID, accion: 'c', createdAt: new Date('2026-01-03T10:00:00Z') },
        { userId, entidad: 'Order', entidadId: ENTIDAD_ID, accion: 'b', createdAt: new Date('2026-01-02T10:00:00Z') },
      ],
    });

    const response = await request(app)
      .get('/api/audit-log')
      .query({ entityId: ENTIDAD_ID })
      .set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.data.map((row: { accion: string }) => row.accion)).toEqual(['c', 'b', 'a']);
  });

  it('acepta el nombre de la tabla o el del modelo en entity', async () => {
    const { token, userId } = await admin();
    await prisma.auditLog.create({
      data: { userId, entidad: 'Order', entidadId: ENTIDAD_ID, accion: 'create' },
    });

    for (const entity of ['orders', 'Order', 'ORDERS', 'order']) {
      const response = await request(app)
        .get('/api/audit-log')
        .query({ entity, entityId: ENTIDAD_ID })
        .set(auth(token));
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].entidad).toBe('Order');
    }

    // Un nombre parecido pero de otra cosa tampoco entra.
    const otra = await request(app)
      .get('/api/audit-log')
      .query({ entity: 'orders_detail', entityId: ENTIDAD_ID })
      .set(auth(token));
    expect(otra.status).toBe(400);
  });
  it('filtra por entidadId, usuario y rango de fechas', async () => {
    const { token, userId } = await admin();
    const otro = await crearVendedor('b');
    otrosEntidadId.push('900125');
    await prisma.auditLog.createMany({
      data: [
        { userId, entidad: 'Order', entidadId: ENTIDAD_ID, accion: 'create', createdAt: new Date('2026-01-01T10:00:00Z') },
        { userId: otro.id, entidad: 'Order', entidadId: '900125', accion: 'deliver', createdAt: new Date('2026-02-01T10:00:00Z') },
      ],
    });

    const porUsuario = await request(app).get('/api/audit-log').query({ userId: otro.id }).set(auth(token));
    expect(porUsuario.status).toBe(200);
    expect(porUsuario.body.data.every((row: { usuario: { id: number } }) => row.usuario.id === otro.id)).toBe(true);

    const porFechas = await request(app)
      .get('/api/audit-log')
      .query({ startDate: '2026-01-15T00:00:00Z', endDate: '2026-03-01T00:00:00Z', entityId: '900125' })
      .set(auth(token));
    expect(porFechas.status).toBe(200);
    expect(porFechas.body.data).toHaveLength(1);
    expect(porFechas.body.data[0].accion).toBe('deliver');

    // Fuera del rango no entra la fila de enero.
    const fuera = await request(app)
      .get('/api/audit-log')
      .query({ startDate: '2026-01-15T00:00:00Z', endDate: '2026-01-31T00:00:00Z', entityId: ENTIDAD_ID })
      .set(auth(token));
    expect(fuera.status).toBe(200);
    expect(fuera.body.data).toHaveLength(0);
  });

  it('pagina con limit y offset sin repetir filas', async () => {
    const { token, userId } = await admin();
    await prisma.auditLog.createMany({
      data: Array.from({ length: 5 }, (_v, index) => ({
        userId,
        entidad: 'Order',
        entidadId: ENTIDAD_ID,
        accion: `paso-${index}`,
        createdAt: new Date(`2026-01-0${index + 1}T10:00:00Z`),
      })),
    });

    const page1 = await request(app)
      .get('/api/audit-log')
      .query({ entityId: ENTIDAD_ID, limit: 2, offset: 0 })
      .set(auth(token));
    const page2 = await request(app)
      .get('/api/audit-log')
      .query({ entityId: ENTIDAD_ID, limit: 2, offset: 2 })
      .set(auth(token));

    expect(page1.body.meta).toMatchObject({ total: 5, limit: 2, offset: 0, count: 2, hasMore: true });
    expect(page2.body.meta).toMatchObject({ limit: 2, offset: 2, count: 2 });

    const primera = page1.body.data.map((row: { accion: string }) => row.accion);
    const segunda = page2.body.data.map((row: { accion: string }) => row.accion);
    expect(primera).toEqual(['paso-4', 'paso-3']);
    expect(segunda).toEqual(['paso-2', 'paso-1']);
  });

  it('rechaza una entidad desconocida diciendo cuáles hay', async () => {
    const { token, userId } = await admin();
    await prisma.auditLog.create({
      data: { userId, entidad: 'Order', entidadId: ENTIDAD_ID, accion: 'create' },
    });

    const response = await request(app).get('/api/audit-log').query({ entity: 'facturacion' }).set(auth(token));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('UNKNOWN_ENTITY');
    expect(response.body.error.message).toContain('Order');
  });

  it('exige sesión y admin', async () => {
    const sinSesion = await request(app).get('/api/audit-log');
    expect(sinSesion.status).toBe(401);

    const vendedor = await crearVendedor('c');
    const { token } = await login(vendedor.email, 'Vendedor123!');
    const response = await request(app).get('/api/audit-log').set(auth(token));

    expect(response.status).toBe(403);
  });

  it('rechaza un límite por encima del máximo', async () => {
    const { token } = await admin();

    const response = await request(app).get('/api/audit-log').query({ limit: 5000 }).set(auth(token));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});