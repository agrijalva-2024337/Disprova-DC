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

describe('presentaciones e imágenes', () => {
  it('crea una presentación, rechaza factor inválido y desactiva si tiene precio', async () => {
    const token = await loginAsAdmin();
    const product = await prisma.product.findFirstOrThrow();
    const list = await prisma.priceList.findFirstOrThrow();
    const auth = { Authorization: `Bearer ${token}` };
    const barcode = `CB-${Date.now()}`;

    const created = await request(app)
      .post(`/api/catalog/products/${product.id}/units`)
      .set(auth)
      .send({ nombre: 'Caja prueba', factor: '12', codigoBarras: barcode, precioBase: '40.00' });
    expect(created.status).toBe(201);
    expect(created.body.activo).toBe(true);

    const invalid = await request(app)
      .post(`/api/catalog/products/${product.id}/units`)
      .set(auth)
      .send({ nombre: 'Mala', factor: '0' });
    expect(invalid.status).toBe(400);

    const duplicate = await request(app)
      .post(`/api/catalog/products/${product.id}/units`)
      .set(auth)
      .send({ nombre: 'Otra', factor: '1', codigoBarras: barcode });
    expect(duplicate.status).toBe(409);

    await prisma.priceListItem.create({
      data: {
        priceListId: list.id,
        productUnitId: created.body.id,
        precio: '40.00',
        vigenteDesde: new Date('2026-01-01'),
      },
    });

    const removed = await request(app)
      .delete(`/api/catalog/products/${product.id}/units/${created.body.id}`)
      .set(auth);
    expect(removed.status).toBe(200);
    expect(removed.body.activo).toBe(false);
    const stillThere = await prisma.productUnit.findUnique({ where: { id: created.body.id } });
    expect(stillThere?.activo).toBe(false);
  });

  it('deja una sola imagen principal por producto', async () => {
    const token = await loginAsAdmin();
    const product = await prisma.product.findFirstOrThrow({ include: { images: true } });
    const auth = { Authorization: `Bearer ${token}` };
    const created = await request(app)
      .post(`/api/catalog/products/${product.id}/images`)
      .set(auth)
      .send({ url: 'https://placehold.co/200', esPrincipal: true, orden: 1 });
    expect(created.status).toBe(201);

    const images = await prisma.productImage.findMany({ where: { productId: product.id, esPrincipal: true } });
    expect(images).toHaveLength(1);
    expect(images[0]?.id).toBe(created.body.id);
  });
});
