import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './cash.controller.js';
import { closeCashSessionSchema, idParamSchema, openCashSessionSchema } from './cash.schema.js';

export const cashRouter = Router();

const auth = [requireAuth] as const;
const idParams = validateParams(idParamSchema);

cashRouter.post('/', ...auth, validateBody(openCashSessionSchema), controller.openSession);
cashRouter.get('/current', ...auth, controller.getCurrentSession);
cashRouter.get('/', requireAuth, requireRole('admin'), controller.listSessions);
cashRouter.post(
  '/:id/close',
  ...auth,
  idParams,
  validateBody(closeCashSessionSchema),
  controller.closeSession,
);
