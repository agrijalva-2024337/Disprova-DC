import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './billing.controller.js';
import { createInvoiceSchema, orderIdParamSchema } from './billing.schema.js';

const auth = [requireAuth] as const;
const adminWrite = [requireAuth, requireRole('admin')] as const;
const idParams = validateParams(orderIdParamSchema);

/** Facturación de un pedido. Montado en /api/orders. */
export const orderInvoiceRouter = Router();

// Facturar es una escritura: solo admin.
orderInvoiceRouter.post(
  '/:id/invoice',
  ...adminWrite,
  idParams,
  validateBody(createInvoiceSchema),
  controller.createInvoice,
);

orderInvoiceRouter.get('/:id/invoice', ...auth, idParams, controller.getInvoice);

/** Listado global. Montado en /api/invoices. */
export const invoicesRouter = Router();

invoicesRouter.get('/', ...adminWrite, controller.listInvoices);