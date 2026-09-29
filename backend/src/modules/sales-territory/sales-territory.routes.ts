import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validateBody, validateParams } from '../../shared/http/validate.js';
import * as controller from './sales-territory.controller.js';
import {
  contactParamsSchema,
  createClientSchema,
  createContactSchema,
  createRouteVisitSchema,
  createZoneSchema,
  idParamSchema,
  updateClientSchema,
  updateContactSchema,
  updateZoneSchema,
} from './sales-territory.schema.js';

/**
 * @openapi
 * /zones:
 *   get:
 *     tags: [Zonas y Clientes]
 *     summary: "Lista zonas"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Zonas con su semana y días de visita." }
 *   post:
 *     tags: [Zonas y Clientes]
 *     summary: "Crea una zona"
 *     description: "Solo admin."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [nombre, semanaMes], properties: { nombre: { type: string }, semanaMes: { type: integer, minimum: 1, maximum: 4 }, diasSemana: { type: array, items: { type: integer, minimum: 1, maximum: 7 } } } }
 *     responses:
 *       201: { description: "Zona creada." }
 *       403: { description: "Solo admin." }
 *
 * /zones/{id}:
 *   get:
 *     tags: [Zonas y Clientes]
 *     summary: "Obtiene una zona con sus clientes"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Zona con sus clientes ordenados por ruta." }
 *       404: { description: "Zona no encontrada." }
 *   put:
 *     tags: [Zonas y Clientes]
 *     summary: "Actualiza una zona"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Zona actualizada." }
 *       403: { description: "Solo admin." }
 *       404: { description: "Zona no encontrada." }
 *   delete:
 *     tags: [Zonas y Clientes]
 *     summary: "Desactiva una zona"
 *     description: "No borra: conserva el historial de visitas de la ruta."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Zona desactivada." }
 *       403: { description: "Solo admin." }
 *       404: { description: "Zona no encontrada." }
 *       409: { description: "Ya estaba desactivada (`ALREADY_INACTIVE`)." }
 *
 * /clients:
 *   get:
 *     tags: [Zonas y Clientes]
 *     summary: "Lista clientes"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Clientes con su zona y lista de precios." }
 *   post:
 *     tags: [Zonas y Clientes]
 *     summary: "Crea un cliente"
 *     description: "Solo admin. El `ordenRuta` es único dentro de la zona."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateClientBody' }
 *     responses:
 *       201: { description: "Cliente creado." }
 *       403: { description: "Solo admin." }
 *       404: { description: "Zona o lista de precios no encontrada." }
 *       409: { description: "Ya existe un cliente con ese `ordenRuta` en la zona." }
 *
 * /clients/{id}:
 *   get:
 *     tags: [Zonas y Clientes]
 *     summary: "Obtiene un cliente"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Cliente con contactos." }
 *       404: { description: "Cliente no encontrado." }
 *   put:
 *     tags: [Zonas y Clientes]
 *     summary: "Actualiza un cliente"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Cliente actualizado." }
 *       403: { description: "Solo admin." }
 *       404: { description: "Cliente no encontrado." }
 *       409: { description: "`ordenRuta` duplicado en la zona." }
 *   delete:
 *     tags: [Zonas y Clientes]
 *     summary: "Desactiva un cliente"
 *     description: "No borra. Conserva sus visitas, pedidos y movimientos de cuenta, y revoca sus tokens del catálogo público."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Cliente desactivado." }
 *       403: { description: "Solo admin." }
 *       404: { description: "Cliente no encontrado." }
 *       409: { description: "Ya estaba desactivado (`ALREADY_INACTIVE`)." }
 *
 * /clients/{id}/contacts:
 *   get:
 *     tags: [Zonas y Clientes]
 *     summary: "Lista contactos del cliente"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: "Contactos con teléfono y preferencia de WhatsApp." }
 *       404: { description: "Cliente no encontrado." }
 *   post:
 *     tags: [Zonas y Clientes]
 *     summary: "Agrega un contacto"
 *     description: "Solo admin. `esPrincipal` es único por cliente."
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       201: { description: "Contacto creado." }
 *       403: { description: "Solo admin." }
 *       404: { description: "Cliente no encontrado." }
 *
 * /clients/{id}/contacts/{contactId}:
 *   get:
 *     tags: [Zonas y Clientes]
 *     summary: "Obtiene un contacto"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: path, name: contactId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: "El contacto del cliente." }
 *       404: { description: "Contacto no encontrado." }
 *   put:
 *     tags: [Zonas y Clientes]
 *     summary: "Actualiza un contacto"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: path, name: contactId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: "Contacto actualizado." }
 *       404: { description: "Contacto no encontrado." }
 *   delete:
 *     tags: [Zonas y Clientes]
 *     summary: "Elimina un contacto"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: path, name: contactId, required: true, schema: { type: integer } }
 *     responses:
 *       204: { description: "Contacto eliminado." }
 *       404: { description: "Contacto no encontrado." }
 *
 * /route-visits/today:
 *   get:
 *     tags: [Zonas y Clientes]
 *     summary: "Ruta de hoy"
 *     description: "Zonas activas según la semana y el día, con sus clientes, si ya fueron visitados y el saldo actual."
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "`{ fecha, semanaMes, diaSemana, zones, clients }`. Vacío si hoy no hay visita programada." }
 *       401: { description: "Sin token." }
 *
 * /route-visits:
 *   post:
 *     tags: [Zonas y Clientes]
 *     summary: "Registra una visita de ruta"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [clientId, resultado], properties: { clientId: { type: integer }, resultado: { type: string, enum: [pedido, no_compro, cerrado] }, fecha: { type: string, format: date }, motivo: { type: string }, observaciones: { type: string }, lat: { oneOf: [{ type: string }, { type: number }] }, lng: { oneOf: [{ type: string }, { type: number }] } } }
 *     responses:
 *       201: { description: "Visita registrada." }
 *       404: { description: "Cliente no encontrado." }
 */
