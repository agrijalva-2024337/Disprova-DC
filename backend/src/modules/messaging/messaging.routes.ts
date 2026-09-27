import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams, validateQuery } from '../../shared/http/validate.js';
import * as messagingController from './messaging.controller.js';
import {
  broadcastTodaySchema,
  clientIdParamSchema,
  createTemplateSchema,
  idParamSchema,
  templateIdQuerySchema,
  updateTemplateSchema,
} from './messaging.schema.js';

export const messagingRouter = Router();

const adminWrite = [requireAuth, requireRole('admin')] as const;
const readAuth = [requireAuth] as const;
const idParams = validateParams(idParamSchema);
const clientParams = validateParams(clientIdParamSchema);
const templateQuery = validateQuery(templateIdQuerySchema);

messagingRouter.get('/templates', ...readAuth, messagingController.listTemplates);
messagingRouter.post(
  '/templates',
  ...adminWrite,
  validateBody(createTemplateSchema),
  messagingController.createTemplate,
);
messagingRouter.put(
  '/templates/:id',
  ...adminWrite,
  idParams,
  validateBody(updateTemplateSchema),
  messagingController.updateTemplate,
);
messagingRouter.patch(
  '/templates/:id/deactivate',
  ...adminWrite,
  idParams,
  messagingController.deactivateTemplate,
);

messagingRouter.get(
  '/clients/:clientId/link',
  ...readAuth,
  clientParams,
  templateQuery,
  messagingController.getClientLink,
);
messagingRouter.post(
  '/clients/:clientId/send',
  ...adminWrite,
  clientParams,
  templateQuery,
  messagingController.sendToClient,
);
messagingRouter.get(
  '/clients/:clientId/history',
  ...readAuth,
  clientParams,
  messagingController.getClientHistory,
);

messagingRouter.post(
  '/broadcast/today',
  ...adminWrite,
  validateBody(broadcastTodaySchema),
  messagingController.broadcastToday,
);