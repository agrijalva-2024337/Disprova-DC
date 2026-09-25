import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import type {
  CreateCategoryInput,
  CreatePriceListInput,
  CreatePriceListItemInput,
  CreateProductInput,
  UpdateCategoryInput,
  UpdatePriceListInput,
  UpdatePriceListItemInput,
  UpdateProductInput,
  CreateProductImageInput,
  CreateProductUnitInput,
  UpdateProductImageInput,
  UpdateProductUnitInput,
} from './catalog.schema.js';

const productInclude = {
  units: true,
  images: true,
} as const;

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function rethrowPrisma(err: unknown): never {
  if (err instanceof AppError) {
    throw err;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      throw new AppError('Ya existe un registro con esos datos', 409, 'CONFLICT');
    }
    if (err.code === 'P2003' || err.code === 'P2014') {
      throw new AppError(
        'No se puede completar la operación por referencias existentes',
        409,
        'CONFLICT',
      );
    }
    if (err.code === 'P2025') {
      throw new AppError('No encontrado', 404, 'NOT_FOUND');
    }
  }
  throw err;
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  data: {
    userId: number;
    entidad: string;
    entidadId: string;
    accion: string;
    datosAntes?: unknown;
    datosDespues?: unknown;
  },
) {
  await tx.auditLog.create({
    data: {
      userId: data.userId,
      entidad: data.entidad,
      entidadId: data.entidadId,
      accion: data.accion,
      datosAntes: toJson(data.datosAntes),
      datosDespues: toJson(data.datosDespues),
    },
  });
}

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
  });
}

export async function getCategory(id: number) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    throw new AppError('Categoría no encontrada', 404, 'NOT_FOUND');
  }
  return category;
}

export async function createCategory(input: CreateCategoryInput, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.category.create({ data: input });
      await writeAudit(tx, {
        userId,
        entidad: 'Category',
        entidadId: String(created.id),
        accion: 'create',
        datosDespues: created,
      });
      return created;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function updateCategory(id: number, input: UpdateCategoryInput, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.category.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Categoría no encontrada', 404, 'NOT_FOUND');
      }
      const updated = await tx.category.update({ where: { id }, data: input });
      await writeAudit(tx, {
        userId,
        entidad: 'Category',
        entidadId: String(id),
        accion: 'update',
        datosAntes: existing,
        datosDespues: updated,
      });
      return updated;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function deleteCategory(id: number, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.category.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Categoría no encontrada', 404, 'NOT_FOUND');
      }
      await tx.category.delete({ where: { id } });
      await writeAudit(tx, {
        userId,
        entidad: 'Category',
        entidadId: String(id),
        accion: 'delete',
        datosAntes: existing,
      });
      return existing;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function listProducts() {
  return prisma.product.findMany({
    include: productInclude,
    orderBy: { id: 'asc' },
  });
}

export async function getProduct(id: number) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });
  if (!product) {
    throw new AppError('Producto no encontrado', 404, 'NOT_FOUND');
  }
  return product;
}

export async function createProduct(input: CreateProductInput, userId: number) {
  const { units, images, ...productData } = input;
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...productData,
          units: units
            ? {
                create: units.map((unit) => ({
                  nombre: unit.nombre,
                  factor: String(unit.factor),
                  codigoBarras: unit.codigoBarras,
                  precioBase: String(unit.precioBase),
                })),
              }
            : undefined,
          images: images
            ? {
                create: images.map((image) => ({
                  url: image.url,
                  orden: image.orden,
                  esPrincipal: image.esPrincipal,
                })),
              }
            : undefined,
        },
        include: productInclude,
      });
      await writeAudit(tx, {
        userId,
        entidad: 'Product',
        entidadId: String(created.id),
        accion: 'create',
        datosDespues: created,
      });
      return created;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function updateProduct(id: number, input: UpdateProductInput, userId: number) {
  const { units, images, ...productData } = input;
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id },
        include: productInclude,
      });
      if (!existing) {
        throw new AppError('Producto no encontrado', 404, 'NOT_FOUND');
      }

      if (units) {
        await tx.productUnit.deleteMany({ where: { productId: id } });
      }
      if (images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
      }

      const updated = await tx.product.update({
        where: { id },
        data: {
          ...productData,
          units: units
            ? {
                create: units.map((unit) => ({
                  nombre: unit.nombre,
                  factor: String(unit.factor),
                  codigoBarras: unit.codigoBarras,
                  precioBase: String(unit.precioBase),
                })),
              }
            : undefined,
          images: images
            ? {
                create: images.map((image) => ({
                  url: image.url,
                  orden: image.orden,
                  esPrincipal: image.esPrincipal,
                })),
              }
            : undefined,
        },
        include: productInclude,
      });

      await writeAudit(tx, {
        userId,
        entidad: 'Product',
        entidadId: String(id),
        accion: 'update',
        datosAntes: existing,
        datosDespues: updated,
      });
      return updated;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function deleteProduct(id: number, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id },
        include: productInclude,
      });
      if (!existing) {
        throw new AppError('Producto no encontrado', 404, 'NOT_FOUND');
      }
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productUnit.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
      await writeAudit(tx, {
        userId,
        entidad: 'Product',
        entidadId: String(id),
        accion: 'delete',
        datosAntes: existing,
      });
      return existing;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function listPriceLists() {
  return prisma.priceList.findMany({
    include: { items: true },
    orderBy: { id: 'asc' },
  });
}