export const salesTerritoryRouter = Router();

const adminWrite = [requireAuth, requireRole('admin')] as const;
const readAuth = [requireAuth] as const;
const idParams = validateParams(idParamSchema);
const contactParams = validateParams(contactParamsSchema);

salesTerritoryRouter.get('/zones', ...readAuth, controller.listZones);
salesTerritoryRouter.get('/zones/:id', ...readAuth, idParams, controller.getZone);
salesTerritoryRouter.post('/zones', ...adminWrite, validateBody(createZoneSchema), controller.createZone);
salesTerritoryRouter.put(
  '/zones/:id',
  ...adminWrite,
  idParams,
  validateBody(updateZoneSchema),
  controller.updateZone,
);
salesTerritoryRouter.delete('/zones/:id', ...adminWrite, idParams, controller.deleteZone);

salesTerritoryRouter.get('/clients', ...readAuth, controller.listClients);
salesTerritoryRouter.get('/clients/:id', ...readAuth, idParams, controller.getClient);
salesTerritoryRouter.post('/clients', ...adminWrite, validateBody(createClientSchema), controller.createClient);
salesTerritoryRouter.put(
  '/clients/:id',
  ...adminWrite,
  idParams,
  validateBody(updateClientSchema),
  controller.updateClient,
);
salesTerritoryRouter.delete('/clients/:id', ...adminWrite, idParams, controller.deleteClient);

salesTerritoryRouter.get('/clients/:id/contacts', ...readAuth, idParams, controller.listClientContacts);
salesTerritoryRouter.get(
  '/clients/:id/contacts/:contactId',
  ...readAuth,
  contactParams,
  controller.getClientContact,
);
salesTerritoryRouter.post(
  '/clients/:id/contacts',
  ...adminWrite,
  idParams,
  validateBody(createContactSchema),
  controller.createClientContact,
);
salesTerritoryRouter.put(
  '/clients/:id/contacts/:contactId',
  ...adminWrite,
  contactParams,
  validateBody(updateContactSchema),
  controller.updateClientContact,
);
salesTerritoryRouter.delete(
  '/clients/:id/contacts/:contactId',
  ...adminWrite,
  contactParams,
  controller.deleteClientContact,
);

salesTerritoryRouter.get('/route-visits/today', ...readAuth, controller.getTodayRoute);
salesTerritoryRouter.post(
  '/route-visits',
  ...readAuth,
  validateBody(createRouteVisitSchema),
  controller.createRouteVisit,
);
