import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { registerMovement } from '../src/modules/inventory/inventory.service.js';

const prisma = new PrismaClient();

async function main() {
  await prisma.inventoryMovement.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.productBatch.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.routeVisit.deleteMany();
  await prisma.clientContact.deleteMany();
  await prisma.client.deleteMany();
  await prisma.zone.deleteMany();
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

  const admin = await prisma.user.create({
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
  const createdProducts: { id: number; sku: string }[] = [];

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

    createdProducts.push({ id: product.id, sku: product.sku });

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

  const zonaSemana1 = await prisma.zone.create({
    data: {
      nombre: 'Zona Mixco',
      semanaMes: 1,
      diasSemana: [1, 3, 5],
      activo: true,
    },
  });

  const zonaSemana2 = await prisma.zone.create({
    data: {
      nombre: 'Zona Villa Nueva',
      semanaMes: 2,
      diasSemana: [2, 4],
      activo: true,
    },
  });

  const clientsSeed = [
    {
      nombreComercial: 'Abarrotes El Portal',
      nit: '1234567-8',
      tipoNegocio: 'tienda' as const,
      zoneId: zonaSemana1.id,
      ordenRuta: 1,
      direccion: 'Calzada Roosevelt 12-40, Mixco',
      lat: '14.6331000',
      lng: '-90.6067000',
      limiteCredito: '5000.00',
      plazoDias: 15,
      contacto: { nombre: 'Marta López', telefono: '5511-1001', esWhatsapp: true, aceptaMensajes: true },
    },
    {
      nombreComercial: 'Farmacia San Rafael',
      nit: '8765432-1',
      tipoNegocio: 'farmacia' as const,
      zoneId: zonaSemana1.id,
      ordenRuta: 2,
      direccion: '4a avenida 8-12, Mixco',
      limiteCredito: '8000.00',
      plazoDias: 30,
      contacto: { nombre: 'Carlos Méndez', telefono: '5511-1002', esWhatsapp: true, aceptaMensajes: false },
    },
    {
      nombreComercial: 'Mercado La Reformita',
      nit: null,
      tipoNegocio: 'mercado' as const,
      zoneId: zonaSemana1.id,
      ordenRuta: 3,
      direccion: 'Interior mercado La Reformita, local 22',
      limiteCredito: '1500.00',
      plazoDias: 7,
      contacto: { nombre: 'Rosa Chávez', telefono: '5511-1003', esWhatsapp: false, aceptaMensajes: false },
    },
    {
      nombreComercial: 'Mini Super Los Pinos',
      nit: '4455667-0',
      tipoNegocio: 'tienda' as const,
      zoneId: zonaSemana1.id,
      ordenRuta: 4,
      direccion: 'Boulevard El Naranjo 3-15, Mixco',
      limiteCredito: '3000.00',
      plazoDias: 15,
      contacto: { nombre: 'Luis Gómez', telefono: '5511-1004', esWhatsapp: true, aceptaMensajes: true },
    },
    {
      nombreComercial: 'Farmacia Villa Nueva',
      nit: '9988776-5',
      tipoNegocio: 'farmacia' as const,
      zoneId: zonaSemana2.id,
      ordenRuta: 1,
      direccion: 'Calzada Concepción 18-20, Villa Nueva',
      lat: '14.5258000',
      lng: '-90.5876000',
      limiteCredito: '10000.00',
      plazoDias: 30,
      contacto: { nombre: 'Ana Ruiz', telefono: '5511-2001', esWhatsapp: true, aceptaMensajes: true },
    },
    {
      nombreComercial: 'Tienda Doña Julia',
      nit: null,
      tipoNegocio: 'tienda' as const,
      zoneId: zonaSemana2.id,
      ordenRuta: 2,
      direccion: '2a calle 5-08, Villa Nueva',
      limiteCredito: '800.00',
      plazoDias: 0,
      contacto: { nombre: 'Julia Pérez', telefono: '5511-2002', esWhatsapp: false, aceptaMensajes: false },
    },
    {
      nombreComercial: 'Puesto Mercado Central',
      nit: '1122334-4',
      tipoNegocio: 'mercado' as const,
      zoneId: zonaSemana2.id,
      ordenRuta: 3,
      direccion: 'Mercado central, pasillo B, puesto 14',
      limiteCredito: '2000.00',
      plazoDias: 7,
      contacto: { nombre: 'Pedro Hernández', telefono: '5511-2003', esWhatsapp: true, aceptaMensajes: false },
    },
    {
      nombreComercial: 'Distribuidora El Paso',
      nit: '6677889-9',
      tipoNegocio: 'otro' as const,
      zoneId: zonaSemana2.id,
      ordenRuta: 4,
      direccion: 'Km 17.5 carretera al Pacífico',
      limiteCredito: '15000.00',
      plazoDias: 21,
      contacto: { nombre: 'Elena Vásquez', telefono: '5511-2004', esWhatsapp: true, aceptaMensajes: true },
    },
  ];

  for (const client of clientsSeed) {
    const { contacto, ...clientData } = client;
    const created = await prisma.client.create({
      data: {
        ...clientData,
        priceListId: listaGeneral.id,
        activo: true,
      },
    });
    await prisma.clientContact.create({
      data: {
        clientId: created.id,
        nombre: contacto.nombre,
        telefono: contacto.telefono,
        esWhatsapp: contacto.esWhatsapp,
        aceptaMensajes: contacto.aceptaMensajes,
        esPrincipal: true,
      },
    });
  }

  const bodega = await prisma.warehouse.create({
    data: { nombre: 'Bodega central', tipo: 'bodega', responsableUserId: admin.id, activo: true },
  });
  await prisma.warehouse.create({
    data: { nombre: 'Vehículo ruta 1', tipo: 'vehiculo', responsableUserId: admin.id, activo: true },
  });

  const entradasIniciales: Record<string, string> = {
    'MED-001': '120',
    'MED-002': '80',
    'HIG-001': '200',
    'BEB-001': '48',
    'MED-003': '60',
  };

  for (const product of createdProducts) {
    await registerMovement({
      productId: product.id,
      warehouseId: bodega.id,
      tipo: 'entrada',
      cantidad: entradasIniciales[product.sku] ?? '0',
      referenciaTipo: 'seed',
      referenciaId: 'stock-inicial',
      userId: admin.id,
    });
  }

  console.log('Seed OK:', {
    roles: [adminRole.nombre, vendedorRole.nombre],
    adminEmail: 'admin@disprova.local',
    categories: 3,
    products: productsSeed.length,
    productUnits: createdUnits.length,
    priceList: listaGeneral.nombre,
    priceListItems: createdUnits.length,
    zones: 2,
    clients: clientsSeed.length,
    principalContacts: clientsSeed.length,
    warehouses: 2,
    stockEntradas: createdProducts.length,
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
