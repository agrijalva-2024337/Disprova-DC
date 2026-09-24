import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';

async function loginAsAdmin() {
  const response = await request(app).post('/api/auth/login').send({
    email: 'admin@disprova.local',
    password: 'Admin123!',
  });
  expect(response.status).toBe(200);
  return response.body.accessToken as string;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('POST /api/clients', () => {
  it('rechaza orden_ruta duplicado en la misma zona', async () => {
    const token = await loginAsAdmin();
    const zone = await prisma.zone.findFirst({ where: { nombre: 'Zona Mixco' } });
    const priceList = await prisma.priceList.findFirst();
    expect(zone).not.toBeNull();
    expect(priceList).not.toBeNull();

    const response = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombreComercial: 'Cliente duplicado',
        tipoNegocio: 'tienda',
        zoneId: zone!.id,
        ordenRuta: 1,
        direccion: 'Calle de prueba',
        priceListId: priceList!.id,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });
});

describe('GET /api/route-visits/today', () => {
  it('resuelve la zona de la semana 1 en lunes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 7, 9, 0, 0));

    const token = await loginAsAdmin();
    const response = await request(app)
      .get('/api/route-visits/today')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.semanaMes).toBe(1);
    expect(response.body.diaSemana).toBe(1);
    expect(response.body.fecha).toBe('2026-09-07');
    expect(response.body.zones.map((zone: { nombre: string }) => zone.nombre)).toEqual(['Zona Mixco']);
    expect(response.body.clients.map((client: { ordenRuta: number }) => client.ordenRuta)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(response.body.clients[0].saldoActual).toBe(0);
    expect(response.body.clients[0].visitadoHoy).toBe(false);
  });

  it('resuelve la zona de la semana 2 en martes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 8, 9, 0, 0));

    const token = await loginAsAdmin();
    const response = await request(app)
      .get('/api/route-visits/today')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.semanaMes).toBe(2);
    expect(response.body.diaSemana).toBe(2);
    expect(response.body.fecha).toBe('2026-09-08');
    expect(response.body.zones.map((zone: { nombre: string }) => zone.nombre)).toEqual([
      'Zona Villa Nueva',
    ]);
    expect(response.body.clients).toHaveLength(4);
    expect(response.body.clients[0].nombreComercial).toBe('Farmacia Villa Nueva');
    expect(response.body.clients[0].saldoActual).toBe(0);
  });
});
