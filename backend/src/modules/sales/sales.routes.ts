import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './sales.controller.js';
import { createOrderSchema, deliverOrderSchema, idParamSchema } from './sales.schema.js';

/**
 * @openapi
 * /orders:
 *   get:
 *     tags: [Ventas]
 *     summary: Lista pedidos
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: clientId, schema: { type: integer } }
 *       - { in: query, name: pendientes, schema: { type: string, enum: ['1','true'] }, description: Solo pedidos confirmados o entregados a medias de hoy. }
 *     responses:
 *       200: { description: Pedidos con cliente, líneas y entregas. }
 *       401: { description: Sin token o vencido. }
 *   post:
 *     tags: [Ventas]
 *     summary: Crea un pedido en borrador
 *     description: "No valida crédito ni reserva stock: eso pasa en `POST /orders/{id}/confirm`."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateOrderBody' }
 *     responses:
 *       201: { description: Pedido creado. }
 *       200: { description: Pedido ya existente con la misma `idempotencyKey` (24 h). }
 *       400: { description: Datos inválidos. }
 *       404: { description: Cliente o presentación no encontrada. }
 *       422: { description: Sin lista de precios (`NO_PRICE_LIST`) o sin precio vigente (`NO_PRICE`). }
 *
 * /orders/{id}:
 *   get:
 *     tags: [Ventas]
 *     summary: Obtiene un pedido
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Pedido con cliente, líneas y entregas. }
 *       404: { description: Pedido no encontrado. }
 *
 * /orders/{id}/confirm:
 *   post:
 *     tags: [Ventas]
 *     summary: Confirma el pedido
 *     description: Valida el límite de crédito y reserva el stock en el vehículo del vendedor. Solo admin o vendedor.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Pedido confirmado con el stock reservado. }
 *       409: { description: Sin stock (`INSUFFICIENT_STOCK`) o límite de crédito superado (`CREDIT_LIMIT_EXCEEDED`). }
 *       422: { description: El pedido no está en un estado confirmable (`INVALID_ORDER_STATE`) o el vendedor no tiene vehículo (`NO_VEHICLE_WAREHOUSE`). }
 *
 * /orders/{id}/deliver:
 *   post:
 *     tags: [Ventas]
 *     summary: Registra la entrega
 *     description: Entrega total o parcial. En crédito genera el cargo de cobranza sobre lo realmente entregado. Solo admin o vendedor.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/DeliverOrderBody' }
 *     responses:
 *       201: { description: Entrega registrada. El pedido pasa a `entregado` o `entregado_parcial`. }
 *       409: { description: Sin existencias suficientes. }
 *       422: { description: Cantidad excedida (`DELIVERY_EXCEEDS_ORDER`) o producto controlado sin `batchId` (`BATCH_REQUIRED`). }
 *
 * /orders/{id}/cancel:
 *   post:
 *     tags: [Ventas]
 *     summary: Cancela el pedido
 *     description: Solo admin o vendedor. Libera el stock reservado.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Pedido cancelado. }
 *       422: { description: El pedido no se puede cancelar en su estado actual. }
 */
export const salesRouter = Router();

const auth = [requireAuth] as const;
const idParams = validateParams(idParamSchema);

salesRouter.get('/', ...auth, controller.listOrders);
salesRouter.get('/:id', ...auth, idParams, controller.getOrder);
salesRouter.post('/', ...auth, validateBody(createOrderSchema), controller.createOrder);
salesRouter.post('/:id/confirm', ...auth, idParams, controller.confirmOrder);
salesRouter.post('/:id/deliver', ...auth, idParams, validateBody(deliverOrderSchema), controller.deliverOrder);
salesRouter.post('/:id/cancel', ...auth, idParams, controller.cancelOrder);
