import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './sales.controller.js';
import { createOrderSchema, deliverOrderSchema, idParamSchema } from './sales.schema.js';

export const salesRouter = Router();

const auth = [requireAuth] as const;
const idParams = validateParams(idParamSchema);

salesRouter.get('/', ...auth, controller.listOrders);
salesRouter.get('/:id', ...auth, idParams, controller.getOrder);
salesRouter.post('/', ...auth, validateBody(createOrderSchema), controller.createOrder);
salesRouter.post('/:id/confirm', ...auth, idParams, controller.confirmOrder);
salesRouter.post('/:id/deliver', ...auth, idParams, validateBody(deliverOrderSchema), controller.deliverOrder);
salesRouter.post('/:id/cancel', ...auth, idParams, controller.cancelOrder);
