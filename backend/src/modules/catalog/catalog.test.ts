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

  it('desactiva el producto en vez de borrarlo y conserva el histórico', async () => {
    const token = await loginAsAdmin();
    const category = await prisma.category.findFirstOrThrow({ where: { parentId: null } });
    const auth = { Authorization: `Bearer ${token}` };
    const sku = `BORRADO-${Date.now()}`;

    const created = await request(app)
      .post('/api/catalog/products')
      .set(auth)
      .send({
        sku,
        nombre: 'Producto que se desactiva',
        categoryId: category.id,
        unidadBase: 'unidad',
        units: [{ nombre: 'Unidad', factor: '1', precioBase: '10.00' }],
      });
    expect(created.status).toBe(201);
    const id = created.body.id as number;

    const removed = await request(app).delete(`/api/catalog/products/${id}`).set(auth);
    expect(removed.status).toBe(200);
    expect(removed.body.activo).toBe(false);

    // La fila sigue viva: un pedido viejo tiene que seguir mostrando su nombre.
    const stillThere = await prisma.product.findUnique({ where: { id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.activo).toBe(false);
    expect(stillThere?.sku).toBe(sku);

    // Y no aparece en el catálogo operativo.
    const listado = await request(app).get('/api/catalog/products').set(auth);
    expect(listado.body.some((p: { id: number }) => p.id === id)).toBe(false);

    // Desactivarlo dos veces no es un error silencioso.
    const otra = await request(app).delete(`/api/catalog/products/${id}`).set(auth);
    expect(otra.status).toBe(409);
    expect(otra.body.error.code).toBe('ALREADY_INACTIVE');

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entidad: 'Product', entidadId: String(id), accion: 'deactivate' },
    });
    expect((audit.datosAntes as { activo: boolean }).activo).toBe(true);

    await prisma.auditLog.deleteMany({ where: { entidad: 'Product', entidadId: String(id) } });
    await prisma.productUnit.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
  });

  it('desactiva un precio y deja de aplicarlo sin borrarlo', async () => {
    const token = await loginAsAdmin();
    const list = await prisma.priceList.findFirstOrThrow();
    const unit = await prisma.productUnit.findFirstOrThrow();
    const auth = { Authorization: `Bearer ${token}` };
    // Una fecha única: (lista, presentación, vigenteDesde) es único y el seed
    // ya tiene precios cargados para casi todas las combinaciones.
    const vigenteDesde = new Date(`2026-0${(Date.now() % 8) + 1}-15`);

    const item = await prisma.priceListItem.create({
      data: {
        priceListId: list.id,
        productUnitId: unit.id,
        precio: '77.00',
        vigenteDesde,
        activo: true,
      },
    });

    const removed = await request(app).delete(`/api/catalog/price-list-items/${item.id}`).set(auth);
    expect(removed.status).toBe(200);
    expect(removed.body.activo).toBe(false);

    // El registro queda: la historia de a cuánto se vendió no se pierde.
    const stillThere = await prisma.priceListItem.findUnique({ where: { id: item.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.activo).toBe(false);

    // Y ya no aparece en el listado de precios vigentes.
    const listado = await request(app).get('/api/catalog/price-list-items').set(auth);
    expect(listado.body.some((i: { id: number }) => i.id === item.id)).toBe(false);

    await prisma.auditLog.deleteMany({
      where: { entidad: 'PriceListItem', entidadId: String(item.id) },
    });
    await prisma.priceListItem.delete({ where: { id: item.id } });
  });
});
