import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './cash.controller.js';
import { closeCashSessionSchema, idParamSchema, openCashSessionSchema } from './cash.schema.js';

/**
 * @openapi
 * /cash-sessions:
 *   post:
 *     tags: [Caja]
 *     summary: "Abre una caja"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { montoInicial: { oneOf: [{ type: string }, { type: number }] } } }
 *     responses:
 *       201: { description: "Caja abierta." }
 *       409: { description: "El usuario ya tiene una caja abierta (`CASH_SESSION_ALREADY_OPEN`)." }
 *   get:
 *     tags: [Caja]
 *     summary: "Lista las sesiones de caja"
 *     description: "Solo admin."
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Sesiones de caja." }
 *       403: { description: "Solo admin." }
 *
 * /cash-sessions/current:
 *   get:
 *     tags: [Caja]
 *     summary: "Caja abierta del usuario"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "La sesión abierta, o `null` si no tiene ninguna." }
 *       401: { description: "Sin token." }
 *
 * /cash-sessions/{id}/close:
 *   post:
 *     tags: [Caja]
 *     summary: "Cierra la caja"
 *     description: "Calcula el arqueo contra lo cobrado. Solo el dueño de la caja o un admin."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Caja cerrada con el arqueo." }
 *       403: { description: "La caja es de otro usuario y el rol no es `admin`." }
 *       422: { description: "La caja ya estaba cerrada." }
 */
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
