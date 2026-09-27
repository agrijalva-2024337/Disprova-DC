import { Prisma } from '@prisma/client';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { registerMovement } from '../inventory/inventory.service.js';

/**
 * Estos tests corren contra la base compartida. Sin limpiar, el cliente de
 * cobranza queda y `sales-territory.test.ts` —que exige que la zona de la
 * semana 1 tenga exactamente los 4 clientes del seed— falla según el orden
 * en que corren los archivos.
 */
const clientsCreados: number[] = [];

afterEach(async () => {
  const ids = clientsCreados.splice(0, clientsCreados.length);
  if (ids.length === 0) {
    return;
  }
  // Los rastro de auditoría se limpian por entidad+id, que es como los escribió
  // el módulo: el log no tiene llave foránea contra pagos ni pedidos.
  const pagos = await prisma.payment.findMany({ where: { clientId: { in: ids } }, select: { id: true } });
  const pedidos = await prisma.order.findMany({ where: { clientId: { in: ids } }, select: { id: true } });
  await prisma.auditLog.deleteMany({
    where: { entidad: 'Payment', entidadId: { in: pagos.map((p) => String(p.id)) } },
  });
  await prisma.auditLog.deleteMany({
    where: { entidad: 'Order', entidadId: { in: pedidos.map((p) => String(p.id)) } },
  });
  await prisma.paymentApplication.deleteMany({ where: { payment: { clientId: { in: ids } } } });
  await prisma.payment.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.collectionVisit.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.cashSession.deleteMany({ where: { payments: { some: { clientId: { in: ids } } } } }).catch(() => undefined);
  await prisma.deliveryItem.deleteMany({ where: { delivery: { order: { clientId: { in: ids } } } } });
  await prisma.delivery.deleteMany({ where: { order: { clientId: { in: ids } } } });
  await prisma.orderItem.deleteMany({ where: { order: { clientId: { in: ids } } } });
  await prisma.order.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.accountMovement.deleteMany({ where: { clientId: { in: ids } } });
  await prisma.client.deleteMany({ where: { id: { in: ids } } });
});

