import { Prisma } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { registerMovement } from '../inventory/inventory.service.js';

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

    const applied = await request(app)
      .post(`/api/payments/${payment.body.id}/apply`)
      .set(auth)
      .send({ applications: [{ orderId: order.id, monto: '50.00' }] });
    expect(applied.status).toBe(201);

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