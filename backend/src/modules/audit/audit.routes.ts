import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateQuery } from '../../shared/http/validate.js';
import * as controller from './audit.controller.js';
import { auditLogQuerySchema } from './audit.schema.js';

/**
 * @openapi
 * /audit-log:
 *   get:
 *     tags: [Auditoría]
 *     summary: "Consulta el rastro de auditoría"
 *     description: >
 *       Solo admin. Trae el rastro de más nuevo a más viejo, con el nombre del
 *       usuario que hizo cada cambio. `entity` acepta el nombre de la tabla o
 *       el del modelo y no le importa el singular/plural ni las mayúsculas
 *       (`orders`, `Order` y `ORDERS` son lo mismo). Si la entidad no existe en
 *       el log responde 400 `UNKNOWN_ENTITY` con la lista de las que sí.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: entity, schema: { type: string }, example: orders, description: "Filtra por entidad: orders, users, payments, returns, cash_sessions, inventory_movements, clients, products..." }
 *       - { in: query, name: entityId, schema: { type: string }, description: "ID de la entidad afectada." }
 *       - { in: query, name: userId, schema: { type: integer }, description: "Quién hizo el cambio." }
 *       - { in: query, name: startDate, schema: { type: string, format: date-time }, description: "Desde (inclusive)." }
 *       - { in: query, name: endDate, schema: { type: string, format: date-time }, description: "Hasta (inclusive)." }
 *       - { in: query, name: limit, schema: { type: integer, default: 100, maximum: 500 } }
 *       - { in: query, name: offset, schema: { type: integer, default: 0, minimum: 0 } }
 *     responses:
 *       200: { description: "`{ data, meta }`. Cada fila trae `datosAntes`, `datosDespues` y el `usuario` que la hizo. `meta` trae `total`, `limit`, `offset`, `count` y `hasMore`." }
 *       400: { description: "Filtro inválido o entidad desconocida (`UNKNOWN_ENTITY`)." }
 *       401: { description: "Sin sesión." }
 *       403: { description: "El usuario no es admin (`FORBIDDEN`)." }
 */
export const auditRouter = Router();

auditRouter.get(
  '/',
  requireAuth,
  requireRole('admin'),
  validateQuery(auditLogQuerySchema),
  controller.listAuditLog,
);