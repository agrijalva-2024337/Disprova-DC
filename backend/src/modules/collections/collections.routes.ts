import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './collections.controller.js';
import {
  applyPaymentSchema,
  createCollectionVisitSchema,
  createPaymentSchema,
  idParamSchema,
} from './collections.schema.js';

export const collectionsRouter = Router();

const auth = [requireAuth] as const;
const idParams = validateParams(idParamSchema);

collectionsRouter.post('/payments', ...auth, validateBody(createPaymentSchema), controller.createPayment);
collectionsRouter.post(
  '/payments/:id/apply',
  ...auth,
  idParams,
  validateBody(applyPaymentSchema),
  controller.applyPayment,
);
collectionsRouter.get('/clients/:id/account', ...auth, idParams, controller.getAccount);
collectionsRouter.get('/clients/:id/aging', ...auth, idParams, controller.getAging);
collectionsRouter.post(
  '/collection-visits',
  ...auth,
  validateBody(createCollectionVisitSchema),
  controller.createCollectionVisit,
);
