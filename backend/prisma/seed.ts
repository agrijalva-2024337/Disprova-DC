import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.priceListItem.deleteMany();
  await prisma.priceList.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productUnit.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany({ where: { parentId: { not: null } } });
  await prisma.category.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  const adminRole = await prisma.role.create({
    data: {
      nombre: 'admin',
      permisos: {
        modulos: ['seguridad', 'catalogo', 'inventario', 'ventas', 'cobranza'],
        acciones: ['*'],
      },
    },
  });

  const vendedorRole = await prisma.role.create({
    data: {
      nombre: 'vendedor',
      permisos: {
        modulos: ['catalogo', 'ventas'],
        acciones: ['read', 'create_pedido'],
      },
    },
  });

  const passwordHash = await bcrypt.hash('Admin123!', 10);

  await prisma.user.create({
    data: {
      nombre: 'Administrador Demo',
      email: 'admin@disprova.local',
      passwordHash,
      roleId: adminRole.id,
      activo: true,
    },
  });

  const catMedicamentos = await prisma.category.create({
    data: { nombre: 'Medicamentos', orden: 1, activo: true },
  });

  const catHigiene = await prisma.category.create({
    data: {
      nombre: 'Higiene personal',
      parentId: catMedicamentos.id,
      orden: 2,
      activo: true,
    },
  });

  const catBebidas = await prisma.category.create({
    data: { nombre: 'Bebidas', orden: 3, activo: true },
  });

  const productsSeed = [
    {
      sku: 'MED-001',
      nombre: 'Paracetamol 500 mg',
      descripcion: 'Analgésico y antipirético',
      categoryId: catMedicamentos.id,
      marca: 'Genfar',
      unidadBase: 'tableta',
      controlado: false,
      units: [
        { nombre: 'Blister x10', factor: '10', precioBase: '12.50', codigoBarras: '7501234567890' },
        { nombre: 'Caja x100', factor: '100', precioBase: '95.00', codigoBarras: '7501234567891' },
      ],
    },
    {
      sku: 'MED-002',
      nombre: 'Ibuprofeno 400 mg',
      descripcion: 'Antiinflamatorio',
      categoryId: catMedicamentos.id,
      marca: 'MK',
      unidadBase: 'tableta',
      controlado: false,
      units: [
        { nombre: 'Blister x10', factor: '10', precioBase: '15.00', codigoBarras: '7501234567892' },
      ],
    },
    {
      sku: 'HIG-001',
      nombre: 'Jabón antibacterial',
      descripcion: 'Barra 90 g',
      categoryId: catHigiene.id,
      marca: 'Protex',
      unidadBase: 'unidad',
      controlado: false,
      units: [
        { nombre: 'Unidad', factor: '1', precioBase: '8.75', codigoBarras: '7501234567893' },
        { nombre: 'Paquete x6', factor: '6', precioBase: '48.00', codigoBarras: '7501234567894' },
      ],
    },
    {
      sku: 'BEB-001',
      nombre: 'Agua purificada 600 ml',
      descripcion: 'Botella PET',
      categoryId: catBebidas.id,
      marca: 'Crystal',
      unidadBase: 'botella',
      controlado: false,
      units: [
        { nombre: 'Unidad', factor: '1', precioBase: '3.50', codigoBarras: '7501234567895' },
        { nombre: 'Six pack', factor: '6', precioBase: '18.00', codigoBarras: '7501234567896' },
      ],
    },
    {
      sku: 'MED-003',
      nombre: 'Amoxicilina 500 mg',
      descripcion: 'Antibiótico — venta controlada',
      categoryId: catMedicamentos.id,
      marca: 'Sanofi',
      unidadBase: 'cápsula',
      controlado: true,
      units: [
        { nombre: 'Blister x12', factor: '12', precioBase: '42.00', codigoBarras: '7501234567897' },
      ],
    },
  ] as const;

  const createdUnits: { id: number; precioLista: string }[] = [];

  for (const p of productsSeed) {
    const product = await prisma.product.create({
      data: {
        sku: p.sku,
        nombre: p.nombre,
        descripcion: p.descripcion,
        categoryId: p.categoryId,
        marca: p.marca,
        unidadBase: p.unidadBase,
        controlado: p.controlado,
        activo: true,
        units: {
          create: p.units.map((u) => ({
            nombre: u.nombre,
            factor: u.factor,
            precioBase: u.precioBase,
            codigoBarras: u.codigoBarras,
          })),
        },
        images: {
          create: {
            url: `https://placehold.co/400x400?text=${encodeURIComponent(p.sku)}`,
            orden: 0,
            esPrincipal: true,
          },
        },
      },
      include: { units: true },
    });

    for (const unit of product.units) {
      createdUnits.push({
        id: unit.id,
        precioLista: unit.precioBase.toString(),
      });
    }
  }

  const listaGeneral = await prisma.priceList.create({
    data: {
      nombre: 'Lista general',
      descripcion: 'Precios de referencia para mostrador y ruta',
      activo: true,
    },
  });

  const vigenteDesde = new Date('2026-01-01');

  await prisma.priceListItem.createMany({
    data: createdUnits.map((u) => ({
      priceListId: listaGeneral.id,
      productUnitId: u.id,
      precio: u.precioLista,
      vigenteDesde,
    })),
  });

  console.log('Seed OK:', {
    roles: [adminRole.nombre, vendedorRole.nombre],
    adminEmail: 'admin@disprova.local',
    categories: 3,
    products: productsSeed.length,
    productUnits: createdUnits.length,
    priceList: listaGeneral.nombre,
    priceListItems: createdUnits.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
