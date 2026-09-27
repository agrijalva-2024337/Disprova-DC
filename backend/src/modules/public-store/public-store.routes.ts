import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requirePublicToken } from '../../middlewares/requirePublicToken.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './public-store.controller.js';
import { clientIdParamSchema, createTokenSchema, publicOrderSchema } from './public-store.schema.js';

/** Alta de tokens. Requiere JWT + admin: el token no sirve para crear tokens. */
export const clientTokenRouter = Router();

clientTokenRouter.post(
  '/clients/:clientId',
  requireAuth,
  requireRole('admin'),
  validateParams(clientIdParamSchema),
  validateBody(createTokenSchema),
  controller.createClientAccessToken,
);

/**
 * Catálogo público. SIN requireAuth a propósito: se autentica solo con el
 * token del cliente, que no es una sesión de usuario.
 */
export const publicStoreRouter = Router();

publicStoreRouter.get('/catalog', requirePublicToken, controller.getPublicCatalog);
publicStoreRouter.post(
  '/orders',
  requirePublicToken,
  validateBody(publicOrderSchema),
  controller.createPublicOrder,
);