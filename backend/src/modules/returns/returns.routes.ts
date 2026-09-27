import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './returns.controller.js';
import { createReturnSchema, idParamSchema } from './returns.schema.js';

/**
 * @openapi
 * /returns:
 *   post:
 *     tags: [Devoluciones]
 *     summary: "Registra una devolución de mercadería entregada"
 *     description: "Solo sobre pedidos con entrega. Una devolución `reingreso` suma stock al inventario; una `merma` no, pero ambos abonan la cuenta del cliente."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateReturnBody' }
 *     responses:
 *       201: { description: "Devolución en estado `pendiente`." }
 *       400: { description: "Datos inválidos." }
 *       404: { description: "Pedido o línea no encontrada." }
 *       422:
 *         description: "La devolución no corresponde al pedido (`INVALID_ORDER`), la línea no es del pedido (`INVALID_ORDER_ITEM`) o supera lo entregado (`RETURN_EXCEEDS_DELIVERED`)."
 *
 * /returns/{id}/accept:
 *   post:
 *     tags: [Devoluciones]
 *     summary: "Acepta la devolución"
 *     description: "Solo admin. Reingresa el stock o registra la merma y abona la cuenta."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Devolución aceptada." }
 *       403: { description: "Solo admin." }
 *       404: { description: "Devolución no encontrada." }
 *       409: { description: "La devolución ya fue resuelta (`INVALID_RETURN_STATE`)." }
 *
 * /returns/{id}/reject:
 *   post:
 *     tags: [Devoluciones]
 *     summary: "Rechaza la devolución"
 *     description: "Solo admin. No toca stock ni saldo."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Devolución rechazada." }
 *       403: { description: "Solo admin." }
 *       409: { description: "La devolución ya fue resuelta." }
 */
export const returnsRouter = Router();

const auth = [requireAuth] as const;
const admin = [requireAuth, requireRole('admin')] as const;
const idParams = validateParams(idParamSchema);

returnsRouter.post('/', ...auth, validateBody(createReturnSchema), controller.createReturn);
returnsRouter.post('/:id/accept', ...admin, idParams, controller.acceptReturn);
returnsRouter.post('/:id/reject', ...admin, idParams, controller.rejectReturn);
