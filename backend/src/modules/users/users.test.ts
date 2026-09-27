import bcrypt from 'bcryptjs';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';

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

let contador = 0;
function sufijo() {
  contador += 1;
  return `${Math.floor(Math.random() * 1e9)}-${contador}`;
}

/** Los usuarios que crean estos tests se borran al terminar. */
const creados: number[] = [];

afterEach(async () => {
  const ids = creados.splice(0, creados.length);
  if (ids.length === 0) {
    return;
  }
  await prisma.auditLog.deleteMany({ where: { entidad: 'User', entidadId: { in: ids.map(String) } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

async function crearAdmin() {
  const { token } = await loginAsAdmin();
  const role = await prisma.role.findFirstOrThrow({ where: { nombre: 'admin' } });
  const email = `usuario-${sufijo()}@disprova.local`;
  const created = await request(app)
    .post('/api/users')
    .set(auth(token))
    .send({ nombre: 'Usuario Prueba', email, password: 'Secreto123', roleId: role.id });
  expect(created.status).toBe(201);
  creados.push(created.body.id);
  return { user: created.body as { id: number; email: string }, email, password: 'Secreto123' };
}

describe('GET /api/roles', () => {
  it('devuelve los roles disponibles solo a admin', async () => {
    const { token } = await loginAsAdmin();

    const response = await request(app).get('/api/roles').set(auth(token));

    expect(response.status).toBe(200);
    const nombres = response.body.map((r: { nombre: string }) => r.nombre);
    expect(nombres).toContain('admin');
    expect(nombres).toContain('vendedor');
  });

  it('no responde sin sesión', async () => {
    const response = await request(app).get('/api/roles');

    expect(response.status).toBe(401);
  });
});

describe('GET /api/users', () => {
  it('lista usuarios con su rol y sin password_hash', async () => {
    const { token } = await loginAsAdmin();
    await crearAdmin();

    const response = await request(app).get('/api/users').set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    for (const user of response.body) {
      expect(user.passwordHash).toBeUndefined();
      expect(user.password).toBeUndefined();
      expect(user).toHaveProperty('rol');
    }
  });

  it('filtra por activo', async () => {
    const { token } = await loginAsAdmin();
    const { user } = await crearAdmin();
    await request(app).put(`/api/users/${user.id}`).set(auth(token)).send({ activo: false });

    const soloActivos = await request(app).get('/api/users?activo=true').set(auth(token));
    const inactivos = await request(app).get('/api/users?activo=false').set(auth(token));

    expect(soloActivos.body.map((u: { id: number }) => u.id)).not.toContain(user.id);
    expect(inactivos.body.map((u: { id: number }) => u.id)).toContain(user.id);
  });
});

describe('POST /api/users', () => {
  it('crea el usuario con la contraseña hasheada y devuelve el rol', async () => {
    const { token, userId } = await loginAsAdmin();
    const role = await prisma.role.findFirstOrThrow({ where: { nombre: 'vendedor' } });
    const email = `nuevo-${sufijo()}@disprova.local`;

    const response = await request(app)
      .post('/api/users')
      .set(auth(token))
      .send({ nombre: 'Vendedor Nuevo', email, password: 'Secreto123', roleId: role.id });

    expect(response.status).toBe(201);
    expect(response.body.email).toBe(email);
    expect(response.body.rol).toBe('vendedor');
    expect(response.body.passwordHash).toBeUndefined();
    creados.push(response.body.id);

    const enBase = await prisma.user.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(enBase.passwordHash).not.toBe('Secreto123');
    expect(await bcrypt.compare('Secreto123', enBase.passwordHash)).toBe(true);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entidad: 'User', entidadId: String(response.body.id), accion: 'create' },
    });
    expect(audit.userId).toBe(userId);
  });

  it('rechaza un email que ya existe', async () => {
    const { token } = await loginAsAdmin();
    const { email } = await crearAdmin();

    const response = await request(app)
      .post('/api/users')
      .set(auth(token))
      .send({ nombre: 'Duplicado', email, password: 'Secreto123', roleId: 1 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('rechaza datos inválidos', async () => {
    const { token } = await loginAsAdmin();
    const role = await prisma.role.findFirstOrThrow();

    const emailInvalido = await request(app)
      .post('/api/users')
      .set(auth(token))
      .send({ nombre: 'X', email: 'no-es-email', password: 'Secreto123', roleId: role.id });
    expect(emailInvalido.status).toBe(400);

    const claveCorta = await request(app)
      .post('/api/users')
      .set(auth(token))
      .send({ nombre: 'X', email: `corta-${sufijo()}@disprova.local`, password: 'corta', roleId: role.id });
    expect(claveCorta.status).toBe(400);
  });
});

describe('PUT /api/users/:id', () => {
  it('actualiza nombre, email, rol y activo, y deja rastro del antes y el después', async () => {
    const { token, userId } = await loginAsAdmin();
    const { user } = await crearAdmin();
    const vendedor = await prisma.role.findFirstOrThrow({ where: { nombre: 'vendedor' } });
    const nuevoEmail = `cambiado-${sufijo()}@disprova.local`;

    const response = await request(app)
      .put(`/api/users/${user.id}`)
      .set(auth(token))
      .send({ nombre: 'Nombre Nuevo', email: nuevoEmail, roleId: vendedor.id, activo: false });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      nombre: 'Nombre Nuevo',
      email: nuevoEmail,
      activo: false,
      rol: 'vendedor',
    });
    expect(response.body.passwordHash).toBeUndefined();

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entidad: 'User', entidadId: String(user.id), accion: 'update' },
    });
    expect(audit.userId).toBe(userId);
    expect((audit.datosAntes as { email: string }).email).toBe(user.email);
    expect((audit.datosDespues as { email: string }).email).toBe(nuevoEmail);
  });

  it('no cambia la contraseña', async () => {
    const { token } = await loginAsAdmin();
    const { user, password } = await crearAdmin();
    const antes = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    await request(app).put(`/api/users/${user.id}`).set(auth(token)).send({ nombre: 'Otro' });

    const despues = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(despues.passwordHash).toBe(antes.passwordHash);
    expect(await bcrypt.compare(password, despues.passwordHash)).toBe(true);
  });

  it('rechaza un email que pertenece a otro usuario', async () => {
    const { token } = await loginAsAdmin();
    const { user } = await crearAdmin();
    const { email: emailAjeno } = await crearAdmin();

    // Email de OTRO usuario: reenviar el suyo propio sí debe funcionar.
    const response = await request(app)
      .put(`/api/users/${user.id}`)
      .set(auth(token))
      .send({ email: emailAjeno });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('permite reenviar el mismo email del propio usuario', async () => {
    const { token } = await loginAsAdmin();
    const { user, email } = await crearAdmin();

    const response = await request(app)
      .put(`/api/users/${user.id}`)
      .set(auth(token))
      .send({ email });

    expect(response.status).toBe(200);
  });

  it('404 si el usuario no existe', async () => {
    const { token } = await loginAsAdmin();

    const response = await request(app).put('/api/users/9999999').set(auth(token)).send({ nombre: 'X' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});