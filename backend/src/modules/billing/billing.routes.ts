import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './billing.controller.js';
import { createInvoiceSchema, orderIdParamSchema } from './billing.schema.js';

const auth = [requireAuth] as const;
const adminWrite = [requireAuth, requireRole('admin')] as const;
const idParams = validateParams(orderIdParamSchema);

/** Facturación de un pedido. Montado en /api/orders. */
/**
 * @openapi
 * /orders/{id}/invoice:
 *   post:
 *     tags: [Facturación]
 *     summary: "Emite la factura de un pedido entregado"
 *     description: "Solo admin. Solo acepta pedidos `entregado` o `entregado_parcial`, y factura el importe **realmente entregado**, no el total del pedido: en una entrega parcial factura solo lo entregado. Sin certificador configurado la factura queda en `pendiente_certificacion` y eso no es un error."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateInvoiceBody' }
 *     responses:
 *       201: { description: "Factura creada con su correlativo interno." }
 *       403: { description: "El rol no es `admin`." }
 *       404: { description: "Pedido no encontrado." }
 *       409: { description: "El pedido ya tiene factura (`ALREADY_INVOICED`)." }
 *       422: { description: "`ORDER_NOT_DELIVERED`: el pedido no está entregado ni entregado a medias." }
 *   get:
 *     tags: [Facturación]
 *     summary: "Obtiene la factura de un pedido"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "La factura del pedido, con su estado de certificación." }
 *       404: { description: "El pedido no tiene factura." }
 *
 * /invoices:
 *   get:
 *     tags: [Facturación]
 *     summary: "Lista facturas, opcionalmente por estado"
 *     description: "Solo admin. Filtrar por `pendiente_certificacion` muestra de un vistazo cuántas quedan por certificar."
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: estado, schema: { type: string, enum: [pendiente_certificacion, certificada, error] } }
 *     responses:
 *       200: { description: "Facturas con su pedido y cliente, de la más reciente a la más vieja." }
 *       400: { description: "Estado inválido." }
 *       403: { description: "El rol no es `admin`." }
 */
export const orderInvoiceRouter = Router();

// Facturar es una escritura: solo admin.
orderInvoiceRouter.post(
  '/:id/invoice',
  ...adminWrite,
  idParams,
  validateBody(createInvoiceSchema),
  controller.createInvoice,
);

orderInvoiceRouter.get('/:id/invoice', ...auth, idParams, controller.getInvoice);

/** Listado global. Montado en /api/invoices. */
export const invoicesRouter = Router();

invoicesRouter.get('/', ...adminWrite, controller.listInvoices);