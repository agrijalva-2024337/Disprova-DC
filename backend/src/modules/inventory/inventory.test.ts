import { Prisma } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { registerMovement } from './inventory.service.js';

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

function signedEffect(tipo: string, cantidad: Prisma.Decimal) {
  if (tipo === 'entrada' || tipo === 'traslado_entrada' || tipo === 'ajuste') {
    return cantidad;
  }
  if (tipo === 'salida' || tipo === 'traslado_salida' || tipo === 'merma') {
    return cantidad.neg();
  }
  return new Prisma.Decimal(0);
}

describe('inventory registerMovement', () => {
  it('rechaza una salida mayor a la disponible y no toca stock', async () => {
    const { userId } = await loginAsAdmin();
    const stock = await prisma.stock.findFirst({
      where: { product: { controlado: false }, batchId: null },
      include: { product: true },
    });
    expect(stock).not.toBeNull();
    const before = {
      cantidad: stock!.cantidad.toString(),
      reservada: stock!.cantidadReservada.toString(),
    };

    await expect(
      registerMovement({
        productId: stock!.productId,
        warehouseId: stock!.warehouseId,
        tipo: 'salida',
        cantidad: '999999',
        userId,
      }),
    ).rejects.toMatchObject({
      name: 'AppError',
      code: 'INSUFFICIENT_STOCK',
    });

    const after = await prisma.stock.findUniqueOrThrow({ where: { id: stock!.id } });
    expect(after.cantidad.toString()).toBe(before.cantidad);
    expect(after.cantidadReservada.toString()).toBe(before.reservada);
    expect(after).toBeTruthy();
  });

  it('rechaza salida de producto controlado sin batch_id', async () => {
    const { userId } = await loginAsAdmin();
    const product = await prisma.product.findFirstOrThrow({ where: { controlado: true } });
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { tipo: 'bodega' } });
    const before = await prisma.stock.findMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });

    const error = await registerMovement({
      productId: product.id,
      warehouseId: warehouse.id,
      tipo: 'salida',
      cantidad: '1',
      userId,
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('BATCH_REQUIRED');

    const after = await prisma.stock.findMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    expect(after.map((row) => row.cantidad.toString())).toEqual(before.map((row) => row.cantidad.toString()));
  });

  it('un traslado mueve la cantidad y comparte referencia_id', async () => {
    const { token, userId } = await loginAsAdmin();
    const origen = await prisma.warehouse.findFirstOrThrow({ where: { tipo: 'bodega' } });
    const destino = await prisma.warehouse.findFirstOrThrow({ where: { tipo: 'vehiculo' } });
    const product = await prisma.product.findFirstOrThrow({ where: { controlado: false, sku: 'HIG-001' } });

    await registerMovement({
      productId: product.id,
      warehouseId: origen.id,
      tipo: 'entrada',
      cantidad: '10',
      userId,
      referenciaTipo: 'test',
      referenciaId: 'setup-traslado',
    });

    const beforeOrigen = await prisma.stock.findFirstOrThrow({
      where: { productId: product.id, warehouseId: origen.id, batchId: null },
    });
    const beforeDestino = await prisma.stock.findFirst({
      where: { productId: product.id, warehouseId: destino.id, batchId: null },
    });

    const response = await request(app)
      .post('/api/inventory/movements/traslado')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        warehouseIdOrigen: origen.id,
        warehouseIdDestino: destino.id,
        cantidad: '4',
      });

    expect(response.status).toBe(201);
    expect(response.body.salida.referenciaId).toBe(response.body.entrada.referenciaId);
    expect(response.body.salida.tipo).toBe('traslado_salida');
    expect(response.body.entrada.tipo).toBe('traslado_entrada');

    const afterOrigen = await prisma.stock.findFirstOrThrow({
      where: { productId: product.id, warehouseId: origen.id, batchId: null },
    });
    const afterDestino = await prisma.stock.findFirstOrThrow({
      where: { productId: product.id, warehouseId: destino.id, batchId: null },
    });

    expect(new Prisma.Decimal(afterOrigen.cantidad).toString()).toBe(
      new Prisma.Decimal(beforeOrigen.cantidad).sub(4).toString(),
    );
    const destinoAntes = beforeDestino ? new Prisma.Decimal(beforeDestino.cantidad) : new Prisma.Decimal(0);
    expect(new Prisma.Decimal(afterDestino.cantidad).toString()).toBe(destinoAntes.add(4).toString());
  });

  it('la columna cacheada coincide con la suma de movimientos', async () => {
    const { userId } = await loginAsAdmin();
    const product = await prisma.product.findFirstOrThrow({ where: { controlado: false, sku: 'BEB-001' } });
    const warehouse = await prisma.warehouse.create({
      data: { nombre: `Bodega kardex ${Date.now()}`, tipo: 'bodega', activo: true },
    });

    const steps: Array<{ tipo: 'entrada' | 'salida' | 'reserva' | 'liberacion_reserva' | 'ajuste' | 'merma'; cantidad: string }> = [
      { tipo: 'entrada', cantidad: '20' },
      { tipo: 'salida', cantidad: '5' },
      { tipo: 'reserva', cantidad: '4' },
      { tipo: 'liberacion_reserva', cantidad: '1' },
      { tipo: 'ajuste', cantidad: '3' },
      { tipo: 'merma', cantidad: '2' },
    ];

    for (const step of steps) {
      await registerMovement({
        productId: product.id,
        warehouseId: warehouse.id,
        tipo: step.tipo,
        cantidad: step.cantidad,
        userId,
        referenciaTipo: 'test',
        referenciaId: 'kardex',
      });
    }

    const movements = await prisma.inventoryMovement.findMany({
      where: { productId: product.id, warehouseId: warehouse.id, batchId: null },
    });
    const stock = await prisma.stock.findFirstOrThrow({
      where: { productId: product.id, warehouseId: warehouse.id, batchId: null },
    });

    const summed = movements.reduce(
      (total, movement) => total.add(signedEffect(movement.tipo, new Prisma.Decimal(movement.cantidad))),
      new Prisma.Decimal(0),
    );
    const reserved = movements.reduce((total, movement) => {
      if (movement.tipo === 'reserva') {
        return total.add(movement.cantidad);
      }
      if (movement.tipo === 'liberacion_reserva') {
        return total.sub(movement.cantidad);
      }
      return total;
    }, new Prisma.Decimal(0));

    expect(summed.toString()).toBe(new Prisma.Decimal(stock.cantidad).toString());
    expect(reserved.toString()).toBe(new Prisma.Decimal(stock.cantidadReservada).toString());
  });
});
