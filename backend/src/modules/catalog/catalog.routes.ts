import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as catalogController from './catalog.controller.js';
import {
  createCategorySchema,
  createPriceListItemSchema,
  createPriceListSchema,
  createProductImageSchema,
  createProductSchema,
  createProductUnitSchema,
  idParamSchema,
  productChildParamSchema,
  productIdParamSchema,
  updateCategorySchema,
  updatePriceListItemSchema,
  updatePriceListSchema,
  updateProductImageSchema,
  updateProductSchema,
  updateProductUnitSchema,
} from './catalog.schema.js';

/**
 * @openapi
 * /catalog/categories:
 *   get:
 *     tags: [Catálogo]
 *     summary: "Lista categorías"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Categorías con su jerarquía." }
 *       401: { description: "Sin token." }
 *   post:
 *     tags: [Catálogo]
 *     summary: "Crea una categoría"
 *     description: "Solo admin."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [nombre], properties: { nombre: { type: string }, parentId: { type: integer, nullable: true }, orden: { type: integer }, activo: { type: boolean } } }
 *     responses:
 *       201: { description: "Categoría creada." }
 *       403: { description: "Solo admin." }
 *
 * /catalog/categories/{id}:
 *   get:
 *     tags: [Catálogo]
 *     summary: "Obtiene una categoría"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Categoría." }
 *       404: { description: "No encontrada." }
 *   put:
 *     tags: [Catálogo]
 *     summary: "Actualiza una categoría"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Categoría actualizada." }
 *       403: { description: "Solo admin." }
 *       404: { description: "No encontrada." }
 *   delete:
 *     tags: [Catálogo]
 *     summary: "Elimina una categoría"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: "Categoría eliminada." }
 *       403: { description: "Solo admin." }
 *       409: { description: "Tiene subcategorías o productos asociados." }
 *
 * /catalog/products:
 *   get:
 *     tags: [Catálogo]
 *     summary: "Lista productos"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Productos con categoría, presentaciones e imágenes." }
 *   post:
 *     tags: [Catálogo]
 *     summary: "Crea un producto con sus presentaciones e imágenes"
 *     description: "Solo admin. `units` e `images` son opcionales."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [sku, nombre, categoryId, unidadBase], properties: { sku: { type: string }, nombre: { type: string }, descripcion: { type: string }, categoryId: { type: integer }, marca: { type: string }, unidadBase: { type: string }, controlado: { type: boolean }, activo: { type: boolean } } }
 *     responses:
 *       201: { description: "Producto creado." }
 *       403: { description: "Solo admin." }
 *       404: { description: "Categoría no encontrada." }
 *       409: { description: "El `sku` ya existe." }
 *
 * /catalog/products/{id}:
 *   get:
 *     tags: [Catálogo]
 *     summary: "Obtiene un producto"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Producto con presentaciones e imágenes." }
 *       404: { description: "No encontrado." }
 *   put:
 *     tags: [Catálogo]
 *     summary: "Actualiza un producto"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Producto actualizado." }
 *       403: { description: "Solo admin." }
 *       404: { description: "No encontrado." }
 *   delete:
 *     tags: [Catálogo]
 *     summary: "Elimina un producto"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: "Producto eliminado." }
 *       403: { description: "Solo admin." }
 *       409: { description: "Tiene pedidos o movimientos asociados." }
 *
 * /catalog/products/{productId}/units:
 *   get:
 *     tags: [Catálogo]
 *     summary: "Lista las presentaciones del producto"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: productId, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Presentaciones con factor, código de barras y precio base." }
 *   post:
 *     tags: [Catálogo]
 *     summary: "Agrega una presentación"
 *     description: "Solo admin."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: productId, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [nombre, factor], properties: { nombre: { type: string }, factor: { oneOf: [{ type: string }, { type: number }] }, codigoBarras: { type: string }, precioBase: { oneOf: [{ type: string }, { type: number }] }, activo: { type: boolean } } }
 *     responses:
 *       201: { description: "Presentación creada." }
 *       403: { description: "Solo admin." }
 *       404: { description: "Producto no encontrado." }
 *       409: { description: "El código de barras ya existe." }
 *
 * /catalog/products/{productId}/units/{id}:
 *   put:
 *     tags: [Catálogo]
 *     summary: "Actualiza una presentación"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: productId, required: true, schema: { type: integer } }
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: "Presentación actualizada." }
 *       404: { description: "Presentación no encontrada." }
 *   delete:
 *     tags: [Catálogo]
 *     summary: "Desactiva una presentación"
 *     description: "No borra: queda con `activo: false` para no romper pedidos viejos."
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: productId, required: true, schema: { type: integer } }
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: "Presentación desactivada." }
 *       404: { description: "Presentación no encontrada." }
 *
 * /catalog/products/{productId}/images:
 *   get:
 *     tags: [Catálogo]
 *     summary: "Lista las imágenes del producto"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: productId, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Imágenes con su orden y principal." }
 *   post:
 *     tags: [Catálogo]
 *     summary: "Agrega una imagen"
 *     description: "Solo admin."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: productId, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [url], properties: { url: { type: string }, orden: { type: integer }, esPrincipal: { type: boolean } } }
 *     responses:
 *       201: { description: "Imagen agregada." }
 *       403: { description: "Solo admin." }
 *       404: { description: "Producto no encontrado." }
 *
 * /catalog/price-lists:
 *   get:
 *     tags: [Catálogo]
 *     summary: "Lista listas de precios"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Listas de precios." }
 *   post:
 *     tags: [Catálogo]
 *     summary: "Crea una lista de precios"
 *     description: "Solo admin."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [nombre], properties: { nombre: { type: string }, descripcion: { type: string }, activo: { type: boolean } } }
 *     responses:
 *       201: { description: "Lista creada." }
 *       403: { description: "Solo admin." }
 *
 * /catalog/price-lists/{id}:
 *   get:
 *     tags: [Catálogo]
 *     summary: "Obtiene una lista de precios"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Lista con sus ítems." }
 *       404: { description: "No encontrada." }
 *   put:
 *     tags: [Catálogo]
 *     summary: "Actualiza una lista de precios"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Lista actualizada." }
 *       403: { description: "Solo admin." }
 *   delete:
 *     tags: [Catálogo]
 *     summary: "Elimina una lista de precios"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: "Lista eliminada." }
 *       403: { description: "Solo admin." }
 *       409: { description: "Hay clientes o ítems que la usan." }
 *
 * /catalog/price-list-items:
 *   get:
 *     tags: [Catálogo]
 *     summary: "Lista los ítems de precios"
 *     description: "El precio vigente de una presentación es el ítem con `vigenteDesde` más reciente que ya pasó."
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Precios por presentación y vigencia." }
 *
 * /catalog/price-list-items/{id}:
 *   put:
 *     tags: [Catálogo]
 *     summary: "Actualiza un precio"
 *     description: "Solo admin. La vigencia la define `vigenteDesde`."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Precio actualizado." }
 *       404: { description: "Ítem no encontrado." }
 *   delete:
 *     tags: [Catálogo]
 *     summary: "Elimina un precio"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: "Ítem eliminado." }
 *       403: { description: "Solo admin." }
 */
