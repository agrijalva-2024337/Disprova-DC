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

/**
 * @openapi
 * /payments:
 *   post:
 *     tags: [Cobranza]
 *     summary: "Registra un pago del cliente"
 *     description: "Queda pendiente de aplicarse a pedidos hasta que se use `POST /payments/{id}/apply`."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [clientId, metodo, monto], properties: { clientId: { type: integer }, metodo: { type: string, enum: [efectivo, transferencia, cheque] }, monto: { oneOf: [{ type: string }, { type: number }] }, fecha: { type: string, format: date } } }
 *     responses:
 *       201: { description: "Pago registrado." }
 *       400: { description: "Datos inválidos." }
 *       404: { description: "Cliente no encontrado." }
 *       422: { description: "Monto inválido (`INVALID_AMOUNT`)." }
 *
 * /payments/{id}/apply:
 *   post:
 *     tags: [Cobranza]
 *     summary: "Aplica un pago a pedidos pendientes"
 *     description: "Descuenta del saldo del cliente y aplica a los pedidos más antiguos. El saldo se recalcula al insertar el movimiento y no después."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [montoAplicado], properties: { montoAplicado: { oneOf: [{ type: string }, { type: number }] }, orderId: { type: integer } } }
 *     responses:
 *       200: { description: "Pago aplicado." }
 *       404: { description: "Pago no encontrado." }
 *       409: { description: "El pago ya está aplicado por completo o el monto supera lo disponible (`APPLICATION_EXCEEDS_PAYMENT`)." }
 *
 * /clients/{id}/account:
 *   get:
 *     tags: [Cobranza]
 *     summary: "Cuenta corriente del cliente"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "`{ saldoActual, movements }`. El saldo sale del último movimiento." }
 *       404: { description: "Cliente no encontrado." }
 *
 * /clients/{id}/aging:
 *   get:
 *     tags: [Cobranza]
 *     summary: "Antigüedad de la deuda del cliente"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "`{ saldoActual, buckets }` con los buckets por antigüedad." }
 *       404: { description: "Cliente no encontrado." }
 *
 * /collection-visits:
 *   post:
 *     tags: [Cobranza]
 *     summary: "Registra una visita de cobranza"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [clientId, resultado], properties: { clientId: { type: integer }, resultado: { type: string, enum: [pago_completo, pago_parcial, compromiso, sin_contacto] }, montoComprometido: { oneOf: [{ type: string }, { type: number }] }, fechaCompromiso: { type: string, format: date }, observaciones: { type: string } } }
 *     responses:
 *       201: { description: "Visita registrada." }
 *       404: { description: "Cliente no encontrado." }
 */
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
