import { describe, expect, it } from 'vitest';
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

describe('POST /api/catalog/products', () => {
  it('rechaza crear un producto sin token', async () => {
    const response = await request(app).post('/api/catalog/products').send({
      sku: 'TEST-NO-AUTH',
      nombre: 'Producto sin auth',
      categoryId: 1,
      unidadBase: 'unidad',
    });

    expect(response.status).toBe(401);
  });

  it('crea un producto como admin', async () => {
    const token = await loginAsAdmin();
    const category = await prisma.category.findFirst({ where: { parentId: null } });
    expect(category).not.toBeNull();

    const sku = `TEST-${Date.now()}`;
    const response = await request(app)
      .post('/api/catalog/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku,
        nombre: 'Producto de prueba',
        categoryId: category!.id,
        unidadBase: 'unidad',
        units: [{ nombre: 'Unidad', factor: '1', precioBase: '10.00' }],
        images: [{ url: 'https://placehold.co/100', esPrincipal: true }],
      });

    expect(response.status).toBe(201);
    expect(response.body.sku).toBe(sku);
    expect(response.body.units).toHaveLength(1);
    expect(response.body.images).toHaveLength(1);
  });

  it('rechaza crear un producto con un campo requerido faltante', async () => {
    const token = await loginAsAdmin();
    const category = await prisma.category.findFirst({ where: { parentId: null } });
    expect(category).not.toBeNull();

    const response = await request(app)
      .post('/api/catalog/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Sin SKU',
        categoryId: category!.id,
        unidadBase: 'unidad',
      });

    expect(response.status).toBe(400);
  });
});
