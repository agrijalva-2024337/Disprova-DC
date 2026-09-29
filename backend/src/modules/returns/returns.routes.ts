import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams, validateQuery } from '../../shared/http/validate.js';
import * as controller from './returns.controller.js';
import { createReturnSchema, idParamSchema, listReturnsQuerySchema } from './returns.schema.js';

/**
 * @openapi
 * /returns:
 *   get:
 *     tags: [Devoluciones]
 *     summary: "Lista las devoluciones"
 *     description: "Cualquier usuario con sesión, incluido un vendedor. Filtros opcionales `estado` y `clientId`. Cada fila trae el nombre comercial del cliente y el número del pedido."
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: estado, schema: { type: string, enum: [pendiente, aceptada, rechazada] } }
 *       - { in: query, name: clientId, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer, default: 100, maximum: 500 } }
 *       - { in: query, name: offset, schema: { type: integer, default: 0, minimum: 0 } }
 *     responses:
 *       200: { description: "`{ data, meta }`. `meta` trae `total`, `limit`, `offset`, `count` y `hasMore`." }
 *       401: { description: "Sin sesión." }
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
 * /returns/{id}:
 *   get:
 *     tags: [Devoluciones]
 *     summary: "Detalle de una devolución"
 *     description: "Cualquier usuario con sesión. Trae las líneas con la presentación y el producto del pedido, y el lote cuando la línea lo tiene."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Devolución con `items`, cada uno con `orderItem` y `batch`." }
 *       401: { description: "Sin sesión." }
 *       404: { description: "Devolución no encontrada." }
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

returnsRouter.get('/', ...auth, validateQuery(listReturnsQuerySchema), controller.listReturns);
returnsRouter.get('/:id', ...auth, idParams, controller.getReturn);
returnsRouter.post('/', ...auth, validateBody(createReturnSchema), controller.createReturn);
returnsRouter.post('/:id/accept', ...admin, idParams, controller.acceptReturn);
returnsRouter.post('/:id/reject', ...admin, idParams, controller.rejectReturn);
