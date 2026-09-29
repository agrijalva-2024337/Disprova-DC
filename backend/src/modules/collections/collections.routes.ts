import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './collections.controller.js';
import {
  abrirSaldosInicialesSchema,
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
 *
 * /account/opening-balances:
 *   post:
 *     tags: [Cobranza]
 *     summary: "Carga el saldo inicial de la cartera"
 *     description: "Solo admin. Escribe un cargo `apertura` por cliente en el libro mayor, nunca una columna nueva: el saldo inicial se explica movimiento por movimiento como cualquier otro. Sin `modo` (o con `simulacion`) devuelve el cuadre sin escribir. El `corte` identifica la carga y solo se admite una vez."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [corte, items], properties: { corte: { type: string, example: corte-2026-09-29 }, modo: { type: string, enum: [simulacion, commit], default: simulacion }, items: { type: array, items: { type: object, required: [clientId, monto], properties: { clientId: { type: integer }, monto: { oneOf: [{ type: string }, { type: number }] } } } } } }
 *     responses:
 *       200: { description: "Simulación: devuelve el plan con el saldo previo y el resultante por cliente, sin escribir." }
 *       201: { description: "Carga confirmada: los cargos quedaron en el libro mayor." }
 *       403: { description: "Solo admin." }
 *       409: { description: "El corte ya fue cargado (`ALREADY_OPENED`)." }
 *       422: { description: "Algún cliente del corte no existe (`CLIENT_NOT_FOUND`)." }
 */
export const collectionsRouter = Router();

const auth = [requireAuth] as const;
const adminAuth = [requireAuth, requireRole('admin')] as const;
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
collectionsRouter.post(
  '/account/opening-balances',
  ...adminAuth,
  validateBody(abrirSaldosInicialesSchema),
  controller.abrirSaldosIniciales,
);
