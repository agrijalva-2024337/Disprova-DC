import { Prisma } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { desgloseLinea } from '../../shared/money/iva.js';

describe('desglose de IVA incluido', () => {
  it('3 unidades a Q 11.20 dan total 33.60, impuesto 3.60 y subtotal 30.00', () => {
    const desglose = desgloseLinea({ precioUnitario: '11.20', cantidad: '3' });
    expect(desglose.total.toFixed(2)).toBe('33.60');
    expect(desglose.impuesto.toFixed(2)).toBe('3.60');
    expect(desglose.subtotal.toFixed(2)).toBe('30.00');
  });
});

describe('precio congelado en el pedido', () => {
  it('no cambia la línea si después cambia el precio del producto', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'admin@disprova.local',
      password: 'Admin123!',
    });
    expect(login.status).toBe(200);
    const token = login.body.accessToken as string;

    const client = await prisma.client.findFirstOrThrow({ where: { priceListId: { gt: 0 } } });
    const precio = await prisma.priceListItem.findFirstOrThrow({
      where: { priceListId: client.priceListId!, activo: true },
      orderBy: { id: 'asc' },
    });
    const anterior = new Prisma.Decimal(precio.precio).toFixed(2);
    let orderId: number | null = null;

    try {
      await prisma.priceListItem.update({
        where: { id: precio.id },
        data: { precio: '11.20' },
      });

      const created = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientId: client.id,
          canal: 'campo',
          condicionPago: 'contado',
          items: [{ productUnitId: precio.productUnitId, cantidad: '3' }],
        });
      expect(created.status).toBe(201);
      orderId = created.body.id as number;
      expect(new Prisma.Decimal(created.body.total).toFixed(2)).toBe('33.60');
      expect(new Prisma.Decimal(created.body.impuesto).toFixed(2)).toBe('3.60');
      expect(new Prisma.Decimal(created.body.subtotal).toFixed(2)).toBe('30.00');

      const linea = await prisma.orderItem.findFirstOrThrow({ where: { orderId } });
      expect(new Prisma.Decimal(linea.precioUnitario).toFixed(2)).toBe('11.20');
      expect(new Prisma.Decimal(linea.totalLinea).toFixed(2)).toBe('33.60');
      expect(new Prisma.Decimal(linea.impuesto).toFixed(2)).toBe('3.60');

      await prisma.priceListItem.update({
        where: { id: precio.id },
        data: { precio: '99.99' },
      });

      const congelada = await prisma.orderItem.findFirstOrThrow({ where: { orderId } });
      expect(new Prisma.Decimal(congelada.precioUnitario).toFixed(2)).toBe('11.20');
      expect(new Prisma.Decimal(congelada.totalLinea).toFixed(2)).toBe('33.60');
    } finally {
      await prisma.priceListItem.update({
        where: { id: precio.id },
        data: { precio: anterior },
      });
      if (orderId !== null) {
        await prisma.auditLog.deleteMany({
          where: { entidad: 'Order', entidadId: String(orderId) },
        });
        await prisma.orderItem.deleteMany({ where: { orderId } });
        await prisma.order.deleteMany({ where: { id: orderId } });
      }
    }
  });
});
