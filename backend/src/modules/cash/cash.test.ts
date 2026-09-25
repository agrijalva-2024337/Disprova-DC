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

    const reopened = await request(app).post('/api/cash-sessions').set(auth).send({ fondoInicial: '200.00' });
    expect(reopened.status).toBe(201);

    const negative = await request(app)
      .post(`/api/cash-sessions/${reopened.body.id}/close`)
      .set(auth)
      .send({ conteoFinal: '199.99' });
    expect(negative.status).toBe(200);
    expect(equalsMoney(negative.body.diferencia, '-0.01')).toBe(true);
  });
});
