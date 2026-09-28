import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requirePublicToken } from '../../middlewares/requirePublicToken.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './public-store.controller.js';
import { clientIdParamSchema, createTokenSchema, publicOrderSchema } from './public-store.schema.js';

/** Alta de tokens. Requiere JWT + admin: el token no sirve para crear tokens. */
/**
 * @openapi
 * /tokens/clients/{clientId}:
 *   post:
 *     tags: [Catálogo Público]
 *     summary: "Genera un token de catálogo para un cliente"
 *     description: "Solo admin. Devuelve el token y la ruta para compartir. El token es opaco: no lleva rol ni habilita ningún endpoint interno, solo el catálogo de ese cliente y pedidos a su nombre. Un cliente puede tener varios vigentes."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: clientId, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateClientAccessTokenBody' }
 *     responses:
 *       201:
 *         description: "`{ token, expiresAt, cliente, pathCatalogo }`. `pathCatalogo` es relativo; el frontend le pone su dominio."
 *       400: { description: "Datos inválidos." }
 *       401: { description: "Sin token." }
 *       403: { description: "El rol no es `admin`." }
 *       404: { description: "Cliente no encontrado." }
 *
 * /public/catalog:
 *   get:
 *     tags: [Catálogo Público]
 *     summary: "Catálogo con los precios del cliente del token"
 *     description: "Público a propósito: **no** acepta JWT. Se autentica solo con el token de cliente, por header `X-Client-Token` o por query param `token`. Devuelve categorías y productos activos con el precio de la lista del cliente."
 *     security: [{ clientToken: [] }]
 *     responses:
 *       200: { description: "`{ cliente: { id, nombreComercial }, categorias, productos }`. Las presentaciones sin precio vigente vienen con `precio: null`." }
 *       401: { description: "`PUBLIC_TOKEN_MISSING`, `PUBLIC_TOKEN_INVALID` o `PUBLIC_TOKEN_EXPIRED`." }
 *       422: { description: "El cliente del token no tiene lista de precios." }
 *
 * /public/orders:
 *   post:
 *     tags: [Catálogo Público]
 *     summary: "Crea un pedido desde el catálogo público"
 *     description: "El `clientId` sale del token: cualquier `clientId` del body se ignora. El canal lo fija el servidor en `web`. El pedido queda en `borrador` y lo confirma un admin o vendedor, así un cliente externo no dispara movimientos de inventario."
 *     security: [{ clientToken: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PublicOrderBody' }
 *     responses:
 *       201: { description: "Pedido creado en `borrador`, atribuido al usuario de sistema `Pedidos Web`." }
 *       200: { description: "Pedido ya existente con la misma `idempotencyKey` (24 h)." }
 *       400: { description: "Datos inválidos." }
 *       401: { description: "Token ausente, inválido o vencido." }
 *       404: { description: "Presentación no encontrada." }
 *       422: { description: "Sin precio vigente para alguna presentación (`NO_PRICE`)." }
 */
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