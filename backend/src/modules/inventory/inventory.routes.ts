import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody } from '../../shared/http/validate.js';
import * as controller from './inventory.controller.js';
import { adjustmentSchema, createBatchSchema, createWarehouseSchema, entradaSchema, transferSchema } from './inventory.schema.js';

/**
 * @openapi
 * /inventory/warehouses:
 *   get:
 *     tags: [Inventario]
 *     summary: "Lista bodegas y vehículos"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Bodegas `bodega` y vehículos `vehiculo`." }
 *       401: { description: "Sin token." }
 *   post:
 *     tags: [Inventario]
 *     summary: "Crea una bodega"
 *     description: "Solo admin."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [nombre, tipo], properties: { nombre: { type: string }, tipo: { type: string, enum: [bodega, vehiculo] } } }
 *     responses:
 *       201: { description: "Bodega creada." }
 *       403: { description: "Solo admin." }
 *
 * /inventory/batches:
 *   post:
 *     tags: [Inventario]
 *     summary: "Crea un lote"
 *     description: "Solo para productos controlados. Requisito de `admin` o `bodeguero`."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [productId, codigo, cantidad, fechaVencimiento], properties: { productId: { type: integer }, codigo: { type: string }, cantidad: { oneOf: [{ type: string }, { type: number }] }, fechaVencimiento: { type: string, format: date } } }
 *     responses:
 *       201: { description: "Lote creado con su entrada inicial de stock." }
 *       403: { description: "Rol sin permiso." }
 *       404: { description: "Producto no encontrado." }
 *
 * /inventory/stock:
 *   get:
 *     tags: [Inventario]
 *     summary: "Existencias"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Stock por producto, bodega y lote." }
 *
 * /inventory/movements:
 *   get:
 *     tags: [Inventario]
 *     summary: "Historial de movimientos"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Movimientos de inventario, del más reciente al más viejo." }
 *
 * /inventory/movements/entrada:
 *   post:
 *     tags: [Inventario]
 *     summary: "Registra una entrada"
 *     description: "Solo admin o `bodeguero`."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [productId, warehouseId, cantidad], properties: { productId: { type: integer }, warehouseId: { type: integer }, cantidad: { oneOf: [{ type: string }, { type: number }] }, batchId: { type: integer }, referenciaTipo: { type: string }, referenciaId: { type: string } } }
 *     responses:
 *       201: { description: "Entrada registrada." }
 *       409: { description: "No hay bodega, o el lote no corresponde al producto." }
 *       422: { description: "Producto controlado sin `batchId` (`BATCH_REQUIRED`) o cantidad inválida." }
 *
 * /inventory/movements/traslado:
 *   post:
 *     tags: [Inventario]
 *     summary: "Traslada stock entre bodegas"
 *     description: "Saca de la bodega central y deja en la de destino. La salida y la entrada comparten `referenciaId`."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [productId, origenId, destinoId, cantidad], properties: { productId: { type: integer }, origenId: { type: integer }, destinoId: { type: integer }, cantidad: { oneOf: [{ type: string }, { type: number }] }, batchId: { type: integer } } }
 *     responses:
 *       201: { description: "Traslado registrado." }
 *       409: { description: "No hay existencia suficiente en el origen (`INSUFFICIENT_STOCK`)." }
 *       422: { description: "Producto controlado sin `batchId`." }
 *
 * /inventory/movements/ajuste:
 *   post:
 *     tags: [Inventario]
 *     summary: "Ajusta el stock a la cantidad contada"
 *     description: "Solo admin. Genera el movimiento de ajuste con la diferencia."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [productId, warehouseId, cantidadReal], properties: { productId: { type: integer }, warehouseId: { type: integer }, cantidadReal: { oneOf: [{ type: string }, { type: number }] }, batchId: { type: integer }, motivo: { type: string } } }
 *     responses:
 *       201: { description: "Ajuste registrado." }
 *       403: { description: "Solo admin." }
 *       422: { description: "Producto controlado sin `batchId`." }
 */
export const inventoryRouter = Router();

const readAuth = [requireAuth] as const;

const stockWrite = [requireAuth, requireRole('admin', 'bodeguero')] as const;

inventoryRouter.get('/warehouses', ...readAuth, controller.listWarehouses);
inventoryRouter.post(
  '/warehouses',
  requireAuth,
  requireRole('admin'),
  validateBody(createWarehouseSchema),
  controller.createWarehouse,
);
inventoryRouter.post('/batches', ...stockWrite, validateBody(createBatchSchema), controller.createBatch);
inventoryRouter.get('/stock', ...readAuth, controller.listStock);
inventoryRouter.get('/movements', ...readAuth, controller.listMovements);
inventoryRouter.post(
  '/movements/entrada',
  ...stockWrite,
  validateBody(entradaSchema),
  controller.receiveStock,
);
inventoryRouter.post(
  '/movements/traslado',
  ...readAuth,
  validateBody(transferSchema),
  controller.transfer,
);
inventoryRouter.post(
  '/movements/ajuste',
  requireAuth,
  requireRole('admin'),
  validateBody(adjustmentSchema),
  controller.adjust,
);
