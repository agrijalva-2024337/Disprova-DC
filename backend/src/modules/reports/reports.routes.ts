import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import * as controller from './reports.controller.js';

export const reportsRouter = Router();

const admin = [requireAuth, requireRole('admin')] as const;

reportsRouter.get('/sales-today', ...admin, controller.salesToday);
reportsRouter.get('/collections-today', ...admin, controller.collectionsToday);
reportsRouter.get('/aging', ...admin, controller.aging);