function equalsMoney(actual: string, expected: string) {
  return new Prisma.Decimal(actual).equals(new Prisma.Decimal(expected));
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

describe('cobranza', () => {
  it('carga la entrega a crédito, abona el pago y respeta el saldo al confirmar', async () => {
    const { token, userId } = await loginAsAdmin();
    const sample = await prisma.client.findFirstOrThrow();
    const client = await prisma.client.create({
      data: {
        nombreComercial: `Cobranza ${Date.now()}`,
        tipoNegocio: 'tienda',
        zoneId: sample.zoneId,
        ordenRuta: 8000 + (Date.now() % 1000),
        direccion: 'Calle de cobranza',
        priceListId: sample.priceListId,
        limiteCredito: '5000.00',
        plazoDias: 15,
      },
    });
    clientsCreados.push(client.id);
    const unit = await prisma.productUnit.findFirstOrThrow({
      where: { product: { sku: 'HIG-001' }, nombre: 'Unidad' },
      include: { product: true },
    });
    const vehicle = await prisma.warehouse.findFirstOrThrow({
      where: { tipo: 'vehiculo', activo: true, responsableUserId: userId },
    });
    await registerMovement({
      productId: unit.productId,
      warehouseId: vehicle.id,
      tipo: 'entrada',
      cantidad: '5',
      userId,
      referenciaTipo: 'test',
      referenciaId: 'cobranza-stock',
    });

    const order = await prisma.order.create({
      data: {
        clientId: client.id,
        userId,
        canal: 'campo',
        estado: 'borrador',
        condicionPago: 'credito',
        subtotal: '89.29',
        descuento: '0',
        impuesto: '10.71',
        total: '100.00',
        items: {
          create: {
            productUnitId: unit.id,
            cantidad: '1',
            precioUnitario: '89.29',
            descuento: '0',
            impuesto: '10.71',
            totalLinea: '100.00',
          },
        },
      },
      include: { items: true },
    });
    const other = await prisma.order.create({
      data: {
        clientId: client.id,
        userId,
        canal: 'campo',
        estado: 'borrador',
        condicionPago: 'contado',
        subtotal: '10.00',
        descuento: '0',
        impuesto: '1.20',
        total: '11.20',
        items: {
          create: {
            productUnitId: unit.id,
            cantidad: '1',
            precioUnitario: '10.00',
            descuento: '0',
            impuesto: '1.20',
            totalLinea: '11.20',
          },
        },
      },
    });

    const auth = { Authorization: `Bearer ${token}` };
    const confirmed = await request(app).post(`/api/orders/${order.id}/confirm`).set(auth);
    expect(confirmed.status).toBe(200);
    const delivered = await request(app)
      .post(`/api/orders/${order.id}/deliver`)
      .set(auth)
      .send({ items: [{ orderItemId: order.items[0].id, cantidadEntregada: '1' }] });
    expect(delivered.status).toBe(201);

    const afterDelivery = await prisma.accountMovement.findFirstOrThrow({
      where: { clientId: client.id, tipo: 'cargo' },
    });
    expect(equalsMoney(afterDelivery.monto.toString(), '100.00')).toBe(true);
    expect(equalsMoney(afterDelivery.saldoResultante.toString(), '100.00')).toBe(true);

    const payment = await request(app).post('/api/payments').set(auth).send({
      clientId: client.id,
      monto: '60.00',
      metodo: 'transferencia',
      referencia: 'TRX-60',
    });
    expect(payment.status).toBe(201);

    const paymentAudit = await prisma.auditLog.findFirstOrThrow({
      where: { entidad: 'Payment', entidadId: String(payment.body.id), accion: 'create' },
    });
    expect(paymentAudit.userId).toBe(userId);
    expect((paymentAudit.datosDespues as { monto: string; metodo: string }).monto).toBe('60.00');
    expect((paymentAudit.datosDespues as { metodo: string }).metodo).toBe('transferencia');

    const applied = await request(app)
      .post(`/api/payments/${payment.body.id}/apply`)
      .set(auth)
      .send({ applications: [{ orderId: order.id, monto: '50.00' }] });
    expect(applied.status).toBe(201);

    const applyAudit = await prisma.auditLog.findFirstOrThrow({
      where: { entidad: 'Payment', entidadId: String(payment.body.id), accion: 'apply' },
    });
    expect(applyAudit.userId).toBe(userId);
    const aplicadoAntes = applyAudit.datosAntes as { aplicado: string; pendiente: string };
    const aplicadoDespues = applyAudit.datosDespues as {
      aplicado: string;
      pendiente: string;
      aplicaciones: Array<{ orderId: number }>;
    };
    expect(aplicadoAntes.aplicado).toBe('0.00');
    expect(aplicadoAntes.pendiente).toBe('60.00');
    expect(aplicadoDespues.aplicado).toBe('50.00');
    expect(aplicadoDespues.pendiente).toBe('10.00');
    expect(aplicadoDespues.aplicaciones).toEqual([{ orderId: order.id, montoAplicado: '50.00' }]);

    const over = await request(app)
      .post(`/api/payments/${payment.body.id}/apply`)
      .set(auth)
      .send({ applications: [{ orderId: other.id, monto: '20.00' }] });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('APPLICATION_EXCEEDS_PAYMENT');
    expect(over.body.error.message).toContain('pendiente');

    const account = await request(app).get(`/api/clients/${client.id}/account`).set(auth);
    expect(account.status).toBe(200);
    expect(equalsMoney(account.body.saldoActual, '40.00')).toBe(true);
    expect(account.body.movements.map((row: { tipo: string }) => row.tipo)).toEqual(['cargo', 'abono']);

    await prisma.client.update({ where: { id: client.id }, data: { limiteCredito: '45.00' } });
    const next = await request(app)
      .post('/api/orders')
      .set(auth)
      .send({
        clientId: client.id,
        canal: 'campo',
        condicionPago: 'credito',
        items: [{ productUnitId: unit.id, cantidad: '1' }],
      });
    expect(next.status).toBe(201);
    const blocked = await request(app).post(`/api/orders/${next.body.id}/confirm`).set(auth);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('CREDIT_LIMIT_EXCEEDED');
    expect(blocked.body.error.message).toContain('Disponible');
  });

  it('rechaza un pago en efectivo sin caja abierta', async () => {
    const { token, userId } = await loginAsAdmin();
    const abierta = await prisma.cashSession.findFirst({ where: { userId, estado: 'abierta' } });
    if (abierta) {
      await prisma.cashSession.update({
        where: { id: abierta.id },
        data: { estado: 'cerrada', cerradaAt: new Date() },
      });
    }
    const client = await prisma.client.findFirstOrThrow();
    const response = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client.id, monto: '10.00', metodo: 'efectivo' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CASH_SESSION_REQUIRED');
    expect(response.body.error.message).toContain('caja abierta');
  });
});