import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './returns.controller.js';
import { createReturnSchema, idParamSchema } from './returns.schema.js';

export const returnsRouter = Router();

const auth = [requireAuth] as const;
const admin = [requireAuth, requireRole('admin')] as const;
const idParams = validateParams(idParamSchema);

returnsRouter.post('/', ...auth, validateBody(createReturnSchema), controller.createReturn);
returnsRouter.post('/:id/accept', ...admin, idParams, controller.acceptReturn);
returnsRouter.post('/:id/reject', ...admin, idParams, controller.rejectReturn);
