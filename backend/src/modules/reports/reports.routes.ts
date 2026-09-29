import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import * as controller from './reports.controller.js';

/**
 * @openapi
 * /reports/sales-today:
 *   get:
 *     tags: [Reportes]
 *     summary: "Vendido hoy, por vendedor y condición de pago"
 *     description: "Cuenta lo **entregado** hoy, no lo pedido hoy: un pedido tomado hoy y entregado mañana no cuenta, y uno de la semana pasada entregado hoy sí. El importe es el realmente entregado, la misma cifra que usa la cobranza y la facturación."
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Totales del día, agrupados por vendedor." }
 *       401: { description: "Sin token." }
 *       403: { description: "Solo admin." }
 *
 * /reports/collections-today:
 *   get:
 *     tags: [Reportes]
 *     summary: "Cobrado hoy, por vendedor"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Totales cobrados del día, agrupados por vendedor." }
 *       403: { description: "Solo admin." }
 *
 * /reports/aging:
 *   get:
 *     tags: [Reportes]
 *     summary: "Antigüedad de saldos"
 *     description: "Agrupa por cliente en buckets 0-15, 16-30, 31-60 y 60+ días, y ordena poniendo primero la deuda más vieja."
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Clientes con saldo y su antiguedad." }
 *       403: { description: "Solo admin." }
 */
export const reportsRouter = Router();

const admin = [requireAuth, requireRole('admin')] as const;

reportsRouter.get('/sales-today', ...admin, controller.salesToday);
reportsRouter.get('/collections-today', ...admin, controller.collectionsToday);
reportsRouter.get('/aging', ...admin, controller.aging);
