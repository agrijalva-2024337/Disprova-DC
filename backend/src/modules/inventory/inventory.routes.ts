import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody } from '../../shared/http/validate.js';
import * as controller from './inventory.controller.js';
import { adjustmentSchema, createBatchSchema, createWarehouseSchema, entradaSchema, transferSchema } from './inventory.schema.js';

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
