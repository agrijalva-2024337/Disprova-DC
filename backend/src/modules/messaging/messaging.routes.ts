import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams, validateQuery } from '../../shared/http/validate.js';
import * as messagingController from './messaging.controller.js';
import {
  broadcastTodaySchema,
  clientIdParamSchema,
  createTemplateSchema,
  idParamSchema,
  templateIdQuerySchema,
  updateTemplateSchema,
} from './messaging.schema.js';

/**
 * @openapi
 * /messaging/templates:
 *   get:
 *     tags: [Mensajería]
 *     summary: "Lista plantillas de mensaje"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Todas las plantillas, activas e inactivas." }
 *       401: { description: "Sin token o vencido." }
 *   post:
 *     tags: [Mensajería]
 *     summary: "Crea una plantilla"
 *     description: "Solo admin. El cuerpo solo puede usar `{nombre}`, `{saldo}` y `{ultimoPedidoUrl}`; cualquier otra variable se rechaza acá, no al enviar."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateMessageTemplateBody' }
 *     responses:
 *       201: { description: "Plantilla creada y registrada en `AuditLog`." }
 *       400: { description: "Datos inválidos." }
 *       401: { description: "Sin token." }
 *       403: { description: "El rol no es `admin`." }
 *       409: { description: "Ya existe una plantilla con ese `nombre`." }
 *       422: { description: "Variable no permitida (`INVALID_TEMPLATE_VARIABLE`). El mensaje nombra la variable culpable." }
 *
 * /messaging/templates/{id}:
 *   put:
 *     tags: [Mensajería]
 *     summary: "Actualiza una plantilla"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateMessageTemplateBody' }
 *     responses:
 *       200: { description: "Plantilla actualizada." }
 *       404: { description: "Plantilla no encontrada." }
 *       409: { description: "Nombre duplicado." }
 *       422: { description: "Variable no permitida (`INVALID_TEMPLATE_VARIABLE`)." }
 *
 * /messaging/templates/{id}/deactivate:
 *   patch:
 *     tags: [Mensajería]
 *     summary: "Desactiva la plantilla"
 *     description: "Solo admin. No la borra: queda con `activo: false`."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Plantilla desactivada." }
 *       404: { description: "Plantilla no encontrada." }
 *
 * /messaging/clients/{clientId}/link:
 *   get:
 *     tags: [Mensajería]
 *     summary: "Genera el enlace de WhatsApp de un cliente"
 *     description: "Resuelve la plantilla, arma la URL de `wa.me` y guarda un `MessageLog` con estado `generado`. Funciona siempre, sin importar `WHATSAPP_PROVIDER`: no requiere credenciales."
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: clientId, required: true, schema: { type: integer } }
 *       - { in: query, name: templateId, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: "`{ url, contenido }` con el texto ya resuelto y el link listo para compartir."
 *       400: { description: "Falta `templateId` o no es un número." }
 *       404: { description: "Cliente o plantilla no encontrado." }
 *       422: { description: "El cliente no tiene ningún contacto con teléfono (`CLIENT_HAS_NO_CONTACT`)." }
 *
 * /messaging/clients/{clientId}/send:
 *   post:
 *     tags: [Mensajería]
 *     summary: "Envía el mensaje por la API de WhatsApp"
 *     description: "Solo admin. Usa `getFelProvider()`-equivalente de WhatsApp: si el proveedor activo es `wa_link` responde 422, porque ese modo no envía desde el servidor. Con `business_api` envía de verdad y registra el resultado."
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: clientId, required: true, schema: { type: integer } }
 *       - { in: query, name: templateId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: "Mensaje aceptado. `MessageLog` en estado `enviado` con el `providerMessageId` en el audit." }
 *       403: { description: "El rol no es `admin`." }
 *       404: { description: "Cliente o plantilla no encontrado." }
 *       422: { description: "`WHATSAPP_SEND_NOT_CONFIGURED`: el proveedor activo es `wa_link` y no puede enviar solo." }
 *       502: { description: "La API de WhatsApp respondió con error; el `MessageLog` queda en `fallido`." }
 *
 * /messaging/clients/{clientId}/history:
 *   get:
 *     tags: [Mensajería]
 *     summary: "Historial de mensajes del cliente"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: clientId, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "MessageLog del cliente, del más reciente al más viejo." }
 *       404: { description: "Cliente no encontrado." }
 *
 * /messaging/broadcast/today:
 *   post:
 *     tags: [Mensajería]
 *     summary: "Links de la zona activa de hoy"
 *     description: "Solo admin. Usa la misma zona activa que `GET /route-visits/today` y trae los clientes con algún contacto que acepte mensajes. **No envía nada**: devuelve los links para que el administrador los vaya tocando uno por uno."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [templateId]
 *             properties:
 *               templateId: { type: integer }
 *     responses:
 *       200: { description: "Arreglo de `{ clientId, nombre, url }`. Vacío si hoy no hay zona activa." }
 *       404: { description: "Plantilla no encontrada." }
 */
export const messagingRouter = Router();

const adminWrite = [requireAuth, requireRole('admin')] as const;
const readAuth = [requireAuth] as const;
const idParams = validateParams(idParamSchema);
const clientParams = validateParams(clientIdParamSchema);
const templateQuery = validateQuery(templateIdQuerySchema);

messagingRouter.get('/templates', ...readAuth, messagingController.listTemplates);
messagingRouter.post(
  '/templates',
  ...adminWrite,
  validateBody(createTemplateSchema),
  messagingController.createTemplate,
);
messagingRouter.put(
  '/templates/:id',
  ...adminWrite,
  idParams,
  validateBody(updateTemplateSchema),
  messagingController.updateTemplate,
);
messagingRouter.patch(
  '/templates/:id/deactivate',
  ...adminWrite,
  idParams,
  messagingController.deactivateTemplate,
);

messagingRouter.get(
  '/clients/:clientId/link',
  ...readAuth,
  clientParams,
  templateQuery,
  messagingController.getClientLink,
);
messagingRouter.post(
  '/clients/:clientId/send',
  ...adminWrite,
  clientParams,
  templateQuery,
  messagingController.sendToClient,
);
messagingRouter.get(
  '/clients/:clientId/history',
  ...readAuth,
  clientParams,
  messagingController.getClientHistory,
);

messagingRouter.post(
  '/broadcast/today',
  ...adminWrite,
  validateBody(broadcastTodaySchema),
  messagingController.broadcastToday,
);