import { Prisma } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';

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

function equalsMoney(actual: string, expected: string) {
  return new Prisma.Decimal(actual).equals(new Prisma.Decimal(expected));
}

describe('sesiones de caja', () => {
  it('abre una caja, rechaza una segunda y cierra con diferencia positiva y negativa', async () => {
    const { token, userId } = await loginAsAdmin();
    const abierta = await prisma.cashSession.findFirst({
      where: { userId, estado: 'abierta' },
    });
    if (abierta) {
      await prisma.cashSession.update({
        where: { id: abierta.id },
        data: { estado: 'cerrada', cerradaAt: new Date(), conteoFinal: abierta.fondoInicial, diferencia: 0 },
      });
    }

    const auth = { Authorization: `Bearer ${token}` };

    const opened = await request(app).post('/api/cash-sessions').set(auth).send({ fondoInicial: '150.50' });
    expect(opened.status).toBe(201);
    expect(opened.body.estado).toBe('abierta');
    expect(equalsMoney(opened.body.totalCobrado, '0')).toBe(true);
    expect(equalsMoney(opened.body.totalGastos, '0')).toBe(true);

    const openAudit = await prisma.auditLog.findFirstOrThrow({
      where: { entidad: 'CashSession', entidadId: String(opened.body.id), accion: 'open' },
    });
    expect(openAudit.userId).toBe(userId);
    expect((openAudit.datosDespues as { fondoInicial: string }).fondoInicial).toBe('150.50');

    const duplicate = await request(app).post('/api/cash-sessions').set(auth).send({ fondoInicial: '10' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CASH_SESSION_OPEN');

    const positive = await request(app)
      .post(`/api/cash-sessions/${opened.body.id}/close`)
      .set(auth)
      .send({ conteoFinal: '160.75' });
    expect(positive.status).toBe(200);
    expect(positive.body.estado).toBe('cerrada');
    expect(equalsMoney(positive.body.diferencia, '10.25')).toBe(true);

    const closeAudit = await prisma.auditLog.findFirstOrThrow({
      where: { entidad: 'CashSession', entidadId: String(opened.body.id), accion: 'close' },
    });
    expect(closeAudit.userId).toBe(userId);
    const antes = closeAudit.datosAntes as { estado: string; esperado: string };
    const despues = closeAudit.datosDespues as { estado: string; conteoFinal: string; diferencia: string };
    expect(antes.estado).toBe('abierta');
    expect(antes.esperado).toBe('150.50');
    expect(despues.estado).toBe('cerrada');
    expect(despues.conteoFinal).toBe('160.75');
    expect(despues.diferencia).toBe('10.25');

    const reopened = await request(app).post('/api/cash-sessions').set(auth).send({ fondoInicial: '200.00' });
    expect(reopened.status).toBe(201);

    const negative = await request(app)
      .post(`/api/cash-sessions/${reopened.body.id}/close`)
      .set(auth)
      .send({ conteoFinal: '199.99' });
    expect(negative.status).toBe(200);
    expect(equalsMoney(negative.body.diferencia, '-0.01')).toBe(true);

    // Las cajas que abre y cierra el test no deben quedar en la base.
    const sesiones = [opened.body.id as number, reopened.body.id as number];
    await prisma.auditLog.deleteMany({
      where: { entidad: 'CashSession', entidadId: { in: sesiones.map(String) } },
    });
    await prisma.cashSession.deleteMany({ where: { id: { in: sesiones } } });
  });

  it('registra un gasto y lo descuenta del esperado al cerrar', async () => {
    const { token, userId } = await loginAsAdmin();
    const abierta = await prisma.cashSession.findFirst({ where: { userId, estado: 'abierta' } });
    if (abierta) {
      await prisma.cashSession.update({
        where: { id: abierta.id },
        data: { estado: 'cerrada', cerradaAt: new Date(), conteoFinal: abierta.fondoInicial, diferencia: 0 },
      });
    }

    const auth = { Authorization: `Bearer ${token}` };
    const opened = await request(app).post('/api/cash-sessions').set(auth).send({ fondoInicial: '100.00' });
    expect(opened.status).toBe(201);

    // El gasto se descuenta del esperado: 100 - 30 = 70, y contando 70 la
    // caja cuadra. Antes de esto el totalGastos nunca se escribía y cualquier
    // gasto real descuadraba el arqueo sin explicación.
    const gasto = await request(app)
      .post('/api/cash-sessions/expenses')
      .set(auth)
      .send({ concepto: 'Combustible', monto: '30.00' });
    expect(gasto.status).toBe(201);
    expect(equalsMoney(gasto.body.monto, '30.00')).toBe(true);

    const session = await prisma.cashSession.findUniqueOrThrow({ where: { id: opened.body.id } });
    expect(equalsMoney(session.totalGastos, '30.00')).toBe(true);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entidad: 'CashExpense', entidadId: String(gasto.body.id), accion: 'create' },
    });
    expect(audit.userId).toBe(userId);

    const listado = await request(app)
      .get(`/api/cash-sessions/${opened.body.id}/expenses`)
      .set(auth);
    expect(listado.status).toBe(200);
    expect(listado.body).toHaveLength(1);

    const closed = await request(app)
      .post(`/api/cash-sessions/${opened.body.id}/close`)
      .set(auth)
      .send({ conteoFinal: '70.00' });
    expect(closed.status).toBe(200);
    expect(equalsMoney(closed.body.diferencia, '0')).toBe(true);

    const ids = [opened.body.id as number];
    await prisma.auditLog.deleteMany({
      where: { entidad: { in: ['CashSession', 'CashExpense'] }, entidadId: { in: ids.map(String) } },
    });
    await prisma.cashExpense.deleteMany({ where: { cashSessionId: { in: ids } } });
    await prisma.cashSession.deleteMany({ where: { id: { in: ids } } });
  });

  it('no registra gasto sin caja abierta y no acepta monto no positivo', async () => {
    const { token, userId } = await loginAsAdmin();
    const abierta = await prisma.cashSession.findFirst({ where: { userId, estado: 'abierta' } });
    if (abierta) {
      await prisma.cashSession.update({
        where: { id: abierta.id },
        data: { estado: 'cerrada', cerradaAt: new Date(), conteoFinal: abierta.fondoInicial, diferencia: 0 },
      });
    }

    const auth = { Authorization: `Bearer ${token}` };
    const sinCaja = await request(app)
      .post('/api/cash-sessions/expenses')
      .set(auth)
      .send({ concepto: 'Viáticos', monto: '15.00' });
    expect(sinCaja.status).toBe(409);
    expect(sinCaja.body.error.code).toBe('CASH_SESSION_REQUIRED');

    const opened = await request(app).post('/api/cash-sessions').set(auth).send({ fondoInicial: '50.00' });
    const negativo = await request(app)
      .post('/api/cash-sessions/expenses')
      .set(auth)
      .send({ concepto: 'Ajuste', monto: '-5.00' });
    expect(negativo.status).toBe(400);

    const ids = [opened.body.id as number];
    await prisma.cashSession.deleteMany({ where: { id: { in: ids } } });
  });
});
