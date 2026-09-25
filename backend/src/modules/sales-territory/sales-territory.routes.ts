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