export const catalogRouter = Router();

const adminWrite = [requireAuth, requireRole('admin')] as const;
const readAuth = [requireAuth] as const;
const idParams = validateParams(idParamSchema);
const productParams = validateParams(productIdParamSchema);
const childParams = validateParams(productChildParamSchema);

catalogRouter.get('/categories', ...readAuth, catalogController.listCategories);
catalogRouter.get('/categories/:id', ...readAuth, idParams, catalogController.getCategory);
catalogRouter.post(
  '/categories',
  ...adminWrite,
  validateBody(createCategorySchema),
  catalogController.createCategory,
);
catalogRouter.put(
  '/categories/:id',
  ...adminWrite,
  idParams,
  validateBody(updateCategorySchema),
  catalogController.updateCategory,
);
catalogRouter.delete('/categories/:id', ...adminWrite, idParams, catalogController.deleteCategory);

catalogRouter.get('/products', ...readAuth, catalogController.listProducts);
catalogRouter.get('/products/:id', ...readAuth, idParams, catalogController.getProduct);
catalogRouter.post(
  '/products',
  ...adminWrite,
  validateBody(createProductSchema),
  catalogController.createProduct,
);
catalogRouter.put(
  '/products/:id',
  ...adminWrite,
  idParams,
  validateBody(updateProductSchema),
  catalogController.updateProduct,
);
catalogRouter.delete('/products/:id', ...adminWrite, idParams, catalogController.deleteProduct);

catalogRouter.get('/products/:productId/units', ...readAuth, productParams, catalogController.listProductUnits);
catalogRouter.get(
  '/products/:productId/units/:id',
  ...readAuth,
  childParams,
  catalogController.getProductUnit,
);
catalogRouter.post(
  '/products/:productId/units',
  ...adminWrite,
  productParams,
  validateBody(createProductUnitSchema),
  catalogController.createProductUnit,
);
catalogRouter.put(
  '/products/:productId/units/:id',
  ...adminWrite,
  childParams,
  validateBody(updateProductUnitSchema),
  catalogController.updateProductUnit,
);
catalogRouter.delete(
  '/products/:productId/units/:id',
  ...adminWrite,
  childParams,
  catalogController.deactivateProductUnit,
);

catalogRouter.get('/products/:productId/images', ...readAuth, productParams, catalogController.listProductImages);
catalogRouter.get(
  '/products/:productId/images/:id',
  ...readAuth,
  childParams,
  catalogController.getProductImage,
);
catalogRouter.post(
  '/products/:productId/images',
  ...adminWrite,
  productParams,
  validateBody(createProductImageSchema),
  catalogController.createProductImage,
);
catalogRouter.put(
  '/products/:productId/images/:id',
  ...adminWrite,
  childParams,
  validateBody(updateProductImageSchema),
  catalogController.updateProductImage,
);
catalogRouter.delete(
  '/products/:productId/images/:id',
  ...adminWrite,
  childParams,
  catalogController.deleteProductImage,
);

catalogRouter.get('/price-lists', ...readAuth, catalogController.listPriceLists);
catalogRouter.get('/price-lists/:id', ...readAuth, idParams, catalogController.getPriceList);
catalogRouter.post(
  '/price-lists',
  ...adminWrite,
  validateBody(createPriceListSchema),
  catalogController.createPriceList,
);
catalogRouter.put(
  '/price-lists/:id',
  ...adminWrite,
  idParams,
  validateBody(updatePriceListSchema),
  catalogController.updatePriceList,
);
catalogRouter.delete('/price-lists/:id', ...adminWrite, idParams, catalogController.deletePriceList);

catalogRouter.get('/price-list-items', ...readAuth, catalogController.listPriceListItems);
catalogRouter.get(
  '/price-list-items/:id',
  ...readAuth,
  idParams,
  catalogController.getPriceListItem,
);
catalogRouter.post(
  '/price-list-items',
  ...adminWrite,
  validateBody(createPriceListItemSchema),
  catalogController.createPriceListItem,
);
catalogRouter.put(
  '/price-list-items/:id',
  ...adminWrite,
  idParams,
  validateBody(updatePriceListItemSchema),
  catalogController.updatePriceListItem,
);
catalogRouter.delete(
  '/price-list-items/:id',
  ...adminWrite,
  idParams,
  catalogController.deletePriceListItem,
);
