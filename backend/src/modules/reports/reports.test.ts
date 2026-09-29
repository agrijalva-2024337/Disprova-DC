import { Prisma } from '@prisma/client';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { todayDate } from '../sales/sales.service.js';

function equalsMoney(actual: string, expected: string) {
  return new Prisma.Decimal(actual).equals(expected);
}

async function loginAsAdmin() {
  const response = await request(app).post('/api/auth/login').send({
    email: 'admin@disprova.local',
    password: 'Admin123!',
  });
  expect(response.status).toBe(200);
  return response.body.accessToken as string;
}

/**
 * Estos tests corren contra la base compartida. Sin esta limpieza los
 * clientes de prueba quedan y `sales-territory.test.ts`, que exige que la
 * zona de la semana 1 tenga exactamente los 4 clientes del seed, falla
 * según el orden en que corren los archivos.
 */
const creados = { users: [] as number[], clients: [] as number[] };

afterEach(async () => {
  const { users, clients } = creados;
  creados.users = [];
  creados.clients = [];

  if (clients.length > 0) {
    // Las entregas van primero: `delivery_items` y `deliveries` cuelgan de los
    // pedidos, y los pedidos de los clientes de prueba.
    await prisma.deliveryItem.deleteMany({ where: { delivery: { order: { clientId: { in: clients } } } } });
    await prisma.delivery.deleteMany({ where: { order: { clientId: { in: clients } } } });
    await prisma.orderItem.deleteMany({ where: { order: { clientId: { in: clients } } } });
    await prisma.order.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.paymentApplication.deleteMany({ where: { payment: { clientId: { in: clients } } } });
    await prisma.payment.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.collectionVisit.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.accountMovement.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.clientContact.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.client.deleteMany({ where: { id: { in: clients } } });
  }
  if (users.length > 0) {
    await prisma.deliveryItem.deleteMany({ where: { delivery: { userId: { in: users } } } });
    await prisma.delivery.deleteMany({ where: { userId: { in: users } } });
    await prisma.order.deleteMany({ where: { userId: { in: users } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  }
});

let contador = 0;
function sufijo() {
  contador += 1;
  return `${Math.floor(Math.random() * 1e9)}-${contador}`;
}

async function sellerAndClient(_suffix: string) {
  const role = await prisma.role.findFirstOrThrow({ where: { nombre: 'admin' } });
  const sample = await prisma.client.findFirstOrThrow();
  const suffix = sufijo();
  const seller = await prisma.user.create({
    data: {
      nombre: `Vendedor ${suffix}`,
      email: `reporte-${suffix}@disprova.local`,
      passwordHash: 'no-login',
      roleId: role.id,
    },
  });
  const client = await prisma.client.create({
    data: {
      nombreComercial: `Cliente ${suffix}`,
      tipoNegocio: 'tienda',
      zoneId: sample.zoneId,
      ordenRuta: 20000 + Math.floor(Math.random() * 20000),
      direccion: 'Reporte',
      priceListId: sample.priceListId,
      limiteCredito: '1000',
      plazoDias: 0,
    },
  });
  creados.users.push(seller.id);
  creados.clients.push(client.id);
  return { seller, client };
}

describe('reportes', () => {
  it('suma lo ENTREGADO hoy por vendedor y por condición de pago', async () => {
    const token = await loginAsAdmin();
    const { seller, client } = await sellerAndClient('venta');
    const base = {
      clientId: client.id,
      userId: seller.id,
      canal: 'campo' as const,
      subtotal: '0',
      descuento: '0',
      impuesto: '0',
    };
    const unit = await prisma.productUnit.findFirstOrThrow({ where: { activo: true } });

    // Dos pedidos entregados hoy, uno al contado y otro a crédito.
    const contado = await prisma.order.create({
      data: {
        ...base,
        estado: 'entregado',
        condicionPago: 'contado',
        subtotal: '100.00',
        total: '100.00',
        items: {
          create: [
            { productUnitId: unit.id, cantidad: '1', precioUnitario: '100.00', impuesto: '0', totalLinea: '100.00' },
          ],
        },
      },
      include: { items: true },
    });
    const credito = await prisma.order.create({
      data: {
        ...base,
        estado: 'entregado',
        condicionPago: 'credito',
        subtotal: '40.00',
        total: '40.00',
        items: {
          create: [
            { productUnitId: unit.id, cantidad: '1', precioUnitario: '40.00', impuesto: '0', totalLinea: '40.00' },
          ],
        },
      },
      include: { items: true },
    });

    const entrega = await prisma.delivery.create({
      data: {
        orderId: contado.id,
        userId: seller.id,
        fecha: todayDate(),
        estado: 'completa',
        items: {
          create: [{ orderItemId: contado.items[0].id, cantidadEntregada: '1' }],
        },
      },
    });
    await prisma.delivery.create({
      data: {
        orderId: credito.id,
        userId: seller.id,
        fecha: todayDate(),
        estado: 'completa',
        items: {
          create: [{ orderItemId: credito.items[0].id, cantidadEntregada: '1' }],
        },
      },
    });

    // Un pedido entregado AYER no cuenta como venta de hoy, aunque se haya
    // tomado hoy. Antes se contaban los `createdAt` del día y esto no se
    // distinguía.
    const ayer = new Date(todayDate());
    ayer.setUTCDate(ayer.getUTCDate() - 1);
    await prisma.delivery.update({ where: { id: entrega.id }, data: { fecha: ayer } });

    const response = await request(app)
      .get('/api/reports/sales-today')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const row = response.body.porVendedor.find((item: { userId: number }) => item.userId === seller.id);
    // Solo el de crédito, que se entregó hoy.
    expect(equalsMoney(row.contado, '0')).toBe(true);
    expect(equalsMoney(row.credito, '40.00')).toBe(true);
    expect(equalsMoney(row.total, '40.00')).toBe(true);

    // Y el de ayer vuelve a contar cuando la entrega es de hoy.
    await prisma.delivery.update({ where: { id: entrega.id }, data: { fecha: todayDate() } });
    const otra = await request(app)
      .get('/api/reports/sales-today')
      .set('Authorization', `Bearer ${token}`);
    const row2 = otra.body.porVendedor.find((item: { userId: number }) => item.userId === seller.id);
    expect(equalsMoney(row2.contado, '100.00')).toBe(true);
    expect(equalsMoney(row2.total, '140.00')).toBe(true);
  });

  it('suma lo cobrado hoy por vendedor', async () => {
    const token = await loginAsAdmin();
    const { seller, client } = await sellerAndClient('cobro');
    const yesterday = new Date(todayDate());
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    await prisma.payment.create({
      data: {
        clientId: client.id,
        userId: seller.id,
        fecha: new Date(),
        monto: '30.00',
        metodo: 'transferencia',
      },
    });
    await prisma.payment.create({
      data: {
        clientId: client.id,
        userId: seller.id,
        fecha: yesterday,
        monto: '80.00',
        metodo: 'transferencia',
      },
    });

    const response = await request(app)
      .get('/api/reports/collections-today')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const row = response.body.porVendedor.find((item: { userId: number }) => item.userId === seller.id);
    expect(equalsMoney(row.total, '30.00')).toBe(true);
  });

  it('lista clientes con saldo y pone primero la deuda más vieja', async () => {
    const token = await loginAsAdmin();
    const oldOne = await sellerAndClient('viejo');
    const youngOne = await sellerAndClient('joven');
    const daysAgo = (days: number) => {
      const date = new Date(todayDate());
      date.setUTCDate(date.getUTCDate() - days);
      return date;
    };
    await prisma.accountMovement.create({
      data: {
        clientId: oldOne.client.id,
        tipo: 'cargo',
        referenciaTipo: 'test',
        referenciaId: `old-${oldOne.client.id}`,
        monto: '100.00',
        saldoResultante: '100.00',
        fecha: daysAgo(100),
      },
    });
    await prisma.accountMovement.create({
      data: {
        clientId: youngOne.client.id,
        tipo: 'cargo',
        referenciaTipo: 'test',
        referenciaId: `young-${youngOne.client.id}`,
        monto: '20.00',
        saldoResultante: '20.00',
        fecha: daysAgo(20),
      },
    });

    const response = await request(app)
      .get('/api/reports/aging')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const ids = response.body.map((row: { clientId: number }) => row.clientId);
    expect(ids.indexOf(oldOne.client.id)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(oldOne.client.id)).toBeLessThan(ids.indexOf(youngOne.client.id));
    const older = response.body.find((row: { clientId: number }) => row.clientId === oldOne.client.id);
    expect(equalsMoney(older.buckets['60+'], '100.00')).toBe(true);
    expect(equalsMoney(older.saldoActual, '100.00')).toBe(true);
  });
});