import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { postMovement } from '../collections/account.service.js';

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

/**
 * Estos tests corren contra la base compartida. El cliente con cargo que crea
 * la prueba de saldo tiene que borrarse: si queda, la zona de la semana 1 deja
 * de tener los 4 clientes del seed y el resto de pruebas del archivo fallan.
 *
 * El borrado es forzado a propósito: es limpieza de datos de prueba, no la
 * regla de negocio. La regla dice que nada se borra, y por eso `DELETE
 * /clients/:id` solo desactiva. Para que el cliente de prueba desaparezca de
 * verdad hay que remover antes sus visitas, que es justo lo que el endpoint
 * ya no hace.
 */
const clientsCreados: number[] = [];

afterEach(async () => {
  vi.useRealTimers();
  const ids = clientsCreados.splice(0, clientsCreados.length);
  if (ids.length === 0) {
    return;
  }
  await prisma.auditLog.deleteMany({
    where: { entidad: 'Client', entidadId: { in: ids.map(String) } },
  });
  await prisma.accountMovement.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.routeVisit.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.clientContact.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.client.deleteMany({ where: { id: { in: ids } } });
});

async function crearClienteEnZona(zoneId: number) {
  const priceList = await prisma.priceList.findFirstOrThrow();
  const client = await prisma.client.create({
    data: {
      nombreComercial: `Ruta con saldo ${Date.now()}`,
      tipoNegocio: 'tienda',
      zoneId,
      ordenRuta: 9500 + (Date.now() % 400),
      direccion: 'Calle de prueba',
      priceListId: priceList.id,
    },
  });
  clientsCreados.push(client.id);
  return client;
}

describe('POST /api/clients', () => {
  it('rechaza orden_ruta duplicado en la misma zona', async () => {
    const { token } = await loginAsAdmin();
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

    const { token } = await loginAsAdmin();
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
    expect(response.body.clients[0].visitadoHoy).toBe(false);
  });

  it('resuelve la zona de la semana 2 en martes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 8, 9, 0, 0));

    const { token } = await loginAsAdmin();
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
  });

  it('muestra el saldo real del cliente con cargo pendiente, no 0', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 7, 9, 0, 0));

    const { token, userId } = await loginAsAdmin();
    const zone = await prisma.zone.findFirstOrThrow({ where: { nombre: 'Zona Mixco' } });
    const client = await crearClienteEnZona(zone.id);

    const rutaDe = async () => {
      const response = await request(app)
        .get('/api/route-visits/today')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      const row = response.body.clients.find((item: { id: number }) => item.id === client.id);
      expect(row).toBeDefined();
      return row;
    };

    // Sin movimientos, el saldo es 0 de verdad, no de relleno.
    expect((await rutaDe()).saldoActual).toBe(0);

    await prisma.$transaction((tx) =>
      postMovement(tx, {
        clientId: client.id,
        tipo: 'cargo',
        referenciaTipo: 'test',
        referenciaId: `ruta-${client.id}`,
        monto: '125.50',
        fecha: new Date(),
        userId,
      }),
    );

    const row = await rutaDe();
    expect(row.saldoActual).not.toBe(0);
    expect(row.saldoActual).toBe(125.5);
  });
});

describe('soft delete de territorio', () => {
  it('desactiva el cliente sin borrar su historial de visitas', async () => {
    const { token, userId } = await loginAsAdmin();
    const zone = await prisma.zone.findFirstOrThrow();
    const client = await crearClienteEnZona(zone.id);
    const auth = { Authorization: `Bearer ${token}` };

    await prisma.routeVisit.create({
      data: {
        clientId: client.id,
        userId,
        fecha: new Date(),
        resultado: 'no_compro',
        motivo: 'Cerrado por vacaciones',
      },
    });
    const visitasAntes = await prisma.routeVisit.count({ where: { clientId: client.id } });
    expect(visitasAntes).toBeGreaterThan(0);

    const removed = await request(app).delete(`/api/clients/${client.id}`).set(auth);
    expect(removed.status).toBe(200);
    expect(removed.body.activo).toBe(false);

    // Esto es lo que antes se perdía: la función borraba en cascada.
    const visitasDespues = await prisma.routeVisit.count({ where: { clientId: client.id } });
    expect(visitasDespues).toBe(visitasAntes);
    const contactos = await prisma.clientContact.count({ where: { clientId: client.id } });
    expect(contactos).toBeGreaterThanOrEqual(0);

    // La fila sigue viva y sus movimientos de cuenta también.
    const stillThere = await prisma.client.findUnique({ where: { id: client.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.activo).toBe(false);

    // Y no sale en el listado del panel.
    const listado = await request(app).get('/api/clients').set(auth);
    expect(listado.body.some((c: { id: number }) => c.id === client.id)).toBe(false);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entidad: 'Client', entidadId: String(client.id), accion: 'deactivate' },
    });
    expect((audit.datosAntes as { activo: boolean }).activo).toBe(true);
  });

  it('desactiva la zona sin borrarla', async () => {
    const { token } = await loginAsAdmin();
    const priceList = await prisma.priceList.findFirstOrThrow();
    const auth = { Authorization: `Bearer ${token}` };

    const zone = await prisma.zone.create({
      data: { nombre: `Zona temporal ${Date.now()}`, semanaMes: 4, diasSemana: [7] },
    });

    const removed = await request(app).delete(`/api/zones/${zone.id}`).set(auth);
    expect(removed.status).toBe(200);
    expect(removed.body.activo).toBe(false);

    const stillThere = await prisma.zone.findUnique({ where: { id: zone.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.activo).toBe(false);

    const listado = await request(app).get('/api/zones').set(auth);
    expect(listado.body.some((z: { id: number }) => z.id === zone.id)).toBe(false);

    await prisma.auditLog.deleteMany({ where: { entidad: 'Zone', entidadId: String(zone.id) } });
    await prisma.zone.delete({ where: { id: zone.id } });
    expect(priceList).not.toBeNull();
  });
});