export async function getPriceList(id: number) {
  const priceList = await prisma.priceList.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!priceList) {
    throw new AppError('Lista de precios no encontrada', 404, 'NOT_FOUND');
  }
  return priceList;
}

export async function createPriceList(input: CreatePriceListInput, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.priceList.create({ data: input });
      await writeAudit(tx, {
        userId,
        entidad: 'PriceList',
        entidadId: String(created.id),
        accion: 'create',
        datosDespues: created,
      });
      return created;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function updatePriceList(id: number, input: UpdatePriceListInput, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.priceList.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Lista de precios no encontrada', 404, 'NOT_FOUND');
      }
      const updated = await tx.priceList.update({ where: { id }, data: input });
      await writeAudit(tx, {
        userId,
        entidad: 'PriceList',
        entidadId: String(id),
        accion: 'update',
        datosAntes: existing,
        datosDespues: updated,
      });
      return updated;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function deletePriceList(id: number, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.priceList.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) {
        throw new AppError('Lista de precios no encontrada', 404, 'NOT_FOUND');
      }
      await tx.priceListItem.deleteMany({ where: { priceListId: id } });
      await tx.priceList.delete({ where: { id } });
      await writeAudit(tx, {
        userId,
        entidad: 'PriceList',
        entidadId: String(id),
        accion: 'delete',
        datosAntes: existing,
      });
      return existing;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function listPriceListItems() {
  return prisma.priceListItem.findMany({
    orderBy: { id: 'asc' },
  });
}

export async function getPriceListItem(id: number) {
  const item = await prisma.priceListItem.findUnique({ where: { id } });
  if (!item) {
    throw new AppError('Ítem de lista de precios no encontrado', 404, 'NOT_FOUND');
  }
  return item;
}

export async function createPriceListItem(input: CreatePriceListItemInput, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.priceListItem.create({
        data: {
          priceListId: input.priceListId,
          productUnitId: input.productUnitId,
          precio: String(input.precio),
          vigenteDesde: input.vigenteDesde,
        },
      });
      await writeAudit(tx, {
        userId,
        entidad: 'PriceListItem',
        entidadId: String(created.id),
        accion: 'create',
        datosDespues: created,
      });
      return created;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function updatePriceListItem(
  id: number,
  input: UpdatePriceListItemInput,
  userId: number,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.priceListItem.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Ítem de lista de precios no encontrado', 404, 'NOT_FOUND');
      }
      const updated = await tx.priceListItem.update({
        where: { id },
        data: {
          ...input,
          precio: input.precio === undefined ? undefined : String(input.precio),
        },
      });
      await writeAudit(tx, {
        userId,
        entidad: 'PriceListItem',
        entidadId: String(id),
        accion: 'update',
        datosAntes: existing,
        datosDespues: updated,
      });
      return updated;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function deletePriceListItem(id: number, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.priceListItem.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Ítem de lista de precios no encontrado', 404, 'NOT_FOUND');
      }
      await tx.priceListItem.delete({ where: { id } });
      await writeAudit(tx, {
        userId,
        entidad: 'PriceListItem',
        entidadId: String(id),
        accion: 'delete',
        datosAntes: existing,
      });
      return existing;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

async function requireProduct(productId: number) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new AppError('Producto no encontrado', 404, 'NOT_FOUND');
  }
  return product;
}

export async function listProductUnits(productId: number) {
  await requireProduct(productId);
  return prisma.productUnit.findMany({
    where: { productId },
    orderBy: { id: 'asc' },
  });
}

export async function getProductUnit(productId: number, id: number) {
  const unit = await prisma.productUnit.findFirst({ where: { id, productId } });
  if (!unit) {
    throw new AppError('Presentación no encontrada', 404, 'NOT_FOUND');
  }
  return unit;
}

export async function createProductUnit(productId: number, input: CreateProductUnitInput, userId: number) {
  await requireProduct(productId);
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.productUnit.create({
        data: {
          productId,
          nombre: input.nombre,
          factor: String(input.factor),
          codigoBarras: input.codigoBarras ?? null,
          precioBase: String(input.precioBase ?? 0),
          activo: input.activo ?? true,
        },
      });
      await writeAudit(tx, {
        userId,
        entidad: 'ProductUnit',
        entidadId: String(created.id),
        accion: 'create',
        datosDespues: created,
      });
      return created;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function updateProductUnit(
  productId: number,
  id: number,
  input: UpdateProductUnitInput,
  userId: number,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.productUnit.findFirst({ where: { id, productId } });
      if (!existing) {
        throw new AppError('Presentación no encontrada', 404, 'NOT_FOUND');
      }
      const updated = await tx.productUnit.update({
        where: { id },
        data: {
          nombre: input.nombre,
          factor: input.factor === undefined ? undefined : String(input.factor),
          codigoBarras: input.codigoBarras,
          precioBase: input.precioBase === undefined ? undefined : String(input.precioBase),
          activo: input.activo,
        },
      });
      await writeAudit(tx, {
        userId,
        entidad: 'ProductUnit',
        entidadId: String(id),
        accion: 'update',
        datosAntes: existing,
        datosDespues: updated,
      });
      return updated;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function deactivateProductUnit(productId: number, id: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.productUnit.findFirst({ where: { id, productId } });
    if (!existing) {
      throw new AppError('Presentación no encontrada', 404, 'NOT_FOUND');
    }
    const updated = await tx.productUnit.update({
      where: { id },
      data: { activo: false },
    });
    await writeAudit(tx, {
      userId,
      entidad: 'ProductUnit',
      entidadId: String(id),
      accion: 'deactivate',
      datosAntes: existing,
      datosDespues: updated,
    });
    return updated;
  });
}

async function clearPrincipal(tx: Prisma.TransactionClient, productId: number, exceptId?: number) {
  await tx.productImage.updateMany({
    where: { productId, ...(exceptId === undefined ? {} : { id: { not: exceptId } }) },
    data: { esPrincipal: false },
  });
}

export async function listProductImages(productId: number) {
  await requireProduct(productId);
  return prisma.productImage.findMany({
    where: { productId },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
  });
}

export async function getProductImage(productId: number, id: number) {
  const image = await prisma.productImage.findFirst({ where: { id, productId } });
  if (!image) {
    throw new AppError('Imagen no encontrada', 404, 'NOT_FOUND');
  }
  return image;
}

export async function createProductImage(productId: number, input: CreateProductImageInput, userId: number) {
  await requireProduct(productId);
  return prisma.$transaction(async (tx) => {
    if (input.esPrincipal) {
      await clearPrincipal(tx, productId);
    }
    const created = await tx.productImage.create({
      data: {
        productId,
        url: input.url,
        orden: input.orden ?? 0,
        esPrincipal: input.esPrincipal ?? false,
      },
    });
    await writeAudit(tx, {
      userId,
      entidad: 'ProductImage',
      entidadId: String(created.id),
      accion: 'create',
      datosDespues: created,
    });
    return created;
  });
}

export async function updateProductImage(
  productId: number,
  id: number,
  input: UpdateProductImageInput,
  userId: number,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.productImage.findFirst({ where: { id, productId } });
    if (!existing) {
      throw new AppError('Imagen no encontrada', 404, 'NOT_FOUND');
    }
    if (input.esPrincipal) {
      await clearPrincipal(tx, productId, id);
    }
    const updated = await tx.productImage.update({ where: { id }, data: input });
    await writeAudit(tx, {
      userId,
      entidad: 'ProductImage',
      entidadId: String(id),
      accion: 'update',
      datosAntes: existing,
      datosDespues: updated,
    });
    return updated;
  });
}

export async function deleteProductImage(productId: number, id: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.productImage.findFirst({ where: { id, productId } });
    if (!existing) {
      throw new AppError('Imagen no encontrada', 404, 'NOT_FOUND');
    }
    await tx.productImage.delete({ where: { id } });
    await writeAudit(tx, {
      userId,
      entidad: 'ProductImage',
      entidadId: String(id),
      accion: 'delete',
      datosAntes: existing,
    });
    return existing;
  });
}
